import { api } from '../lib/api.js';
import { el, sourceLinks } from '../lib/dom.js';
import { composeAnswerBlocks, contextBlocks } from '../lib/chat-context.js';
import { createWorkflowAssistant } from './workflow-assistant.js';
import { initSpeech } from './speech.js';

export function initChat(getState, actions) {
  const $ = id => document.getElementById(id);
  let worker, ready = false, disabled = false, revision = 0, request, sequence = 0, chatContext = null;
  const selections = new Map();
  const log = $('chat-history');
  const setStatus = message => { $('model-status').textContent = message; };
  // The panel is height-capped and itself scrolls, so on a phone a reply can push the form and this
  // status line below the panel's visible edge. Measured 18 Nov at 320×568: after one reply the
  // message box sat at y=329 while the panel ended at y=307, hiding both it and the error text.
  const announce = message => { $('answer-status').textContent = message; $('answer-status').scrollIntoView({ block: 'nearest' }); };
  const workflow = createWorkflowAssistant({ getState, actions, progress: message => announce(message) });
  let pendingChoice = null, messageSerial = 0;
  // Optional voice input/read-aloud. Dictation only fills the editable message box.
  const speech = initSpeech({ input: $('question'), status: $('speech-status'), micButton: $('mic'), unloadButton: $('unload-speech'), stopButton: $('stop-speaking'), consent: $('speech-consent'), startButton: $('start-dictation'), cancelButton: $('cancel-dictation') });
  const starters=[...$('chat-examples').querySelectorAll('button')];
  starters.forEach(button=>button.addEventListener('click',()=>{if($('ask').disabled)return;pendingChoice=null;$('question').value=button.dataset.prompt;$('question-form').requestSubmit();}));
  function positionChat(){
    const main=document.querySelector('main');document.documentElement.style.setProperty('--main-scrollbar',`${main.offsetWidth-main.clientWidth}px`);
    const bar=document.querySelector('.workflow-navigation').getBoundingClientRect();
    const clearance=bar.top<innerHeight&&bar.bottom>0?innerHeight-Math.max(0,bar.top)+8:88;
    $('chat-panel').style.setProperty('--chat-bottom',`${clearance}px`);
    // Keep the closed launcher clear of sticky navigation on short screens too.
    $('chat-toggle').style.bottom=`${bar.top<innerHeight-16&&bar.bottom>innerHeight-80?clearance:16}px`;
  }
  const observer=new ResizeObserver(positionChat);observer.observe(document.querySelector('.workflow-navigation'));observer.observe(document.querySelector('footer'));observer.observe(document.querySelector('main'));
  window.addEventListener('resize',()=>{positionChat();$('answer-status').scrollIntoView({block:'nearest'});});window.addEventListener('scroll',positionChat,{passive:true});
  function open(value) {
    $('chat-panel').hidden = !value;
    $('chat-toggle').setAttribute('aria-expanded', String(value));
    if (value) { positionChat(); $('question').focus(); } else { speech.cancel(); $('chat-toggle').focus(); }
    if(value&&!worker&&!disabled)loadModel();
  }
  $('chat-toggle').addEventListener('click', () => open($('chat-panel').hidden));
  $('chat-close').addEventListener('click', () => open(false));
  $('chat-panel').addEventListener('keydown', event => { if (event.key === 'Escape') open(false); });
  function unload() {
    worker?.terminate(); worker = null; ready = false;
    disabled = true;
    selections.forEach(resolve => resolve(null)); selections.clear();
    $('load-model').disabled = false; $('unload-model').disabled = true;
    setStatus('Evidence mode. No model loaded.');
  }
  $('unload-model').addEventListener('click', unload);
  function loadModel() {
    if(worker)return;
    disabled=false;
    $('load-model').disabled = true; $('unload-model').disabled = false;
    setStatus('Loading model on this device. Evidence chat remains available.');
    worker = new Worker('/js/modules/mini-lm-worker.js');
    worker.onmessage = event => {
      const data = event.data;
      if (data.type === 'progress') setStatus(`Loading local model · ${data.text}`);
      if (data.type === 'ready') { ready = true; setStatus(`Compact model ready · ${(data.metrics.weightBytes / 1000).toFixed(1)} KB weights · ${(data.metrics.loadMs / 1000).toFixed(1)}s load · experimental`); window.fieldshiftModelMetrics = data.metrics; }
      if (data.type === 'selection') { window.fieldshiftModelMetrics = data.metrics; window.fieldshiftModelSelections = (window.fieldshiftModelSelections ?? 0) + 1; selections.get(data.id)?.(data.index); selections.delete(data.id); }
      if (data.type === 'error') {
        if (data.id) { selections.get(data.id)?.(null); selections.delete(data.id); }
        else { unload(); setStatus('Model could not start on this device. Evidence chat still works.'); }
      }
    };
    worker.onerror = event => { event.preventDefault(); unload(); setStatus('Model could not start on this device. Evidence chat still works.'); };
    worker.postMessage({ type: 'load' });
  }
  $('load-model').addEventListener('click',loadModel);
  function select(question, blocks) {
    if (!ready) return Promise.resolve(null);
    return new Promise(resolve => {
      const id = ++sequence;
      const timeout = setTimeout(() => { selections.delete(id); resolve(null); }, 20_000);
      selections.set(id, index => { clearTimeout(timeout); resolve(index); });
      worker.postMessage({ type: 'select', id, question, blocks });
    });
  }
  $('question-form').addEventListener('submit', async event => {
    event.preventDefault();
    const startedAt=performance.now();
    const version = revision, question = $('question').value.trim(), serial = ++messageSerial;
    if (!question) return;
    speech.cancel();$('speech-status').hidden=true;$('answer-status').hidden=false;
    request?.abort(); request = new AbortController();
    $('question').focus();
    $('ask').disabled = true; announce('Retrieving source facts…');
    starters.forEach(button=>button.disabled=true);
    const user = el('article', null, { class: 'chat-message' });
    user.append(el('h3', 'You'), el('p', question)); log.append(user);
    $('question').value = '';
    try {
      const choice = pendingChoice; pendingChoice = null;
      let answer = await workflow.respond(question, choice);
      const state = getState();
      answer ??= await api('/api/ask', { method: 'POST', body: { ...(state.inputs ?? {}), selectedCountry: state.country, chatContext, question }, signal: request.signal });
      const extra = contextBlocks(question, state, answer);
      answer.blocks = composeAnswerBlocks(answer.blocks, extra.blocks);
      answer.sources.push(...extra.sources);
      if (version !== revision || serial !== messageSerial) return;
      if (answer.context) chatContext = answer.context;
      else if (answer.topic === 'greeting') chatContext = null;
      const response = el('article', null, { class: 'chat-message' });
      response.append(el('h3', 'Assistant'));
      answer.blocks.forEach(block => {
        response.append(el('p', block.text));
      });
      const sourceIds = [...new Set(answer.blocks.flatMap(block => block.sourceIds))];
      if (sourceIds.length) {
        const details = el('details'); details.append(el('summary', `Sources (${sourceIds.length})`), sourceLinks(sourceIds, answer.sources)); response.append(details);
      }
      const followUps = answer.followUps ?? (answer.topic === 'weather' ? ['Show me rainfall evidence', 'Show me solar evidence'] :
        /soil|ph\b|sand|clay/i.test(question) ? ['Tell me about soil pH', 'Tell me about soil sand', 'Tell me about soil clay'] : []);
      if (followUps.length) {
        // A place question deserves a place-named group: "Explore another topic" told a screen-reader
        // user nothing when the buttons were the only way to answer "Which town in X?".
        const isWorkflow = answer.topic === 'workflow' || followUps.some(each => typeof each !== 'string' && each.workflowChoice);
        const choices = el('div', null, { role: 'group', 'aria-label': isWorkflow ? 'Choose one of these to continue planning' : 'Explore another topic' });
        // Every offered choice is rendered; silently dropping the last one left farmers
        // with a reply whose only way out was invisible. The workflow assistant bounds its own
        // offers to a handful of real rows, and tests/matrix-coverage.test.js asserts that bound,
        // so nothing here may trim the list again.
        followUps.forEach(followUp => {
          const text = typeof followUp === 'string' ? followUp : followUp.question;
          // The choice kind travels with the button so a test can tap the level the app actually asked
          // for, instead of guessing from the sentence.
          const button = el('button', typeof followUp === 'string' ? followUp : followUp.label,
            { type: 'button', 'data-chat-choice': 'true', 'data-choice-type': followUp.workflowChoice?.type ?? 'follow-up' });
          button.addEventListener('click', () => { pendingChoice = followUp.workflowChoice ?? null; $('question').value = text; $('question-form').requestSubmit(); }); choices.append(button);
        });
        response.append(choices);
      }
      speech.attachReadAloud(response);
      log.append(response);
      // The evidence answer is visible before optional neural inference finishes.
      const renderedAt=performance.now();
      window.fieldshiftAnswerLatencyMs=renderedAt-startedAt;
      if(ready && answer.topic !== 'greeting') select(question,answer.blocks).then(index => {
        // The model may prioritize an existing retrieved paragraph. It cannot
        // alter text, remove caveats, reorder guarded input checks or run actions.
        if(answer.useSelectedLocation===false || version!==revision || serial!==messageSerial || !response.isConnected || !Number.isInteger(index) || index<=0 || answer.blocks[index]?.kind==='limitation')return;
        const paragraphs=response.querySelectorAll(':scope > p');
        if(paragraphs[index])response.insertBefore(paragraphs[index],paragraphs[0]);
      }).catch(() => {});
      // Keep a bounded conversation in memory; nothing is sent to a cloud model.
      while (log.children.length > 20) log.firstElementChild.remove();
      log.scrollTop = log.scrollHeight;
      announce('Answer ready. Sources and limits are included.');
    } catch (error) {
      // The composer was cleared before the request was made, so a failure that only writes a status line leaves the
      // farmer nothing to send: the message survives in the history, where it cannot be re-submitted, and the next
      // message overwrites the sentence explaining this one. A stop the farmer asked for is not a failure to retry, and
      // text typed while the ask was in flight belongs to them now, so it is never pasted over.
      if (error.cancelled !== true && version === revision && serial === messageSerial) {
        announce(error.message);
        if ($('question').value === '') $('question').value = question;
      }
    }
    finally { if (version === revision && serial === messageSerial) { $('ask').disabled = false;starters.forEach(button=>button.disabled=false); } }
  });
  return { invalidate({ fromAssistant = false } = {}) {
    chatContext = null;
    if (fromAssistant) return;
    const guided = workflow.isActive();
    workflow.invalidate(); pendingChoice = null; speech.stopSpeaking();
    revision++; request?.abort(); $('ask').disabled = false; chatContext = null;
    starters.forEach(button=>button.disabled=false);
    log.replaceChildren(el('p', 'Location or planning context changed. New messages use the current selection.'));
    // A guided plan can continue after the user picks a town or field in step 1 themselves.
    if (guided && getState().location) {
      const group = el('div', null, { role: 'group', 'aria-label': 'Continue the guided plan' });
      const button = el('button', 'Continue planning with this location', { type: 'button', 'data-chat-choice': 'true' });
      button.addEventListener('click', () => { $('question').value = 'Use the selected point'; $('question-form').requestSubmit(); });
      group.append(button);
      log.append(el('p', 'You picked a location in step 1. Continue to load NASA evidence for it and compare the crops in step 3.'), group);
    }
    announce('Answers include sources and limitations.');
  } };
}

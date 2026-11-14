import { api } from '../lib/api.js';
import { el, sourceLinks } from '../lib/dom.js';

export function initChat(getState) {
  const $ = id => document.getElementById(id);
  let worker, ready = false, disabled = false, revision = 0, request, sequence = 0;
  const selections = new Map();
  const log = $('chat-history');
  const setStatus = message => { $('model-status').textContent = message; };
  function open(value) {
    $('chat-panel').hidden = !value;
    $('chat-toggle').setAttribute('aria-expanded', String(value));
    if (value) $('question').focus(); else $('chat-toggle').focus();
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
      if (data.type === 'ready') { ready = true; setStatus(`Compact model ready · 116.8 KB weights · ${(data.metrics.loadMs / 1000).toFixed(1)}s load · experimental`); window.fieldshiftModelMetrics = data.metrics; }
      if (data.type === 'selection') { window.fieldshiftModelMetrics = data.metrics; selections.get(data.id)?.(data.index); selections.delete(data.id); }
      if (data.type === 'error') {
        if (data.id) { selections.get(data.id)?.(null); selections.delete(data.id); }
        else { unload(); setStatus(`Model unavailable: ${data.message}. Evidence chat still works.`); }
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
  function contextBlocks(question, state) {
    const blocks = [], sources = [];
    if(/weather|nasa|temperature|rainfall|precipitation|solar|frost/.test(question.toLowerCase())&&state.observations){
      const data=state.observations;
      for(const name of ['T2M','PRECTOTCORR','ALLSKY_SFC_SW_DWN']){
        const parameter=data.parameters[name],date=parameter.latestAvailableDate;
        const value=date?parameter.values[data.dates.indexOf(date)]:null;
        blocks.push({kind:'historical weather evidence',text:`${parameter.label}: latest non-missing value inside ${data.period.start} to ${data.period.end} is ${value??'missing'} ${parameter.units} on ${date??'unknown date'}. Regional estimated gridded observation at ${data.location.latitude}°, ${data.location.longitude}°; retrieved ${data.retrievedAt}. It is not current weather, a forecast or a field measurement.`,sourceIds:['nasa-power']});
      }
      sources.push({id:'nasa-power',title:'NASA POWER exact data request',url:data.source.url});
    }
    if (/soil|ph\b|sand|clay|drain/.test(question.toLowerCase())) {
      if (state.soil) {
        state.soil.properties.forEach(p => blocks.push({ kind: 'regional soil model', text: `${p.name}: mean ${p.mean ?? 'missing'} ${p.units}; source 5th–95th prediction quantiles ${p.lower ?? 'missing'}–${p.upper ?? 'missing'} ${p.units}. SoilGrids ${state.soil.nominalResolutionM} m grid, ${state.soil.depth}, retrieved ${state.soil.retrievedAt}; no single observation date. This is not a farm measurement.`, sourceIds: ['soilgrids'] }));
        blocks.push({ kind: 'limitation', text: 'ISRIC advises against local/farm-level use of SoilGrids. These estimates are regional context only; no measured pH, drainage or soil-water capacity is inferred for this field.', sourceIds: ['soilgrids'] });
        sources.push(state.soil.source);
      } else blocks.push({ kind: 'limitation', text: 'Mapped soil context is not loaded. Load it in Plan crops. No soil type or pH is guessed for this field.', sourceIds: [] });
    }
    if (/water|irrigat|australia/.test(question.toLowerCase())) {
      if (state.water?.available) {
        state.water.rows.forEach(row => blocks.push({ kind: 'historical national irrigation context', text: `${row.category}: Australia ${state.water.period}, ${row.waterAppliedMl} ML applied ÷ ${row.irrigatedHa} irrigated ha = ${row.appliedMlPerIrrigatedHa.toFixed(2)} ML/ha annually. ABS release ${state.water.publishedDate}. This broad national ratio is not this farm's water requirement or a daily watering schedule.`, sourceIds: ['abs-irrigation'] }));
        sources.push(state.water.source);
      } else blocks.push({ kind: 'limitation', text: 'No verified irrigation benchmark is loaded for this country. Australian national statistics are not substituted for another country or for a field irrigation schedule.', sourceIds: [] });
    }
    if (/farm|field|crop|grow|produc/.test(question.toLowerCase()) && state.farm) {
      const farm = state.farm;
      blocks.push({ kind: 'mapped field record', text: `${farm.name}. ${farm.crops.length ? `Recorded crop tags: ${farm.crops.join(', ')}.` : 'No crop tags are recorded.'} OSM edit date: ${farm.updatedAt ?? 'unknown'}; current crops, ownership and access are unverified.`, sourceIds: ['selected-field'] });
      sources.push({ id: 'selected-field', title: 'Selected OpenStreetMap field', url: farm.sourceUrl });
    }
    if (/pest|insect|moth|worm|disease/.test(question.toLowerCase())) {
      if (state.pests) for (const pest of state.pests.records) {
        blocks.push({ kind: 'country occurrence context', text: `${pest.name} in ${state.pests.country}: ${pest.status}${pest.occurrenceCount !== null ? ` (${pest.occurrenceCount} historical occurrence records)` : ''}. ${pest.hostNote} This does not establish farm presence or current outbreak.`, sourceIds: [pest.id, `${pest.id}-host`] });
        sources.push({ id: pest.id, title: `GBIF ${pest.name} country query`, url: pest.sourceUrl }, { id: `${pest.id}-host`, ...pest.hostSource });
      } else blocks.push({ kind: 'limitation', text: 'Country pest context is not loaded. Use Plan crops → Country pest context. There are no pest observations for this farm in the app.', sourceIds: [] });
    }
    return { blocks, sources };
  }
  $('question-form').addEventListener('submit', async event => {
    event.preventDefault();
    const startedAt=performance.now();
    const version = revision, question = $('question').value.trim();
    if (!question) return;
    request?.abort(); request = new AbortController();
    $('ask').disabled = true; $('answer-status').textContent = 'Retrieving source facts…';
    const user = el('article', null, { class: 'chat-message' });
    user.append(el('h3', 'You'), el('p', question)); log.append(user);
    $('question').value = '';
    try {
      const state = getState();
      const answer = await api('/api/ask', { method: 'POST', body: { ...(state.inputs ?? {}), question }, signal: request.signal });
      const extra = contextBlocks(question, state);
      answer.blocks = [...extra.blocks, ...answer.blocks]; answer.sources.push(...extra.sources);
      if (version !== revision) return;
      const response = el('article', null, { class: 'chat-message' });
      response.append(el('h3', ready ? 'Assistant · local model + retrieved evidence' : 'Assistant · retrieved evidence'));
      answer.blocks.forEach(block => {
        response.append(el('p', `${block.kind}: ${block.text}`));
        if (block.sourceIds.length) response.append(sourceLinks(block.sourceIds, answer.sources));
      });
      log.append(response);
      // The evidence answer is visible before optional neural inference finishes.
      const renderedAt=performance.now();
      window.fieldshiftAnswerLatencyMs=renderedAt-startedAt;
      if(ready)select(question,answer.blocks).then(index=>{
        if(version!==revision||!response.isConnected)return;
        response.append(el('p',index===null?'Compact model: no verified selection; the sourced answer above remains the fallback.':`Compact model identified relevant ${answer.blocks[index].kind}. Displayed facts are from the retrieved evidence.`));
      });
      // Keep a bounded conversation in memory; nothing is sent to a cloud model.
      while (log.children.length > 20) log.firstElementChild.remove();
      log.scrollTop = log.scrollHeight;
      $('answer-status').textContent = 'Answer ready. Sources and limits are included.';
    } catch (error) { if (error.name !== 'AbortError' && version === revision) $('answer-status').textContent = error.message; }
    finally { if (version === revision) $('ask').disabled = false; }
  });
  return { invalidate() {
    revision++; request?.abort(); $('ask').disabled = false;
    log.replaceChildren(el('p', 'Location or planning context changed. New messages use the current selection.'));
    $('answer-status').textContent = 'Answers include sources and limitations.';
  } };
}

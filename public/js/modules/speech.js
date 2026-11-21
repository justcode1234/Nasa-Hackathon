// Optional voice input and read-aloud for the chat. Typed chat never depends on it.
// - Dictation: explicit mic click -> microphone permission -> local Whisper tiny.en
//   transcription -> text placed in the editable message box. Nothing is auto-sent.
// - Read aloud: the browser's built-in speech engine, restricted to English voices
//   that run on this device (voice.localService). The text of the actual answer is
//   spoken, including its limitations. No text is sent to a remote voice service.
import { speechFailureStatus } from '../lib/model-failure.js';
const MAX_SECONDS = 20, RATE = 16000;
export const englishLocalVoice = voices => voices.filter(voice => voice.localService && /^en(?:[-_]|$)/i.test(voice.lang))
  .sort((a, b) => (b.default ? 1 : 0) - (a.default ? 1 : 0) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))[0] ?? null;

// Spoken text is exactly the visible answer paragraphs; buttons and link lists are skipped.
export const spokenText = article => [...article.querySelectorAll(':scope > p')].map(node => node.textContent.trim()).filter(Boolean).join(' ');

export async function toMono16k(blob) {
  const bytes = await blob.arrayBuffer();
  const Context = window.AudioContext ?? window.webkitAudioContext;
  const context = new Context();
  try {
    const decoded = await context.decodeAudioData(bytes);
    const frames = Math.ceil(decoded.duration * RATE);
    const offline = new OfflineAudioContext(1, Math.max(1, frames), RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded; source.connect(offline.destination); source.start();
    return (await offline.startRendering()).getChannelData(0);
  } finally { await context.close(); }
}

export function initSpeech({ input, status, micButton, unloadButton, stopButton, consent, startButton, cancelButton }) {
  let worker = null, ready = false, recorder = null, stream = null, chunks = [], timer = null, sequence = 0, pending = null, cancelled = false;
  let accepted=false,permissionRequest=0;
  const say = message => { status.textContent = message;status.hidden=false;const answer=document.getElementById('answer-status');if(answer)answer.hidden=true; };
  const supported = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder && window.Worker);
  if (!supported) { micButton.disabled = true; say('Voice input is not supported in this browser. Typing works as usual.'); }
  const setRecording = on => {
    micButton.setAttribute('aria-pressed', String(on));
    micButton.setAttribute('aria-label', on ? 'Stop dictation' : 'Dictate a message in English');
    micButton.classList.toggle('recording', on);
  };
  function release() {
    clearTimeout(timer); timer = null;
    stream?.getTracks().forEach(track => track.stop()); stream = null; recorder = null; chunks = [];
    setRecording(false);
  }
  function unload(message = 'Speech model unloaded. Typing works as usual.') {
    cancelled = true;
    permissionRequest++;if(consent)consent.hidden=true;
    if (recorder?.state === 'recording') recorder.stop();
    release();
    worker?.terminate(); worker = null; ready = false; pending = null;
    unloadButton.disabled = true; micButton.disabled = !supported;
    window.fieldshiftSpeechMetrics = null;
    say(message);
  }
  function ensureWorker() {
    if (worker) return;
    worker = new Worker('/js/modules/stt-worker.js', { type: 'module' });
    unloadButton.disabled = false;
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') say(`Downloading the English speech model to this device · ${(data.loadedBytes / 1e6).toFixed(0)} of ${(data.totalBytes / 1e6).toFixed(0)} MB`);
      if (data.type === 'ready') { ready = true; window.fieldshiftSpeechMetrics = data.metrics; if (!recorder && !pending) say(`Speech model ready on this device · ${(data.metrics.loadMs / 1000).toFixed(1)}s load. Audio is not uploaded.`); }
      if (data.type === 'transcript' && data.id === pending) {
        pending = null; micButton.disabled = false;
        window.fieldshiftSpeechMetrics = { ...window.fieldshiftSpeechMetrics, inferenceMs: data.inferenceMs, audioSeconds: data.audioSeconds };
        if (!data.text) return say('No speech was recognised. Try again or type your message.');
        // Editable draft only: the user reviews it and presses Send themselves.
        input.value = `${input.value ? `${input.value.trimEnd()} ` : ''}${data.text}`.slice(0, input.maxLength > 0 ? input.maxLength : 500);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        say('Transcript added to the message box. Check and edit it, then press Send.');
      }
      if (data.type === 'error') { pending = null; unload(speechFailureStatus(data.message)); }
    };
    worker.onerror = event => { event.preventDefault(); unload(speechFailureStatus(event.message)); };
    worker.postMessage({ type: 'load' });
  }
  async function start() {
    cancelled = false;
    const version=++permissionRequest;micButton.disabled=true;
    try {
      // Permission is requested only here, after an explicit click on the mic button.
      const granted = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      if(cancelled||version!==permissionRequest){granted.getTracks().forEach(track=>track.stop());return;}
      stream=granted;
    } catch (error) {
      release();
      micButton.disabled=!supported;
      return say(error.name === 'NotAllowedError' || error.name === 'SecurityError' ? 'Microphone permission was not granted. Nothing was recorded. Typing works as usual.' :
        error.name === 'NotFoundError' ? 'No microphone was found. Typing works as usual.' : `The microphone could not start (${error.name}). Typing works as usual.`);
    }
    ensureWorker();
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = async () => {
      const recorded = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
      release();
      if (cancelled || !recorded.size) return;
      micButton.disabled = true;
      say(ready ? 'Transcribing on this device…' : 'Finishing the speech model download, then transcribing on this device…');
      try {
        const audio = await toMono16k(recorded);
        if (!worker) { micButton.disabled = false; return; }
        pending = ++sequence;
        worker.postMessage({ type: 'transcribe', id: pending, audio }, [audio.buffer]);
      } catch (error) { micButton.disabled = false; say('That recording could not be decoded. Try again or type your message.'); }
    };
    recorder.start();
    micButton.disabled=false;
    setRecording(true);
    say(`Listening… speak in English, then press the mic again to stop (${MAX_SECONDS} seconds maximum).`);
    timer = setTimeout(() => { if (recorder?.state === 'recording') recorder.stop(); }, MAX_SECONDS * 1000);
  }
  micButton.addEventListener('click', () => { if (recorder?.state === 'recording') recorder.stop(); else if (!recorder) {
    if(!accepted&&consent){consent.hidden=false;say('English dictation needs about 70 MB on first use. Continue or cancel before any microphone request or download.');startButton.focus();}
    else start();
  } });
  startButton?.addEventListener('click',()=>{accepted=true;consent.hidden=true;start();});
  cancelButton?.addEventListener('click',()=>{cancelled=true;permissionRequest++;consent.hidden=true;micButton.disabled=!supported;say('Dictation cancelled. No microphone request or model download was started.');micButton.focus();});
  unloadButton.addEventListener('click', () => unload());

  // Read aloud.
  const synth = window.speechSynthesis;
  let speakingButton = null;
  const resetSpeak = () => { if (speakingButton) { speakingButton.textContent = 'Read aloud'; speakingButton.setAttribute('aria-pressed', 'false'); speakingButton = null; } stopButton.hidden = true; };
  function stopSpeaking() { synth?.cancel(); resetSpeak(); }
  stopButton.addEventListener('click', stopSpeaking);
  function attachReadAloud(article) {
    if (!synth || !window.SpeechSynthesisUtterance) return;
    if (!spokenText(article)) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'read-aloud'; button.textContent = 'Read aloud'; button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', async () => {
      if (speakingButton === button) return stopSpeaking();
      stopSpeaking();
      // Some browsers fill the voice list asynchronously.
      if (!synth.getVoices().length) await new Promise(resolve => { synth.addEventListener('voiceschanged', resolve, { once: true }); setTimeout(resolve, 1500); });
      const voice = englishLocalVoice(synth.getVoices());
      if (!voice) return say('No on-device English voice is installed in this browser, so read-aloud is unavailable. The written answer is unchanged.');
      const text = spokenText(article);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 1;
      utterance.onstart = () => { window.fieldshiftSpeechStarted = (window.fieldshiftSpeechStarted ?? 0) + 1; };
      utterance.onend = () => { if (speakingButton === button){resetSpeak();say('Read-aloud finished. The written answer and its sources remain available.');} };
      utterance.onerror = () => { if (speakingButton === button){resetSpeak();say('Read-aloud stopped or could not finish. The written answer is available.');} };
      speakingButton = button; button.textContent = 'Stop reading'; button.setAttribute('aria-pressed', 'true'); stopButton.hidden = false;
      window.fieldshiftSpokenText = text; window.fieldshiftSpokenVoice = { name: voice.name, lang: voice.lang, localService: voice.localService };
      say('Reading the written answer aloud, including its limits. Use Stop speaking to stop.');
      synth.speak(utterance);
    });
    article.append(button);
  }
  return { attachReadAloud, stopSpeaking, unload, cancel() { cancelled = true;permissionRequest++;if(consent)consent.hidden=true; if (recorder?.state === 'recording') recorder.stop(); release();micButton.disabled=!supported; stopSpeaking(); } };
}

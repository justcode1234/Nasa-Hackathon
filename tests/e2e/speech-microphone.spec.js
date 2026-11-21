import {test,expect} from '@playwright/test';
import path from 'node:path';
import {scanAccessibility} from './axe-helper.js';

// TEST fixture: synthetic English speech generated locally with the Windows voice.
// Chrome plays it as the microphone. No person's voice is recorded or stored.
const wav=path.resolve('tests/fixtures/TEST-synthetic-speech-tomatoes-kenya.wav');
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const open=async page=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
};
const mic=page=>page.locator('#mic');

test.use({launchOptions:{args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream',`--use-file-for-fake-audio-capture=${wav}%noloop`]}});

test('dictation transcribes real audio on the device into an editable draft and never sends it',async({page,context},info)=>{
  test.setTimeout(300_000);const errors=[],uploads=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route(fields,r=>r.abort('failed'));
  context.on('request',request=>{if(request.method()!=='GET'&&!/127\.0\.0\.1/.test(request.url()))uploads.push(`${request.method()} ${request.url()}`);});
  await open(page);
  // No microphone or speech-model request happens before the explicit click.
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/huggingface|hf\.co|transformers/.test(e.name)).length)).toBe(0);
  await expect(mic(page)).toHaveAttribute('aria-pressed','false');
  await mic(page).click();
  if(await page.locator("#speech-consent").isVisible())await page.locator("#start-dictation").click();
  await expect(page.locator('#speech-status')).toContainText('Listening');
  await expect(mic(page)).toHaveAttribute('aria-pressed','true');await expect(mic(page)).toHaveAccessibleName('Stop dictation');
  await scanAccessibility(page,info,'English microphone recording');
  await page.waitForTimeout(4000);await mic(page).click();
  if(await page.locator("#speech-consent").isVisible())await page.locator("#start-dictation").click();
  await expect(page.locator('#question')).toHaveValue(/tomatoes in kenya/i,{timeout:240_000});
  await expect(page.locator('#speech-status')).toContainText('Check and edit it, then press Send');
  await expect(page.locator('#question')).toBeFocused();
  // The transcript is a draft: nothing was sent or executed.
  await expect(page.locator('#chat-history article')).toHaveCount(0);
  await expect(page.locator('#pest-country')).toHaveValue('');
  expect(uploads,'audio must not be uploaded anywhere').toEqual([]);
  const metrics=await page.evaluate(()=>window.fieldshiftSpeechMetrics);
  expect(metrics.downloadBytes).toBeGreaterThan(30e6);expect(metrics.downloadBytes).toBeLessThan(60e6);
  const transcript=await page.locator('#question').inputValue();
  // The user can edit before sending; the grounded answer then arrives as usual.
  await page.locator('#question').fill('Tell me about tomatoes in Kenya');await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.locator('#answer-status')).toContainText('Answer ready',{timeout:60_000});
  await expect(page.locator('#chat-history article')).toHaveCount(2);
  if(!await page.locator('#assistant-settings').getAttribute('open'))await page.locator('#assistant-settings>summary').click();
  await page.getByRole('button',{name:'Unload speech model',exact:true}).click();
  await expect(page.locator('#speech-status')).toContainText('unloaded');
  await expect(page.getByRole('button',{name:'Unload speech model',exact:true})).toBeDisabled();
  await info.attach('Speech-to-text measurement',{body:Buffer.from(JSON.stringify({transcript,...metrics},null,2)),contentType:'application/json'});
  expect(errors).toEqual([]);
});

test('unloading during recording cancels it, releases the microphone and leaves the draft untouched',async({page,context})=>{
  await context.route(fields,r=>r.abort('failed'));
  await open(page);await page.locator('#question').fill('my own words');
  await mic(page).click();
  if(await page.locator("#speech-consent").isVisible())await page.locator("#start-dictation").click();await expect(mic(page)).toHaveAttribute('aria-pressed','true');
  if(!await page.locator('#assistant-settings').getAttribute('open'))await page.locator('#assistant-settings>summary').click();
  await page.getByRole('button',{name:'Unload speech model',exact:true}).click();
  await expect(mic(page)).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#speech-status')).toContainText('unloaded');
  await page.waitForTimeout(1500);
  await expect(page.locator('#question')).toHaveValue('my own words');await expect(mic(page)).toBeEnabled();
});

test('a failed speech-model download is reported and typed chat still works',async({page,context})=>{
  test.setTimeout(120_000);
  const hubRequests=[];context.on('request',request=>{if(/huggingface\.co|hf\.co/.test(request.url()))hubRequests.push(request.url());});
  await context.route(fields,r=>r.abort('failed'));await context.route(/huggingface\.co|hf\.co/,r=>r.abort('failed'));
  await open(page);await mic(page).click();
  if(await page.locator("#speech-consent").isVisible())await page.locator("#start-dictation").click();
  // The failure can arrive while still listening: recording must stop and nothing is transcribed.
  await expect(page.locator('#speech-status')).toContainText('Voice input unavailable',{timeout:60_000});
  await expect(mic(page)).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#speech-status')).toContainText('Typing works as usual');
  await expect(page.locator('#question')).toHaveValue('');await expect(mic(page)).toBeEnabled();
  // Iteration 73 (F16) pins the whole sentence and refuses the parts of it that used to be the worker's own text.
  // Before this pass the panel read "Voice input unavailable: Failed to fetch. Typing works as usual." on this arm, and
  // on the runtime arm it printed this server's origin, an XMLHttpRequest internals sentence and an ONNX error code
  // (measured on both transports; docs/evidence/iter73-capture-static-pre-2026-11-21.log.gz). The literal below is written
  // out rather than imported from public/js/lib/model-failure.js on purpose: an expectation derived from the code under
  // test rewords itself silently.
  const status=await page.locator('#speech-status').textContent();
  expect(status).toBe('Voice input unavailable because a model file did not arrive. Typing works as usual. Press the microphone button to try again.');
  expect(status).not.toMatch(/huggingface|hf\.co|http|Failed to fetch|XMLHttpRequest|on this device/i);
  expect(status).not.toMatch(/\.\.\s/,'a period was doubled where the worker text used to be interpolated');
  // The recovery the sentence offers has to be the recovery the page performs: pressing the microphone again starts a
  // second load attempt, which is what distinguishes a retry from a dead end. The attempt is observed on the network
  // rather than by a success, because this arm keeps the model host blocked; the success path is the first case above.
  const attempted=hubRequests.length;
  await mic(page).click();
  await expect.poll(()=>hubRequests.length,{timeout:60_000}).toBeGreaterThan(attempted);
  await expect(page.locator('#speech-status')).toContainText('Voice input unavailable because a model file did not arrive');
  await page.locator('#question').fill('Hi');await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.locator('#answer-status')).toContainText('Answer ready',{timeout:60_000});
});

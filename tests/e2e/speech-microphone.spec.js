import {test,expect} from '@playwright/test';
import path from 'node:path';

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
  await expect(page.locator('#speech-status')).toContainText('Listening');
  await expect(mic(page)).toHaveAttribute('aria-pressed','true');await expect(mic(page)).toHaveAccessibleName('Stop dictation');
  await page.waitForTimeout(4000);await mic(page).click();
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
  await page.getByRole('button',{name:'Unload speech model',exact:true}).click();
  await expect(page.locator('#speech-status')).toContainText('unloaded');
  await expect(page.getByRole('button',{name:'Unload speech model',exact:true})).toBeDisabled();
  await info.attach('Speech-to-text measurement',{body:Buffer.from(JSON.stringify({transcript,...metrics},null,2)),contentType:'application/json'});
  expect(errors).toEqual([]);
});

test('unloading during recording cancels it, releases the microphone and leaves the draft untouched',async({page,context})=>{
  await context.route(fields,r=>r.abort('failed'));
  await open(page);await page.locator('#question').fill('my own words');
  await mic(page).click();await expect(mic(page)).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Unload speech model',exact:true}).click();
  await expect(mic(page)).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#speech-status')).toContainText('unloaded');
  await page.waitForTimeout(1500);
  await expect(page.locator('#question')).toHaveValue('my own words');await expect(mic(page)).toBeEnabled();
});

test('a failed speech-model download is reported and typed chat still works',async({page,context})=>{
  test.setTimeout(120_000);
  await context.route(fields,r=>r.abort('failed'));await context.route(/huggingface\.co|hf\.co/,r=>r.abort('failed'));
  await open(page);await mic(page).click();
  // The failure can arrive while still listening: recording must stop and nothing is transcribed.
  await expect(page.locator('#speech-status')).toContainText('Voice input unavailable',{timeout:60_000});
  await expect(mic(page)).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#speech-status')).toContainText('Typing works as usual');
  await expect(page.locator('#question')).toHaveValue('');await expect(mic(page)).toBeEnabled();
  await page.locator('#question').fill('Hi');await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.locator('#answer-status')).toContainText('Answer ready',{timeout:60_000});
});

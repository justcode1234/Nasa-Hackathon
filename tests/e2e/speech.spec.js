import {test,expect} from '@playwright/test';
import {scanAccessibility} from './axe-helper.js';

const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const open=async page=>{
  await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('#catalog-status')).toContainText('Choose a country');
  await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();
};
const mic=page=>page.locator('#mic');

test('a refused microphone records nothing, explains itself and leaves typed chat working',async({page,context})=>{
  await context.route(fields,r=>r.abort('failed'));
  await open(page);
  await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException('Permission denied','NotAllowedError'));});
  await mic(page).click();
  if(await page.locator("#speech-consent").isVisible())await page.locator("#start-dictation").click();
  await expect(page.locator('#speech-status')).toContainText('Microphone permission was not granted. Nothing was recorded');
  await expect(mic(page)).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/huggingface|hf\.co|transformers/.test(e.name)).length),'no model download without a microphone').toBe(0);
  await page.locator('#question').fill('Hi');await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.locator('#answer-status')).toContainText('Answer ready',{timeout:60_000});
});

test('read aloud speaks the actual grounded answer, with its limits, using an on-device English voice',async({page,context},info)=>{
  await context.route(fields,r=>r.abort('failed'));
  await open(page);
  await page.locator('#question').fill('Guarantee that tomatoes will succeed next year');await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.locator('#answer-status')).toContainText('Answer ready',{timeout:60_000});
  const answer=page.locator('#chat-history article').last();
  const visible=(await answer.locator(':scope > p').allTextContents()).map(t=>t.trim()).filter(Boolean).join(' ');
  expect(visible).toMatch(/cannot guarantee/i);
  const voices=await page.evaluate(async()=>{if(!speechSynthesis.getVoices().length)await new Promise(r=>{speechSynthesis.addEventListener('voiceschanged',r,{once:true});setTimeout(r,1500);});
    return speechSynthesis.getVoices().map(v=>({name:v.name,lang:v.lang,localService:v.localService}));});
  await answer.getByRole('button',{name:'Read aloud',exact:true}).click();
  if(voices.some(v=>v.localService&&/^en/i.test(v.lang))){
    await expect(answer.getByRole('button',{name:'Stop reading',exact:true})).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>window.fieldshiftSpokenText)).toBe(visible);
    const voice=await page.evaluate(()=>window.fieldshiftSpokenVoice);expect(voice.localService).toBe(true);expect(voice.lang).toMatch(/^en/i);
    await expect(page.getByRole('button',{name:'Stop speaking',exact:true})).toBeVisible();
    await scanAccessibility(page,info,'read-aloud active');
    await page.getByRole('button',{name:'Stop speaking',exact:true}).click();
    await expect(answer.getByRole('button',{name:'Read aloud',exact:true})).toHaveAttribute('aria-pressed','false');
    expect(await page.evaluate(()=>speechSynthesis.speaking)).toBe(false);
    await info.attach('Read-aloud voice and text',{body:Buffer.from(JSON.stringify({voice,spoken:visible,started:await page.evaluate(()=>window.fieldshiftSpeechStarted??0)},null,2)),contentType:'application/json'});
  }else{
    // No on-device English voice in this browser: the app must say so, never use a remote voice.
    await expect(page.locator('#speech-status')).toContainText('No on-device English voice');
    await info.attach('Read-aloud voice and text',{body:Buffer.from(JSON.stringify({voices,note:'no local English voice available in this browser session'},null,2)),contentType:'application/json'});
  }
});

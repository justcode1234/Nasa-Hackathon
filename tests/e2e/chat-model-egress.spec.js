import {test,expect} from '@playwright/test';

// Iteration 50: the local model runtime is the one chat dependency that comes from a public CDN
// (public/js/modules/mini-lm-worker.js importScripts from cdn.jsdelivr.net), and no spec had ever
// blocked it. The gate's first iteration-49 attempt went red on an unreachable upstream and nothing
// in the log said so; this case makes the degraded path itself the assertion. The mic analogue of
// the same shape is tests/e2e/speech-microphone.spec.js:67.
const fields=/overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru|\/api\/farms\?/;
const open=async page=>{await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('#catalog-status')).toContainText('Choose a country');await page.getByRole('button',{name:'Open FieldShift assistant',exact:true}).click();};

test('a blocked model CDN reports the failure and the chat still answers a typed question',async({page,context})=>{
  test.setTimeout(180_000);
  await context.route(fields,r=>r.abort('failed'));
  await context.route(/cdn\.jsdelivr\.net/,r=>r.abort('failed'));
  await open(page);
  // Opening the panel starts the load on its own (public/js/modules/chat.js:37), so no button click is needed.
  await expect(page.locator('#model-status')).toContainText('Model could not start because its runtime did not arrive. Evidence chat still works. Press Enable compact local model to try again.',{timeout:60_000});
  // Iteration 72 pinned the wording as well as the failure. The old sentence called this the farmer's hardware
  // ("on this device") when the observed fact is one blocked request, and naming the cause must not smuggle the
  // worker's own text into the panel: that text carries the CDN host and an internal API name, which is why
  // iteration 50 stopped echoing it (docs/validation.md subsection 50). The literal above, not a value imported
  // from public/js/lib/model-failure.js, is deliberate: deriving the expectation from the code under test would
  // reword itself silently whenever the wording changed.
  const status=await page.locator('#model-status').textContent();
  expect(status).not.toMatch(/on this device/i);
  expect(status).not.toMatch(/jsdelivr|importScripts|WorkerGlobalScope|https?:/i);
  await expect(page.locator('#load-model')).toBeEnabled();
  await expect(page.locator('#unload-model')).toBeDisabled();
  await page.locator('#question').fill('Hi');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.locator('#answer-status')).toContainText('Answer ready',{timeout:120_000});
  // The panel must not claim a model it never started: window.fieldshiftModelMetrics is written by chat.js
  // only when a worker reports ready or returns a selection, so a failed load leaves it undefined.
  expect(await page.evaluate(()=>window.fieldshiftModelMetrics===undefined)).toBe(true);
});

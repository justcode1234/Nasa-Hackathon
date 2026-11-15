import { test, expect } from '@playwright/test';
const pageErrors=new WeakMap();

async function country(page, code) {
  await page.locator('#pest-country').selectOption(code);
  await expect(page.locator('#country-status')).toContainText('crop production categories');
  await expect(page.locator('#place-region')).toBeEnabled();
  await expect(page.locator('#catalog-status')).toContainText(code==='AU'?'Australia':'Singapore');
}
async function selectPoint(page) {
  await country(page,'AU');
  await page.locator('#latitude').fill('-31.89');await page.locator('#longitude').fill('116.77');
}
async function evidenceReady(page) {
  await expect(page.locator('#evidence-status')).toContainText('Historical evidence loaded',{timeout:45_000});
  await expect(page.locator('#evidence')).toBeVisible();
  await expect(page.locator('#evidence-output table').first().locator('tbody tr')).toHaveCount(5);
  await expect(page.locator('#evidence-output a').first()).toHaveAttribute('href',/^https:\/\/power\.larc\.nasa\.gov\//);
}
test.beforeEach(async({page})=>{
  const errors=[];pageErrors.set(page,errors);page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/',{waitUntil:'domcontentloaded'});await expect(page.locator('#catalog-status')).toContainText('Choose a country');
});
test.afterEach(async({page})=>{expect(pageErrors.get(page),'No uncaught browser errors').toEqual([]);});

test('zero coverage explains the block beside Next and recovers without erasing farmer inputs',async({page},info)=>{
  await country(page,'SG');await page.locator('#tab-si').click();
  const values=await page.locator('#baseline-1 option').evaluateAll(nodes=>nodes.filter(n=>n.value).slice(0,3).map(n=>n.value));
  expect(values.length).toBeGreaterThan(0);
  for(let i=1;i<=3;i++)await page.locator('#baseline-'+i).selectOption(values[(i-1)%values.length]);
  await page.locator('#soil-ph').fill('7.6');
  await expect(page.locator('[name=allowedCrops]')).toHaveCount(0);
  await expect(page.locator('#compare')).toBeDisabled();
  const baseline=await page.locator('[id^=baseline-]').evaluateAll(nodes=>nodes.map(n=>n.value));
  // Exercise the user's actual failing click before checking any new helper UI.
  await page.locator('#flow-next').click();
  await expect(page.locator('#location')).toBeVisible();await expect(page.locator('#pest-country')).toBeFocused();
  await expect(page.locator('#pest-country')).toHaveValue('SG');
  await page.locator('#tab-si').click();
  await expect(page.locator('#allowed-crop-status')).toContainText('No alternatives are available');
  await page.locator('main').evaluate(node=>node.scrollTop=node.scrollHeight);
  await expect(page.locator('#flow-blocker')).toBeInViewport({ratio:1});
  await expect(page.locator('#flow-blocker')).toContainText('coverage gap, not a missing form entry');
  await expect(page.locator('#flow-next')).toHaveText('Choose another location →');
  await page.screenshot({path:info.outputPath('coverage-recovery.png')});
  await info.attach('Visible coverage explanation and recovery action',{path:info.outputPath('coverage-recovery.png'),contentType:'image/png'});
  expect(await page.locator('[id^=baseline-]').evaluateAll(nodes=>nodes.map(n=>n.value))).toEqual(baseline);
  await expect(page.locator('#soil-ph')).toHaveValue('7.6');await expect(page.locator('.scenario')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Next and Compare both complete a real baseline comparison and invalidate stale results',async({page})=>{
  await selectPoint(page);await page.locator('#tab-si').click();
  await expect(page.locator('#flow-next')).toHaveText('Load NASA evidence →');
  await page.locator('#flow-next').click();await expect(page.locator('#load-evidence')).toBeFocused();
  await page.locator('#flow-next').click();await evidenceReady(page);
  await page.locator('#flow-next').click();await expect(page.locator('#si')).toBeVisible();
  for(const [i,value] of ['sweet-corn','pea','bush-bean'].entries())await page.locator('#baseline-'+(i+1)).selectOption(value);
  for(const choice of await page.locator('[name=allowedCrops]').all())await choice.uncheck();
  await expect(page.locator('#compare')).toBeDisabled();await expect(page.locator('#flow-next')).toHaveText('Choose allowed crops →');
  await page.locator('#flow-next').click();await expect(page.locator('[name=allowedCrops]').first()).toBeFocused();
  await page.locator('[name=allowedCrops]').nth(0).check();await expect(page.locator('#compare')).toBeDisabled();
  await page.locator('[name=allowedCrops]').nth(1).check();await expect(page.locator('#compare')).toBeEnabled();
  await page.locator('#baseline-3').selectOption('');await page.locator('#flow-next').click();
  await expect(page.locator('#baseline-3')).toBeFocused();await expect(page.locator('.scenario')).toHaveCount(0);
  await page.locator('#baseline-3').selectOption('bush-bean');await page.locator('#flow-next').click();
  await expect(page.locator('#strategy')).toBeVisible();await expect(page.locator('.scenario')).toHaveCount(3);
  await expect(page.locator('.timeline>li')).toHaveCount(9);
  await expect(page.locator('.timeline').first().locator('h4')).toHaveText(['1. Sweet corn','2. Garden pea','3. Bush snap bean']);
  const sequences=await page.locator('.timeline').evaluateAll(nodes=>nodes.map(node=>[...node.querySelectorAll('h4')].map(h=>h.textContent).join(' / ')));
  expect(new Set(sequences).size,'Baseline and both alternatives must be distinct').toBe(3);
  await page.locator('#flow-back').click();await page.locator('#priority').selectOption('water');
  await expect(page.locator('.scenario')).toHaveCount(0);await page.locator('#compare').click();
  await expect(page.locator('#strategy')).toBeVisible();await expect(page.locator('.scenario')).toHaveCount(3);
  await page.locator('#tab-location').click();await country(page,'SG');
  await expect(page.locator('#latitude')).toHaveValue('');await expect(page.locator('#evidence-output')).toBeEmpty();
  await expect(page.locator('.scenario')).toHaveCount(0);await expect(page.locator('#compare')).toBeDisabled();
});

test('missing coordinates and a failed data request have visible validation and working retry',async({page,context})=>{
  await page.locator('#flow-next').click();await expect(page.locator('#latitude')).toBeFocused();
  await expect(page.locator('#location')).toBeVisible();await selectPoint(page);
  const pattern=/power\.larc\.nasa\.gov\/api\/temporal\/daily|\/api\/observations\?/;
  await context.route(pattern,route=>route.abort('failed'));
  await page.locator('#flow-next').click();
  await expect(page.locator('#evidence-status')).toHaveClass(/error/,{timeout:45_000});
  await expect(page.locator('#evidence-status')).toBeInViewport();
  await expect(page.locator('#retry-evidence')).toBeVisible();await expect(page.locator('#compare')).toBeDisabled();
  await expect(page.locator('#evidence-output')).toBeEmpty();await expect(page.locator('.scenario')).toHaveCount(0);
  await context.unroute(pattern);await page.locator('#retry-evidence').click();await evidenceReady(page);
  await expect(page.locator('#retry-evidence')).toBeHidden();
});

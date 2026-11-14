// Executes the supplied plan's questions against the actual UI. No synthetic
// measurements are injected. Known product failures stay FAIL and make this exit 1.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { openChrome } from './chrome.js';
import { buildBrowser } from './build-browser.js';
import { createStaticPreview } from './static-preview.js';
import { catalog } from '../server/agronomy/catalog.js';
import { getCountryCrops } from '../server/context/crops.js';
import { gradePrompt } from './qa-assertions.js';
import { renderQaReport } from './qa-report.js';

const plan = JSON.parse(await readFile('tests/qa/prompts.json', 'utf8'));
assert.deepEqual(plan.cases.map(item=>item.id),Array.from({length:16},(_,i)=>`Q${String(i+1).padStart(2,'0')}`),'Every question Q01–Q16 must be present exactly once');
const suppliedPlan = await readFile(plan.source,'utf8');
for (const item of plan.cases) {
  const row = suppliedPlan.split(/\r?\n/).find(line=>line.startsWith('| '+item.id+' | '));
  assert.ok(row?.includes('`'+item.prompt+'`') && row.includes(item.expected),`Fixture must preserve the supplied ${item.id} question and expectation`);
}
const results = [], reviews = [];
let browser, app, base = process.env.TEST_BASE_URL, cleanupError;
const profileRoot = await realpath(tmpdir());
const profile = await mkdtemp(path.join(profileRoot, 'fieldshift-qa-'));
const reportDirectory = path.resolve(process.env.QA_REPORT_DIR ?? 'artifacts/qa');
await mkdir(reportDirectory, { recursive: true });
const record = result => { results.push(result); console.log(`${result.status}: ${result.id} ${result.title}`); };
const review = (id, question, answer, status = 'PASS', evidence = {}) => reviews.push({ id, question, answer, status, evidence });
try {
  if (base) {
    const target = new URL(base);
    if (target.protocol !== 'https:') throw new Error('TEST_BASE_URL must be an HTTPS origin.');
    base = target.origin;
  } else {
    await buildBrowser(); app = createStaticPreview(); app.listen(0, '127.0.0.1'); await once(app, 'listening');
    base = `http://127.0.0.1:${app.address().port}`;
  }
  browser = await openChrome({ profileDirectory: profile });
  const { call, evaluate, waitFor } = browser;
  await call('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
  await call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  const fill = (id, value) => evaluate(`(() => { const node=document.getElementById(${JSON.stringify(id)});node.value=${JSON.stringify(value)};node.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  const navigate = async () => {
    await call('Page.navigate', { url: base });
    await waitFor('document.querySelector("#catalog-status").textContent.startsWith("Choose a country")');
  };
  const country = async code => {
    await evaluate(`document.querySelector('#pest-country').value=${JSON.stringify(code)};document.querySelector('#pest-country').dispatchEvent(new Event('change',{bubbles:true}));`);
    await waitFor(`document.querySelector('#country-status').textContent.includes('crop production categories') && document.querySelector('#pest-country').value===${JSON.stringify(code)} && !document.querySelector('#place-region').disabled`);
  };
  const openChat = async () => {
    await evaluate(`if(document.querySelector('#chat-panel').hidden)document.querySelector('#chat-toggle').click();document.querySelector('#unload-model').click();`);
  };
  const answer = async question => {
    await fill('question', question);
    await evaluate(`document.querySelector('#question-form').requestSubmit()`);
    await waitFor(`!document.querySelector('#ask').disabled && document.querySelector('#answer-status').textContent.startsWith('Answer ready')`, 90_000);
    return evaluate(`(() => { const last=document.querySelector('#chat-history article:last-child');return {
      paragraphs:[...last.querySelectorAll(':scope > p')].map(node=>node.textContent),
      links:[...last.querySelectorAll('a')].map(node=>({title:node.textContent,url:node.href})),
      buttons:[...last.querySelectorAll('button')].map(node=>node.textContent),
      state:{country:document.querySelector('#pest-country').value,latitude:document.querySelector('#latitude').value,longitude:document.querySelector('#longitude').value,
        scenarios:document.querySelectorAll('.scenario').length,evidenceElements:document.querySelector('#evidence-output').children.length}
    }; })()`);
  };
  const flow = async (id, title, task) => {
    try { const evidence = await task(); record({ id, title, status: 'PASS', evidence }); return evidence; }
    catch (error) { record({ id, title, status: 'FAIL', error: error.message }); return null; }
  };

  review('R01', 'Is this a limited four-crop screening prototype or a global crop recommender?',
    `The catalog contains ${catalog.crops.length} screening crops: ${catalog.crops.map(c=>c.name).join(', ')}. Its declared scope is: ${catalog.scope.replace(/\.$/,'')}. This supports describing it as a limited screening prototype; global map access is not global agronomic validation.`,
    catalog.crops.length === 4 && /not.*globally validated/i.test(catalog.scope) ? 'PASS' : 'FAIL');
  const coverage = Object.fromEntries(['SG','IN','AU','BR'].map(code=>[code,getCountryCrops({country:code}).screeningCropIds]));
  review('R02', 'Can the demo country generate valid alternatives?',
    `Saved screening coverage: ${Object.entries(coverage).map(([code,ids])=>`${code}: ${ids.length} (${ids.join(', ') || 'none'})`).join('; ')}. Australia and India have at least two screened choices; Singapore and Brazil do not. F01/F03 check the actual UI behavior.`, 'PASS', coverage);

  const au = await flow('F01', 'Australia end-to-end with real NASA evidence', async () => {
    await navigate();
    await evaluate(`document.querySelector('#example-location').value='-31.89,116.77';document.querySelector('#example-location').dispatchEvent(new Event('change',{bubbles:true}));`);
    await waitFor(`document.querySelector('#catalog-status').textContent.startsWith('Australia:')`);
    await evaluate(`document.querySelector('#load-evidence').click()`);
    await waitFor(`document.querySelector('#evidence-status').textContent.startsWith('Historical evidence loaded')`, 45_000);
    const evidence = await evaluate(`({text:document.querySelector('#evidence-output').innerText,url:document.querySelector('#evidence-output a').href,
      rows:[...document.querySelector('#evidence-output table:first-of-type tbody').rows].map(row=>row.innerText)})`);
    assert.equal(new URL(evidence.url).hostname, 'power.larc.nasa.gov');
    assert.match(evidence.text, /Retrieved directly from NASA in this browser/);
    assert.equal(evidence.rows.length, 5);
    review('R04', 'Is real NASA POWER accessible to a fresh browser user, including CORS?',
      `${base.startsWith('https:') ? 'Yes on the public origin in this run' : 'Verified on the local preview only; public-origin CORS still requires TEST_BASE_URL'}: a fresh isolated browser profile loaded the actual POWER response through the app worker; rendered metadata reports direct retrieval, units and its exact source URL. This is one observed run, not an availability guarantee.`, base.startsWith('https:') ? 'PASS' : 'BLOCKED', evidence);
    review('R06', 'Does the app falsely claim NASA soil-moisture or vegetation readings?',
      'The rendered NASA table has five POWER weather/solar parameters and explicitly says soil moisture and vegetation are not measured by this integration. No SMAP/NDVI field reading is displayed.',
      /soil moisture.*vegetation.*not measured/is.test(evidence.text) && !evidence.rows.some(row=>/NDVI|SMAP|soil moisture/i.test(row)) ? 'PASS' : 'FAIL', { parameters: evidence.rows });
    await evaluate(`document.querySelector('#tab-si').click()`);
    const intro = await evaluate(`document.querySelector('#si').innerText`);
    review('R03', 'Are fixed slots and the historical-year limitation visible before comparison?',
      `Before pressing Compare, the planning panel stated: ${intro.match(/Plan one field[^\n]+/)?.[0] ?? 'planning introduction missing'}. The evidence panel stated: ${evidence.text.match(/Historical regional estimates[^\n]+/)?.[0] ?? 'historical-scope notice missing'}.`,
      /12 months.*four.month/is.test(intro) && /historical.*not.*forecast/is.test(evidence.text) ? 'PASS' : 'FAIL', { planningIntroduction: intro.split('\n').slice(0,8).join('\n'), historicalScope: evidence.text.match(/Historical regional estimates[^\n]+/)?.[0] });
    for (const [id,value] of [['baseline-1','sweet-corn'],['baseline-2','pea'],['baseline-3','bush-bean']]) await fill(id,value);
    await evaluate(`document.querySelector('#compare').click()`);
    await waitFor(`document.querySelectorAll('.scenario').length===3`);
    const comparison = await evaluate(`({slots:document.querySelectorAll('.timeline>li').length,baseline:[...document.querySelector('.timeline').children].map(node=>node.querySelector('h4').textContent),sequences:[...document.querySelectorAll('.timeline')].map(timeline=>[...timeline.querySelectorAll('h4')].map(node=>node.textContent).join(' → ')),text:document.querySelector('#strategy-output').innerText})`);
    assert.equal(comparison.slots, 9);
    assert.equal(new Set(comparison.sequences).size, 3);
    assert.deepEqual(comparison.baseline, ['1. Sweet corn','2. Garden pea','3. Bush snap bean']);
    assert.match(comparison.text,/14 days|turnaround: 14/);
    assert.match(comparison.text,/uncertainty|High.*local agronomic validation/is);
    return { ...evidence, comparison };
  });
  if (!au) {
    for (const id of ['R03','R04','R06']) if (!reviews.some(result=>result.id===id)) review(id, 'Live evidence-dependent review', 'F01 did not finish; current live behavior could not be verified.', 'BLOCKED');
  }
  await flow('F04', 'Changing Australia to India invalidates the previous point, weather and comparison', async () => {
    assert.ok(au, 'F01 must establish an Australia comparison first');
    await country('IN');
    const state = await evaluate(`({point:document.querySelector('#latitude').value,weather:document.querySelector('#evidence-output').children.length,scenarios:document.querySelectorAll('.scenario').length,disabled:document.querySelector('#compare').disabled})`);
    assert.deepEqual(state, { point:'', weather:0, scenarios:0, disabled:true }); return state;
  });
  await flow('F03', 'Singapore reports missing screening coverage without a fake comparison', async () => {
    await country('SG');
    const state = await evaluate(`({text:document.querySelector('#catalog-status').textContent,choices:document.querySelectorAll('[name=allowedCrops]').length,disabled:document.querySelector('#compare').disabled,scenarios:document.querySelectorAll('.scenario').length})`);
    assert.equal(state.choices,0); assert.equal(state.disabled,true); assert.equal(state.scenarios,0); assert.match(state.text,/insufficient screening coverage/); return state;
  });
  await flow('F05', 'Blocked NASA request gives an honest error and a successful real-data retry', async () => {
    const sessionId = browser.events.filter(event=>event.method==='Target.attachedToTarget' && event.params.targetInfo.url.includes('core-worker.bundle.js')).at(-1)?.params.sessionId;
    assert.ok(sessionId, 'The actual browser data worker must be identified');
    await call('Network.enable', {}, sessionId);
    await call('Network.setBlockedURLs', { urls:['*power.larc.nasa.gov*'] }, sessionId);
    try {
      await evaluate(`document.querySelector('#example-location').value='-31.89,116.77';document.querySelector('#example-location').dispatchEvent(new Event('change',{bubbles:true}));`);
      await waitFor(`document.querySelector('#catalog-status').textContent.startsWith('Australia:')`);
      await fill('reference-year', String(new Date().getUTCFullYear()-2));
      await evaluate(`document.querySelector('#load-evidence').click()`);
      await waitFor(`document.querySelector('#evidence-status').classList.contains('error')`,45_000);
      assert.equal(await evaluate(`document.querySelector('#compare').disabled && document.querySelectorAll('.scenario').length===0`),true);
    } finally { await call('Network.setBlockedURLs', { urls:[] }, sessionId); }
    const error = await evaluate(`document.querySelector('#evidence-status').textContent`);
    await evaluate(`document.querySelector('#load-evidence').click()`);
    await waitFor(`document.querySelector('#evidence-status').textContent.startsWith('Historical evidence loaded')`,45_000);
    return { error, retry: await evaluate(`document.querySelector('#evidence-output').innerText.slice(0,600)`) };
  });

  for (const item of plan.cases) {
    try {
      await navigate(); await openChat();
      if (item.id === 'Q05') await answer(plan.cases.find(item=>item.id==='Q04').prompt);
      if (['Q08','Q09'].includes(item.id)) await answer(plan.cases.find(item=>item.id==='Q07').prompt);
      const actual = await answer(item.prompt);
      if (item.id === 'Q07') {
        await answer('at 18.5204, 73.8567');
        actual.followUp = await evaluate(`({retainedBaseline:JSON.stringify([1,2,3].map(i=>document.querySelector('#baseline-'+i).value))===JSON.stringify(['unassessed:fao-27','unassessed:fao-15','bush-bean']),irrigation:document.querySelector('#irrigation').value,unsupportedBaseline:/Rice.*unknown.*Wheat.*unknown/s.test(document.querySelector('.scenario')?.textContent??'')})`);
      }
      const checks = gradePrompt(item.id,actual);
      record({ id:item.id,title:item.prompt,prompt:item.prompt,context:item.context,expected:item.expected,actual,checks,status:checks.every(check=>check.passed)?'PASS':'FAIL' });
    } catch (error) { record({ id:item.id,title:item.prompt,prompt:item.prompt,context:item.context,expected:item.expected,status:'BLOCKED',error:error.message }); }
  }
  for (const [id,questionId] of [['F02','Q07'],['F06','Q02']]) {
    const question = results.find(result=>result.id===questionId);
    record({ id,title:id==='F02'?'India common crops stay unassessed through the guided flow':'Asking what to grow without selecting a farm',status:question.status,evidence:{questionId,checks:question.checks},error:question.error });
  }
  const critical = results.filter(result=>['Q02','Q07','Q11','Q14'].includes(result.id));
  review('R05','Does the assistant overstate its capability on Q02/Q07/Q11/Q14?',
    critical.every(result=>result.status==='PASS')?'All four explicit automated criteria passed. This does not establish general agronomic accuracy.':`The following questions did not meet the explicit criteria: ${critical.filter(result=>result.status!=='PASS').map(result=>result.id).join(', ')}. Read their actual replies; missing an explicit limitation is distinct from inventing a number.`,
    critical.every(result=>result.status==='PASS')?'PASS':'FAIL');
  review('R07','Has the team submitted through NASA’s portal?',
    'Not verified. Hosting a demo or generating a deck does not prove submission. The team owner must check the authenticated NASA portal; this test does not submit forms or make eligibility declarations.','BLOCKED');
} catch (error) { record({ id:'HARNESS',title:'QA runner initialization',status:'BLOCKED',error:error.message }); }
finally {
  await browser?.close();
  if (app) await new Promise(resolve=>app.close(resolve));
  // Only this invocation's newly created, resolved temp directory can be removed.
  try {
    const target = await realpath(profile);
    if (path.dirname(target)!==profileRoot || !path.basename(target).startsWith('fieldshift-qa-')) throw new Error('Temporary profile escaped its intended root');
    await rm(target,{recursive:true,force:true,maxRetries:8,retryDelay:150});
  } catch (error) { cleanupError=error.message; }
}
const counts = items => Object.fromEntries(['PASS','FAIL','BLOCKED'].map(status=>[status,items.filter(result=>result.status===status).length]));
const summary = { ...counts(results), flows:counts(results.filter(result=>/^F\d/.test(result.id))), prompts:counts(results.filter(result=>/^Q\d/.test(result.id))), reviews:counts(reviews) };
const report = { checkedAt:new Date().toISOString(),origin:base,sourcePlan:plan.source,sourcePlanSha256:plan.sourceSha256,
  mode:'Actual browser UI, deterministic evidence mode; real providers, no synthetic NASA readings',
  summary,profileCleanup:{removed:!cleanupError,error:cleanupError},reviews,results,
  limitations:['Explicit automated assertions, not an LLM judge or agronomic accuracy score.','One installed Chrome browser and one observed provider-availability run.','Portal submission, farmer validation and real-device usability are not inferred.'] };
await writeFile(path.join(reportDirectory,'results.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(reportDirectory,'results.md'),renderQaReport(report));
console.log(`QA report: ${path.join(reportDirectory,'results.md')} — ${summary.PASS} PASS / ${summary.FAIL} FAIL / ${summary.BLOCKED} BLOCKED`);
if (summary.FAIL || summary.BLOCKED || cleanupError || reviews.some(result=>result.status==='FAIL')) process.exitCode=1;

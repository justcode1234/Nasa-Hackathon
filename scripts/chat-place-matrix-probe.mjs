// Real-browser walk of the guided place step for EVERY supported country code (the 245 with a saved place
// list and the 5 without one): type the country, ask for a specific area, then only tap what the assistant
// offers until the plan carries a point. This is the browser counterpart of tests/matrix-coverage.test.js —
// the offline suite proves the rules, this proves the buttons render, are clickable and put the saved
// coordinates into the form a farmer would submit.
// Field lookups are blocked on purpose: a shared public Overpass outage is not a chat defect, and the
// point is set before any field request runs.
// Run it with: npm run test:chat-matrix (serves the built app itself if PROBE_PORT is free, and refuses a
// bundle older than public/ or server/).
import { chromium } from '@playwright/test';
import { listCountries, locations } from '../tests/helpers/matrix-harness.js';
import { COUNTRY_CODES, COUNTRY_NAMES } from '../public/js/lib/countries.js';
import { startProbeApp } from './lib/probe-app.mjs';

const { base, close: closeApp } = await startProbeApp();
const fields = /overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru/;
const workers = Number(process.env.PROBE_WORKERS ?? 3);
const saved = new Map();
for (const code of listCountries) saved.set(code, await locations({ country: code }));

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function walk(code) {
  const countryName = COUNTRY_NAMES.of(code);
  const list = saved.get(code);
  const outcome = { code, countryName, steps: [], pageErrors: [] };
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.route(fields, route => route.abort('failed'));
  const page = await context.newPage();
  page.on('pageerror', error => outcome.pageErrors.push(error.message));
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Open FieldShift assistant', exact: true }).click();
    const ready = () => page.waitForFunction(() => /Answer ready|Step 4 is ready|Error|could not|failed|unavailable/i
      .test(document.querySelector('#answer-status').textContent), { timeout: 180_000 }).catch(() => {});
    const read = async () => ({
      reply: (await page.locator('#chat-history article').last()
        .evaluate(node => [...node.querySelectorAll(':scope > p')].map(p => p.textContent).join(' '))).trim(),
      buttons: (await page.locator('#chat-history article').last().locator('button[data-chat-choice]').allTextContents()).map(b => b.trim()),
      choices: await page.locator('#chat-history article').last().locator('button[data-chat-choice]')
        .evaluateAll(nodes => nodes.map(node => ({ label: node.textContent.trim(), type: node.dataset.choiceType ?? '' }))),
      latitude: await page.locator('#latitude').inputValue().catch(() => ''),
      longitude: await page.locator('#longitude').inputValue().catch(() => ''),
      // The app stamps the render time of each answer; the walk records it so the guided place step’s
      // responsiveness is measured over every country instead of asserted from one benchmark machine.
      answerMs: await page.evaluate(() => window.fieldshiftAnswerLatencyMs ?? null).catch(() => null),
    });
    const send = async text => { await page.locator('#question').fill(text); await page.getByRole('button', { name: 'Send', exact: true }).click(); await ready(); return read(); };
    const tap = async label => {
      const button = page.locator('#chat-history article').last().locator('button[data-chat-choice]').filter({ hasText: label });
      if (!(await button.count())) return null;
      await button.first().click(); await ready(); return read();
    };
    const greeting = await send(`Help me plan a rotation in ${countryName}`);
    outcome.firstAnswerMs = greeting.answerMs;
    const area = await tap('A specific area') ?? await send('A specific area');
    outcome.steps.push({ ask: 'A specific area', reply: area.reply.slice(0, 80), buttons: area.buttons.length, answerMs: area.answerMs });
    let current = area;
    // A duplicated town wording carries its saved coordinates, so the tap must use the button exactly as
    // rendered while the lookup uses the plain name beneath it.
    const plain = label => label.split(' · ')[0];
    // Each choice button carries the level the app asked for (region or town), so a spelling that is both
    // a region and a town — "Andorra la Vella", the city of Buenos Aires — no longer has to be resolved by
    // parsing the sentence. The prose is only a fallback for a button that carries no type.
    const asksRegion = reply => /Which state or region of /i.test(reply);
    const asksTown = reply => /Which town in |Now choose a town |first three towns/i.test(reply);
    const kindOf = state => {
      const types = new Set((state.choices ?? []).map(choice => choice.type).filter(Boolean));
      if (types.has('town') && !types.has('region')) return 'town';
      if (types.has('region') && !types.has('town')) return 'region';
      return asksRegion(state.reply) ? 'region' : asksTown(state.reply) ? 'town' : 'town';
    };
    // Tap by position rather than by text: one town name can sit inside another button's wording.
    const tapIndex = async index => {
      const button = page.locator('#chat-history article').last().locator('button[data-chat-choice]').nth(index);
      if (!(await button.count())) return null;
      await button.click(); await ready(); return read();
    };
    // The first saved row the reply actually offers at the asked level, together with its button position.
    const offered = (state, rows, kind) => {
      for (const row of rows) {
        const at = (state.choices ?? []).findIndex(choice => plain(choice.label) === row.name && choice.type === kind);
        if (at >= 0) return { row, at, label: state.choices[at].label };
      }
      return null;
    };
    // Region first when the list has regions, then a town. Bounded at five taps so a cycle is reported
    // as a defect instead of hanging the walk.
    if (!saved.has(code)) {
      // Five supported codes (AQ BV HM IO UM) have no saved place list, so there is no town to tap and a
      // point is the wrong requirement. The honest terminal state is the whole-country reply still being
      // offered and still naming the level that is missing.
      const at = (current.choices ?? []).findIndex(choice => /^Whole\s+\S/.test(choice.label));
      outcome.status = at < 0 ? 'listless-without-whole-country' : undefined;
      if (at >= 0) {
        current = await tapIndex(at);
        outcome.steps.push({ ask: current?.buttons.length ? 'Whole country' : '(no reply)', kind: 'country', reply: current?.reply.slice(0, 70) ?? '', buttons: current?.buttons.length ?? 0, answerMs: current?.answerMs ?? null });
        const explained = Boolean(current?.reply) && /no towns|no named regions|not listed|no place list|coordinate/i.test(current.reply);
        outcome.status = current?.buttons.length && explained ? 'listless-whole-country' : 'listless-unexplained';
        outcome.lastReply = current?.reply.slice(0, 110) ?? '';
      }
      outcome.taps = outcome.steps.length - 1;
      await context.close();
      return outcome;
    }
    for (let step = 0; step < 5 && current && !outcome.point; step++) {
      if (!current.buttons.length) { outcome.status = 'buttonless'; outcome.lastReply = current.reply.slice(0, 90); break; }
      const kind = kindOf(current);
      const other = kind === 'town' ? 'region' : 'town';
      const rowsFor = level => level === 'town' ? list.places : list.regions.filter(row => row.name);
      // Nothing at the asked level is offered only when both levels come up empty, so the walk retries the
      // other level before calling it a defect.
      const hit = offered(current, rowsFor(kind), kind) ?? offered(current, rowsFor(other), other);
      const chosenKind = hit && offered(current, rowsFor(kind), kind) ? kind : other;
      if (!hit) { outcome.status = 'no-offered-name'; outcome.lastReply = current.reply.slice(0, 90); outcome.lastButtons = current.buttons.join(' | ').slice(0, 160); break; }
      current = await tapIndex(hit.at);
      if (!current) { outcome.status = 'tap-vanished'; outcome.tapped = hit.label; break; }
      outcome.steps.push({ ask: hit.label, kind: chosenKind, reply: current.reply.slice(0, 70), buttons: current.buttons.length, answerMs: current.answerMs });
      if (chosenKind !== 'town') continue;
      // Both coordinates must match one saved row: two towns can share a name, a region and a rounded
      // latitude, and the point the farmer submits is the pair, not one axis.
      if (current.latitude === '' || current.longitude === '') { outcome.status = 'town-tapped-without-a-point'; outcome.lastReply = current.reply.slice(0, 90); break; }
      const pointRow = list.places.find(place => place.name === hit.row.name &&
        Math.abs(Number(current.latitude) - Number(place.latitude)) < 1e-4 &&
        Math.abs(Number(current.longitude) - Number(place.longitude)) < 1e-4);
      outcome.latitude = current.latitude;
      outcome.longitude = current.longitude;
      outcome.town = hit.label;
      outcome.point = Boolean(pointRow);
      outcome.status = pointRow ? 'point' : 'point-from-another-row';
      if (!pointRow) outcome.savedForName = list.places.filter(each => each.name === hit.row.name)
        .map(each => `${each.latitude}, ${each.longitude}`).join(' | ');
    }
    outcome.status ??= 'no-point-in-five-taps';
    outcome.taps = outcome.steps.length - 1;
  } catch (error) { outcome.status = 'crash'; outcome.crash = String(error.message).slice(0, 140); }
  outcome.pageErrors = outcome.pageErrors ?? [];
  await context.close();
  return outcome;
}

// A list walks to a saved town point; a code without one walks to the explained whole-country reply.
const terminal = row => (saved.has(row.code) ? row.status === 'point' : row.status === 'listless-whole-country');
const queue = (process.env.PROBE_CODES ? process.env.PROBE_CODES.split(/[,\s]+/).filter(Boolean)
  // Every supported code, not only the 245 with a saved list: the 5 without one are the ones a walk had
  // never entered, and that is where the earlier dead ends lived.
  : [...listCountries, ...COUNTRY_CODES.filter(code => !saved.has(code))]), outcomes = [];
async function run() {
  for (;;) {
    const next = queue.shift();
    if (next === undefined) return;
    const outcome = await walk(next);
    outcomes.push(outcome);
    if (!terminal(outcome)) console.log(`DEFECT ${outcome.code}: ${JSON.stringify(outcome).slice(0, 520)}`);
    else console.log(`ok ${outcome.code}: ${outcome.taps} taps → ${outcome.town ?? 'Whole country route'}${outcome.latitude ? ` @ ${outcome.latitude}` : ''}`);
  }
}
await Promise.all(Array.from({ length: workers }, run));
await browser.close();
await closeApp();

const bad = outcomes.filter(row => !terminal(row) || row.pageErrors.length);
const counts = outcomes.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] ?? 0) + 1 }), {});
// Percentiles alone cannot be acted on, so the same samples keep the step they came from: the slowest
// entries name the country and the question that took that long.
const samples = outcomes.flatMap(row => [...row.steps.map(step => ({ code: row.code, ask: step.ask, ms: step.answerMs })),
  { code: row.code, ask: 'first question', ms: row.firstAnswerMs }]).filter(each => typeof each.ms === 'number' && each.ms >= 0);
const latencies = samples.map(each => each.ms).sort((a, b) => a - b);
const percentile = q => latencies.length ? latencies[Math.min(latencies.length - 1, Math.round(q * (latencies.length - 1)))] : null;
const slowest = [...samples].sort((a, b) => b.ms - a.ms).slice(0, 6).map(each => ({ ...each, ms: Math.round(each.ms) }));
console.log(JSON.stringify({
  cases: outcomes.length, codes: COUNTRY_CODES.length, lists: listCountries.length, concurrency: workers,
  pointsSet: outcomes.filter(row => row.status === 'point').length,
  listlessExplanations: outcomes.filter(row => row.status === 'listless-whole-country').length,
  pageErrors: outcomes.reduce((n, row) => n + row.pageErrors.length, 0),
  answerLatencyMs: { samples: latencies.length, p50: Math.round(percentile(0.5) ?? -1), p95: Math.round(percentile(0.95) ?? -1),
    max: Math.round(latencies.at(-1) ?? -1), slowest },
  statuses: counts, defects: bad.length
}, null, 1));
if (bad.length) process.exitCode = 1;

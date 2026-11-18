// Real-browser walk of the guided place step for EVERY saved country list: type the country, ask for a
// specific area, then only tap what the assistant offers until the plan carries a point. This is the
// browser counterpart of tests/matrix-coverage.test.js — the offline suite proves the rules, this proves
// the buttons render, are clickable and put the saved coordinates into the form a farmer would submit.
// Field lookups are blocked on purpose: a shared public Overpass outage is not a chat defect, and the
// point is set before any field request runs.
// Run it against a served app: PROBE_PORT=4575 node scripts/chat-place-matrix-probe.mjs
import { chromium } from '@playwright/test';
import { listCountries, locations } from '../tests/helpers/matrix-harness.js';
import { COUNTRY_NAMES } from '../public/js/lib/countries.js';

const base = `http://127.0.0.1:${process.env.PROBE_PORT ?? 4575}`;
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
      latitude: await page.locator('#latitude').inputValue().catch(() => ''),
    });
    const send = async text => { await page.locator('#question').fill(text); await page.getByRole('button', { name: 'Send', exact: true }).click(); await ready(); return read(); };
    const tap = async label => {
      const button = page.locator('#chat-history article').last().locator('button[data-chat-choice]').filter({ hasText: label });
      if (!(await button.count())) return null;
      await button.first().click(); await ready(); return read();
    };
    await send(`Help me plan a rotation in ${countryName}`);
    const area = await tap('A specific area') ?? await send('A specific area');
    outcome.steps.push({ ask: 'A specific area', reply: area.reply.slice(0, 80), buttons: area.buttons.length });
    let current = area;
    // A duplicated town wording carries its saved coordinates, so the tap must use the button exactly as
    // rendered while the lookup uses the plain name beneath it.
    const plain = label => label.split(' · ')[0];
    const buttonFor = name => current.buttons.find(label => plain(label) === name);
    // The level a reply asks for decides which row a label refers to: "Andorra la Vella" is both a parish
    // and a town, and at the region question the app means the parish.
    const asksRegion = reply => /Which state or region of /i.test(reply);
    const asksTown = reply => /Which town in |Now choose a town |first three towns/i.test(reply);
    // Region first when the list has regions, then a town. Bounded at five taps so a cycle is reported
    // as a defect instead of hanging the walk.
    for (let step = 0; step < 5 && current && !outcome.point; step++) {
      if (!current.buttons.length) { outcome.status = 'buttonless'; outcome.lastReply = current.reply.slice(0, 90); break; }
      const kind = asksRegion(current.reply) ? 'region' : asksTown(current.reply) ? 'town' : 'town';
      const rows = kind === 'town' ? list.places : list.regions.filter(row => row.name);
      const row = rows.find(each => buttonFor(each.name));
      const label = row ? buttonFor(row.name) : null;
      if (!label) {
        // Nothing at the asked level is offered: retry once at the other level before calling it a defect.
        const other = kind === 'town' ? list.regions.filter(r => r.name) : list.places;
        const alt = other.find(each => buttonFor(each.name));
        if (!alt) { outcome.status = 'no-offered-name'; outcome.lastReply = current.reply.slice(0, 90); outcome.lastButtons = current.buttons.join(' | ').slice(0, 160); break; }
        const altLabel = buttonFor(alt.name);
        current = await tap(altLabel);
        outcome.steps.push({ ask: altLabel, kind: kind === 'town' ? 'region' : 'town', reply: current.reply.slice(0, 70), buttons: current.buttons.length });
        continue;
      }
      current = await tap(label);
      outcome.steps.push({ ask: label, kind, reply: current.reply.slice(0, 70), buttons: current.buttons.length });
      if (kind !== 'town') continue;
      if (current.latitude === '') { outcome.status = 'town-tapped-without-a-point'; outcome.lastReply = current.reply.slice(0, 90); break; }
      const pointRow = list.places.find(place => place.name === row.name &&
        Math.abs(Number(current.latitude) - Number(place.latitude)) < 1e-4);
      outcome.latitude = current.latitude;
      outcome.town = label;
      outcome.point = Boolean(pointRow);
      outcome.status = pointRow ? 'point' : 'point-from-another-row';
      if (!pointRow) outcome.savedForName = list.places.filter(each => each.name === row.name).map(each => each.latitude).join(', ');
    }
    outcome.status ??= 'no-point-in-five-taps';
    outcome.taps = outcome.steps.length - 1;
  } catch (error) { outcome.status = 'crash'; outcome.crash = String(error.message).slice(0, 140); }
  outcome.pageErrors = outcome.pageErrors ?? [];
  await context.close();
  return outcome;
}

const queue = (process.env.PROBE_CODES ? process.env.PROBE_CODES.split(/[,\s]+/).filter(Boolean) : listCountries), outcomes = [];
async function run() {
  for (;;) {
    const next = queue.shift();
    if (next === undefined) return;
    const outcome = await walk(next);
    outcomes.push(outcome);
    if (outcome.status !== 'point') console.log(`DEFECT ${outcome.code}: ${JSON.stringify(outcome).slice(0, 520)}`);
    else console.log(`ok ${outcome.code}: ${outcome.taps} taps → ${outcome.town} @ ${outcome.latitude}`);
  }
}
await Promise.all(Array.from({ length: workers }, run));
await browser.close();

const bad = outcomes.filter(row => row.status !== 'point' || row.pageErrors.length);
const counts = outcomes.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] ?? 0) + 1 }), {});
console.log(JSON.stringify({
  cases: outcomes.length, lists: listCountries.length, concurrency: workers,
  pointsSet: outcomes.filter(row => row.status === 'point').length,
  pageErrors: outcomes.reduce((n, row) => n + row.pageErrors.length, 0),
  statuses: counts, defects: bad.length
}, null, 1));
if (bad.length) process.exitCode = 1;

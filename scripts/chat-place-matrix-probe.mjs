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
    // Region first when the list has regions, then a town. Bounded at four taps so a cycle is reported
    // as a defect instead of hanging the walk.
    for (let step = 0; step < 4 && current && !outcome.point; step++) {
      if (!current.buttons.length) { outcome.status = 'buttonless'; outcome.lastReply = current.reply.slice(0, 90); break; }
      const town = list.places.find(place => buttonFor(place.name));
      const region = town ? null : list.regions.find(row => row.name && buttonFor(row.name));
      const name = town?.name ?? region?.name;
      const label = name ? buttonFor(name) : null;
      if (!label) { outcome.status = 'no-offered-name'; outcome.lastReply = current.reply.slice(0, 90); outcome.lastButtons = current.buttons.join(' | ').slice(0, 120); break; }
      current = await tap(label);
      outcome.steps.push({ ask: label, kind: town ? 'town' : 'region', reply: current.reply.slice(0, 80), buttons: current.buttons.length });
      if (!town) continue;
      if (current.latitude === '') { outcome.status = 'town-tapped-without-a-point'; outcome.lastReply = current.reply.slice(0, 90); break; }
      const row = list.places.find(place => place.name === name &&
        Math.abs(Number(current.latitude) - Number(place.latitude)) < 1e-4);
      outcome.latitude = current.latitude;
      outcome.town = label;
      outcome.point = Boolean(row);
      outcome.status = row ? 'point' : 'point-from-another-row';
      if (!row) outcome.savedForName = list.places.filter(place => place.name === name).map(place => place.latitude).join(', ');
    }
    outcome.status ??= 'no-point-in-four-taps';
  } catch (error) { outcome.status = 'crash'; outcome.crash = String(error.message).slice(0, 140); }
  outcome.pageErrors = outcome.pageErrors ?? [];
  await context.close();
  return outcome;
}

const queue = [...listCountries], outcomes = [];
async function run() {
  for (;;) {
    const next = queue.shift();
    if (next === undefined) return;
    const outcome = await walk(next);
    outcomes.push(outcome);
    if (outcome.status !== 'point') console.log(`DEFECT ${outcome.code}: ${JSON.stringify(outcome).slice(0, 300)}`);
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

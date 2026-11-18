// Real-browser evidence for the place-matching rules: (a) a town spelled exactly like its own country is
// typeable once its region is chosen, (b) answering a place question with the country's own name gives an
// honest, different reply with something to tap instead of re-asking itself, and (c) a saved list with no
// region names offers real towns, keeps the whole-country route and stays recoverable after a nonsense
// town. Run it against a served app: PROBE_PORT=4575 node scripts/chat-place-probe.mjs
import { chromium } from '@playwright/test';
import { listCountries, locations } from '../tests/helpers/matrix-harness.js';
import { COUNTRY_NAMES, regionPhrase } from '../public/js/lib/countries.js';

const base = `http://127.0.0.1:${process.env.PROBE_PORT ?? 4575}`;
const fields = /overpass-api\.de|overpass\.private\.coffee|maps\.mail\.ru/;

// Group A: every saved list that holds a town spelled like its own country and also lists regions.
const eponymousTowns = [];
for (const code of listCountries) {
  const list = await locations({ country: code });
  const countryName = COUNTRY_NAMES.of(code);
  const town = list.places.find(place => regionPhrase(place.name) === regionPhrase(countryName));
  const namedRegions = list.regions.filter(region => region.name && regionPhrase(region.name) !== regionPhrase(countryName));
  if (!town || !namedRegions.length) continue;
  const region = list.regions.find(row => row.id === town.regionCode);
  if (region?.name) eponymousTowns.push({ code, countryName, town: town.name, region: region.name, latitude: town.latitude });
}

// Group B: the country-name reply, on ordinary lists, on the long official spelling that exceeds the
// short-reply limit, on a list whose only region row is the country itself, and on a list-less code.
const countryNameReplies = [
  { code: 'FR' }, { code: 'JP' }, { code: 'BR' }, { code: 'DE' }, { code: 'KE' },
  { code: 'GS' }, { code: 'ST' }, { code: 'AQ' },
  // Guadeloupe is the odd one: its only region row really is spelled like the country, so naming the
  // country must select that row rather than refuse. Judged without the “did not select” rule.
  { code: 'GP', selectsARealRow: true }
];

// Group C: every saved list with no region names at all (18 of them). The offline suite drives the same
// production module; this proves the buttons really render and set a point in a browser.
const regionLess = [];
for (const code of listCountries) {
  const list = await locations({ country: code });
  if (list.regions.some(region => region.name)) continue;
  const towns = list.places.slice(0, 3).map(place => ({ name: place.name, latitude: place.latitude, longitude: place.longitude }));
  regionLess.push({ code, countryName: COUNTRY_NAMES.of(code), townCount: list.places.length, towns });
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const outcomes = [];

async function session(countryName) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await context.route(fields, route => route.abort('failed'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
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
  // Scoped to the newest reply, so a tap never falls back onto a button from an earlier question.
  const tap = async label => {
    const button = page.locator('#chat-history article').last().locator('button[data-chat-choice]').filter({ hasText: label });
    if (!(await button.count())) return null;
    await button.first().click(); await ready(); return read();
  };
  // By position rather than by text, so a town whose name is contained in another button cannot be
  // confused with it.
  const tapIndex = async index => {
    const button = page.locator('#chat-history article').last().locator('button[data-chat-choice]').nth(index);
    if (!(await button.count())) return null;
    await button.click(); await ready(); return read();
  };
  await send(`Help me plan a rotation in ${countryName}`);
  return { page, context, errors, send, tap, tapIndex, read, close: () => context.close() };
}

for (const row of eponymousTowns) {
  const s = await session(row.countryName);
  const outcome = { group: 'town spelled like its country', ...row, pageErrors: [] };
  outcomes.push(outcome);
  try {
    await s.send('A specific area');
    const chosenRegion = await s.send(`Use ${row.region}`);
    // Where the region row carries the same spelling, that reply may already mean the town row. What
    // matters is the point the browser ends up with, so both orders are recorded, not assumed.
    outcome.regionReply = chosenRegion.reply.slice(0, 90);
    outcome.townQuestionPending = /Which town/i.test(chosenRegion.reply);
    const typed = chosenRegion.latitude !== '' ? chosenRegion : await s.send(row.town);
    outcome.townReply = typed.reply.slice(0, 90);
    outcome.selectedAsTown = /is selected as a town point/i.test(typed.reply);
    outcome.latitudeFilled = typed.latitude !== '';
    outcome.latitudeMatchesRow = Math.abs(Number(typed.latitude) - Number(row.latitude)) < 0.01;
    outcome.buttons = typed.buttons.length;
  } catch (error) { outcome.crash = String(error.message).slice(0, 140); }
  outcome.pageErrors = s.errors;
  await s.close();
}

for (const { code, selectsARealRow } of countryNameReplies) {
  const countryName = COUNTRY_NAMES.of(code);
  const s = await session(countryName);
  const outcome = { group: 'country name answered at a place question', code, countryName, selectsARealRow: Boolean(selectsARealRow), pageErrors: [] };
  outcomes.push(outcome);
  try {
    const area = await s.tap('A specific area') ?? await s.send('A specific area');
    outcome.pendingReply = area.reply.slice(0, 90);
    outcome.pendingButtons = area.buttons.length;
    const answered = await s.send(countryName);
    outcome.answerReply = answered.reply.slice(0, 110);
    outcome.repeated = answered.reply === area.reply;
    outcome.silent = answered.reply === '';
    outcome.buttonless = answered.buttons.length === 0;
    outcome.claimsSelection = /is selected|selected as a (town|region) point/i.test(answered.reply);
    outcome.latitudeFilled = answered.latitude !== '';
    const first = answered.buttons[0];
    const after = first ? await s.tap(first) : null;
    outcome.tapWorked = Boolean(after) && (after.reply !== answered.reply);
    outcome.afterTapReply = after?.reply.slice(0, 80) ?? '(nothing to tap)';
    outcome.afterTapButtons = after?.buttons.length ?? 0;
  } catch (error) { outcome.crash = String(error.message).slice(0, 140); }
  outcome.pageErrors = s.errors;
  await s.close();
}

// Group C: the region-less lists in a real browser. The area question must explain that no region is
// needed, offer towns the saved list really holds, keep the whole-country route, survive a nonsense
// town with something to tap, and put the tapped town's own coordinates on the plan.
for (const row of regionLess) {
  const s = await session(row.countryName);
  const outcome = { group: 'region-less area prompt', ...row, pageErrors: [] };
  outcomes.push(outcome);
  try {
    const area = await s.tap('A specific area') ?? await s.send('A specific area');
    outcome.areaReply = area.reply.slice(0, 110);
    outcome.areaButtons = area.buttons;
    outcome.saysNoRegions = /no named regions/i.test(area.reply);
    outcome.saysNotAdvice = /not a recommendation/i.test(area.reply);
    outcome.offersSavedTown = row.towns.some(town => area.buttons.includes(town.name));
    // The app words the whole-country button with its own runtime's Intl spelling, which is not always the
    // spelling this probe process prints (Chrome says "Falkland Islands (Islas Malvinas)", Node says
    // "Falkland Islands"), so the route is checked by shape and its actual label is kept as evidence.
    outcome.wholeCountryButton = area.buttons.find(label => /^Whole\s+\S/.test(label)) ?? null;
    outcome.offersWholeCountry = Boolean(outcome.wholeCountryButton);
    const noise = await s.send('Zzyzxvale');
    outcome.noiseReply = noise.reply.slice(0, 90);
    outcome.noiseButtons = noise.buttons.length;
    const town = row.towns.find(each => noise.buttons.includes(each.name)) ?? row.towns[0];
    const index = noise.buttons.indexOf(town.name);
    const chosen = index >= 0 ? await s.tapIndex(index) : await s.send(town.name);
    outcome.via = index >= 0 ? 'button' : 'typed';
    outcome.town = town.name;
    outcome.townReply = chosen.reply.slice(0, 90);
    outcome.selectedAsTown = /is selected as a town point/i.test(chosen.reply);
    outcome.latitude = chosen.latitude;
    outcome.latitudeMatchesRow = chosen.latitude !== '' && Math.abs(Number(chosen.latitude) - Number(town.latitude)) < 0.01;
  } catch (error) { outcome.crash = String(error.message).slice(0, 140); }
  outcome.pageErrors = s.errors;
  await s.close();
}

await browser.close();
const fail = row => Boolean(row.crash) || row.pageErrors.length > 0 ||
  (row.group === 'town spelled like its country' && !(row.latitudeFilled && row.latitudeMatchesRow)) ||
  (row.group === 'country name answered at a place question' && (row.silent || row.repeated || row.buttonless ||
    (!row.selectsARealRow && (row.claimsSelection || row.latitudeFilled)) || !row.tapWorked)) ||
  (row.group === 'region-less area prompt' && (!row.saysNoRegions || !row.saysNotAdvice || !row.offersWholeCountry ||
    (row.townCount > 0 && !row.offersSavedTown) || row.noiseButtons === 0 ||
    !(row.latitudeMatchesRow && row.selectedAsTown)));
const failures = outcomes.filter(fail);
console.log(JSON.stringify({
  cases: outcomes.length,
  eponymousTownCases: eponymousTowns.length,
  countryNameCases: countryNameReplies.length,
  regionLessCases: regionLess.length,
  failures: failures.length,
  pageErrors: outcomes.reduce((n, row) => n + row.pageErrors.length, 0),
  townsSelectedAsTownPoints: outcomes.filter(row => row.selectedAsTown).length,
  honestReplies: outcomes.filter(row => row.group === 'country name answered at a place question' && !fail(row)).length
}, null, 1));
if (failures.length) console.log(failures.map(row => JSON.stringify(row, null, 1)).join('\n'));
for (const row of outcomes) console.log(`${row.group} ${row.code}: ${JSON.stringify(row).slice(0, 420)}`);
if (failures.length) process.exitCode = 1;

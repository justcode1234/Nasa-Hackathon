import {test,expect} from '@playwright/test';
import {createLocationClient} from '../../server/context/locations.js';

// Measured 20 Nov offline (docs/evidence/review-goals-place-list-2026-11-20.log.gz) and reproduced here on the real
// page over both transports: the assistant read the country's saved place list inside `catch { listed = null }`, and
// every sentence below that read describes what the list *holds* — so a list that never answered was reported as
// "No towns are listed for India in this saved place list", the same wording a list that answered with no rows
// produces, for a file that holds 6,595 Indian towns. Iteration 58 closed that class for the field lookup
// (validation.md subsection 58); this is the place half, and the pair that makes it a classification rather than a
// blanket refusal is an unreadable source shape, which a second request cannot repair and so gets no retry button.
//
// The two transports are cut where each one actually reads: the static worker fetches
// /data/locations/<CC>.json itself, so refusing that file is the real failure and the worker's own adapter turns it
// into the authored 503; the node transport reads the same file from disk inside /api/locations, which no page-side
// route can reach, so its refusal is answered at the API boundary with the body the server writes. That body is not
// typed out here: it is produced by calling the shipped adapter with a failing reader and serialising what it
// throws the way server/index.js:71 does, so this spec cannot drift from the sentence the server really sends.
const lists = /\/api\/locations\?|\/data\/locations\//;
const ready = async page => { await expect(page.locator('#answer-status')).toContainText(/Answer ready|Step 4 is ready|Error|could not|unavailable|invalid source/i, { timeout: 60_000 }); };
const last = page => page.locator('#chat-history article').last();
const replyText = async page => (await last(page).evaluate(node => [...node.querySelectorAll(':scope > p')].map(p => p.textContent).join(' '))).trim();
const choices = page => last(page).locator('button[data-chat-choice]');
const labels = async page => (await choices(page).allTextContents()).map(label => label.trim());
const send = async (page, question) => { await page.locator('#question').fill(question); await page.getByRole('button', { name: 'Send', exact: true }).click(); await ready(page); };
const tap = async (page, label) => { await choices(page).filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).click(); await ready(page); };

// The two authored refusals, taken from the shipped adapter rather than restated here.
async function authoredFailure(readJson) {
  const client = createLocationClient({ readJson });
  const error = await client({ country: 'IN' }).then(() => { throw new Error('the fixture read was expected to fail'); }, reason => reason);
  expect(error.status, 'a refusal the page is meant to classify has to carry a status').toEqual(503);
  return { status: error.status, body: { error: { code: error.code, message: error.message } } };
}

test.describe('a country place list that cannot be read', () => {
  test('is reported as a failed read, keeps the country, and answers with its regions once the retry gets through', async ({ page, context }, info) => {
    test.setTimeout(240_000);
    const errors = [], counts = { refused: 0, answered: 0 }, seen = new Set();
    const unavailable = await authoredFailure(async name => { throw new Error(`HTTP 503 ${name}`); });
    let mode = 'refused';
    page.on('pageerror', error => errors.push(error.message));
    await context.route(lists, async route => {
      const url = route.request().url();
      counts[mode]++; seen.add(url.replace(/^https?:\/\/[^/]+/, ''));
      if (mode === 'refused') return url.includes('/api/locations') ? route.fulfill({ ...unavailable, contentType: 'application/json', body: JSON.stringify(unavailable.body) }) : route.abort('failed');
      return route.continue();
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#catalog-status')).toContainText('Choose a country');
    await page.getByRole('button', { name: 'Open FieldShift assistant', exact: true }).click();
    await send(page, 'Help me plan a rotation in India. Crops: tomato, cabbage, bulb onion.');
    expect(counts.refused, 'the assistant read the saved list, so the refusal below is one it actually received').toBeGreaterThan(0);
    await tap(page, 'A specific area');

    const refused = await replyText(page);
    expect(refused, 'a read that never completed says which lookup failed').toMatch(/could not be read just now/);
    expect(refused, 'no conclusion about the list contents may be drawn from a refusal').toMatch(/cannot say which regions or towns it lists/);
    expect(refused, 'nothing may be invented in place of the missing rows').toMatch(/Nothing was selected and nothing was invented/);
    expect(refused, 'both ways on must be named').toMatch(/search a place by name, select a field on the map or enter your farm coordinates/i);
    for (const claim of ['No towns are listed', 'no towns to choose from', 'no named regions', 'is in the saved place list'])
      expect(refused, `a refusal reported as a finding about the data: ${refused}`).not.toContain(claim);
    const afterRefusal = await labels(page);
    expect(afterRefusal, 'the refusal offers a retry').toContain('Try the place list again');
    expect(afterRefusal, 'the refusal keeps the route that needs no saved list').toContain('Whole India');
    expect(await page.locator('#pest-country').inputValue(), 'the country the farmer chose stays selected').toBe('IN');
    expect(await page.locator('#latitude').inputValue(), 'a failed read selects no point').toBe('');
    expect(await page.locator('#location-list-status').textContent(), 'step 1 reports the same failure the chat describes').toMatch(/could not load|no answer came back|busy or unavailable|List unavailable/i);

    // The retry button has to send a second request; a cached refusal would replay the sentence it promises to clear.
    const askedBefore = counts.refused;
    await tap(page, 'Try the place list again');
    expect(counts.refused, 'the retry re-asked instead of replaying the cached failure').toBeGreaterThan(askedBefore);
    expect(await replyText(page), 'a second refusal reads the same way').toMatch(/could not be read just now/);
    mode = 'answered';
    await tap(page, 'Try the place list again');
    const recovered = await replyText(page);
    expect(counts.answered, 'the recovered reply came from a read that answered').toBeGreaterThan(0);
    expect(recovered, 'a list that answered is read by its contents again').toMatch(/Which state or region of India\?/);
    expect(recovered, 'the recovery sentence does not still describe a failed lookup').not.toMatch(/could not be read/);
    const offered = await last(page).locator('button[data-choice-type="region"]').allTextContents();
    expect(offered.length, `the recovered reply offers the region rows the list holds: ${offered.join(' | ')}`).toBeGreaterThan(0);
    const tapped = offered[0].trim();
    await tap(page, tapped);
    const towns = await last(page).locator('button[data-choice-type="town"]').allTextContents();
    expect(await replyText(page), 'a recovered region confirms the selection the tap made')
      .toMatch(new RegExp(`${tapped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} is selected\. Now choose a town`, 'i'));
    expect(towns.length, `the tapped region offered saved towns to tap: ${towns.join(' | ')}`).toBeGreaterThan(0);
    // Measured 20 Nov on the first run of this case: the reply above did not exist yet, because step 1's Region
    // dropdown was still holding the `List unavailable` placeholder from the refused read and `chooseRegion`
    // validated the tapped code against it. The chat had recovered the list; the form had not, and the tap died as
    // `#answer-status` = "Choose a region from the current country list." with no reply and no way on.
    expect(await page.locator('#place-region').inputValue(), 'the tapped region is selected in step 1, not just in the chat')
      .not.toBe('');
    expect(await page.locator('#place-region').inputValue()).not.toBe('__all__');
    expect(await page.locator('#place-town').isDisabled(), 'the recovered region leaves its towns selectable').toBe(false);
    expect(errors, 'page errors while the saved list refused twice and then answered').toEqual([]);
    await info.attach('Refused and recovered place lists', { body: Buffer.from(JSON.stringify({ counts, seen: [...seen], offered, refused, recovered, townReply: await replyText(page) }, null, 2)), contentType: 'application/json' });
  });

  test('an unreadable source shape names its own reason, offers no retry it has ruled out, and fails honestly on the whole-country escape', async ({ page, context }, info) => {
    test.setTimeout(240_000);
    const errors = [], counts = { schema: 0 };
    const unreadable = await authoredFailure(async name => name === 'manifest.json'
      ? { schemaVersion: 1, source: { title: 'fixture' }, countries: { IN: { places: 1 } } }
      : { country: 'XX', places: [], regions: [] });
    let mode = 'schema';
    page.on('pageerror', error => errors.push(error.message));
    await context.route(lists, async route => {
      const url = route.request().url();
      counts.schema++;
      // Only the country file is corrupted: the worker has to find India in a real index before it can read a row
      // set it refuses, which is the order that produces LOCATIONS_SCHEMA rather than a plain failure to load.
      if (!url.includes('/IN.json')) return url.includes('/api/locations') ? route.fulfill({ ...unreadable, contentType: 'application/json', body: JSON.stringify(unreadable.body) }) : route.continue();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ country: 'XX', places: [], regions: [] }) });
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#catalog-status')).toContainText('Choose a country');
    await page.getByRole('button', { name: 'Open FieldShift assistant', exact: true }).click();
    await send(page, 'Help me plan a rotation in India. Crops: tomato, cabbage, bulb onion.');
    await tap(page, 'A specific area');

    const sentence = await replyText(page);
    expect(sentence, 'the reply says what the app observed about the rows').toMatch(/arrived in a shape this app cannot read/);
    expect(sentence, 'and why asking again is not the way on').toMatch(/asking again cannot change a source format/);
    expect(sentence).not.toContain('No towns are listed');
    const offered = await labels(page);
    expect(offered, `a retry the reply has just ruled out is offered anyway: ${offered.join(' | ')}`).not.toContain('Try the place list again');
    expect(offered, 'the route that needs no saved list stays available').toContain('Whole India');
    expect(await page.locator('#pest-country').inputValue(), 'the country stays selected after an unreadable list').toBe('IN');
    expect(await page.locator('#latitude').inputValue(), 'an unreadable list selects no point').toBe('');

    // The escape the refusal names is the one path that reads the list without a composed sentence (countryOverview),
    // so it is where an unreadable list either fails honestly or loses the composer. It must not answer with a
    // region count it cannot have read, and the farmer must not be left with an empty box and no explanation.
    await tap(page, 'Whole India');
    const status = await page.locator('#answer-status').textContent();
    expect(status, 'the whole-country overview names the refusal instead of answering about the rows').toMatch(/invalid source format|could not load/i);
    expect(await last(page).locator(':scope > p').count(), 'no half-built overview was rendered').toBeLessThan(3);
    expect(await page.locator('#question').inputValue(), 'the question the farmer sent is still in the composer').toBe('Whole India');
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
    expect(errors, 'page errors while the saved list arrived unreadable twice').toEqual([]);
    await info.attach('Unreadable place list', { body: Buffer.from(JSON.stringify({ counts, sentence, offered, status }, null, 2)), contentType: 'application/json' });
  });
});

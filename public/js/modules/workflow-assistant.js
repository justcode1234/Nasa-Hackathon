import { api } from '../lib/api.js';
import { COUNTRY_NAMES, findCountries, normalizeName, regionPhrase } from '../lib/countries.js';
import { isEvidenceQuestion } from '../lib/chat-intent.js';

export function parseWorkflowMessage(question, active = false) {
  const text = normalizeName(question);
  if (/^(cancel|stop|cancel planning|stop planning)$/.test(text)) return active ? { cancel: true } : null;
  // Knowledge questions stay read-only, even during a guided planning session.
  if (isEvidenceQuestion(question) || /^(hi|hello)\b/.test(text)) return null;
  const countries = findCountries(question);
  // The whole-country phrasing test must survive Intl's shortened names: "whole St. Vincent
  // & Grenadines" and "whole Saint Vincent and the Grenadines" are the same request.
  const canonicalText = regionPhrase(question);
  const wholeCountry = /\b(?:whole|entire) (?:country|nation)\b|\bnationwide\b|\bnational overview\b/.test(text) ||
    /^(?:all|whole|entire|all of it|whole thing)(?: please)?$/.test(text) || countries.some(country => {
      const name = regionPhrase(COUNTRY_NAMES.of(country));
      return Boolean(name) && ['whole', 'all', 'entire'].some(prefix => (` ${canonicalText} `).includes(` ${prefix} ${name} `));
    });
  const specificArea = /\b(?:specific|particular) (?:area|part|region)\b|^choose a (?:town|city|field|place|region)(?: or (?:town|city|field|place|region))*$/.test(text);
  const intent = /\b(help me|guide me|walk me|take me|pick|select|choose|find|use|set|plan|rotate|compare|continue|next|proceed)\b/.test(text);
  if (!active && !wholeCountry && !specificArea && !(intent && (/\b(farm|farmland|field|rotation|rotate|crops|baseline|compare|step|task|point|coordinates)\b/.test(text) || countries.length))) return null;
  const point = /(?:^|[^\d.\w+-])([-+]?\d{1,3}(?:\.\d+)?)\s*,\s*([-+]?\d{1,3}(?:\.\d+)?)(?=$|[\s,;!?)\]]|\.(?!\d))/i.exec(question);
  const location = point ? { latitude: Number(point[1]), longitude: Number(point[2]) } : null;
  const baselineQuestion=question.replace(/\ballowed crops\s*(?:are|:|=)\s*[^.;]+/ig,'');
  const clause = /\b(?:crops|baseline|(?:existing )?rotation)\s*(?:are|is|:|=)\s*(.+)/i.exec(baselineQuestion)?.[1] ??
    /\b(?:with (?:the )?crops|based on (?:these crops[: ]+)?|rotate:|farmer provides|currently grow|i grow)\s*(.+)/i.exec(question)?.[1] ??
    (/\brotate\s+(.+[,→].+)/i.exec(question)?.[1]);
  let cropText = clause?.split(/[.;]|\b(?:in|at|near|irrigation|priority|starting|planning year|reference year|soil)\b/i)[0].trim();
  if (!cropText && active && !location && !wholeCountry && !specificArea && !countries.length && /,|→|->|\bthen\b/.test(question) && !intent && !/\b(?:i|want|country|farm|not|near|region|state|allowed crops|alternatives)\b/i.test(question)) cropText = question;
  // Marks a bare comma list that was read as crops only because no keyword was used. The saved
  // place list gets first refusal on such a reply: “United Townships of Dysart, Dudley, … and Clyde”
  // is one town row, not a nine-crop baseline.
  const implicitList = Boolean(cropText && !clause);
  const baseline = cropText?.split(/\s*(?:,|→|->|\bthen\b|\bfollowed by\b|\band\b)\s*/i).map(s => s.trim()).filter(Boolean);
  const allowedText = /\b(?:allowed crops|alternatives)\s*(?:are|:|=)\s*(.+)/i.exec(question)?.[1]?.split(/[.;]/)[0];
  const allowed = allowedText?.split(/\s*(?:,|\band\b)\s*/i).filter(Boolean);
  const constraints = {};
  if (/\b(rainfed|rain fed|no irrigation)\b/.test(text)) constraints.irrigation = 'rainfed';
  else if (/\birrigation (?:is )?available\b/.test(text)) constraints.irrigation = 'available';
  const soil = /\b(sandy|loam|clay) soil\b/.exec(text)?.[1];
  if (soil) constraints.soil = soil;
  const ph = /\b(?:soil )?ph\s*(?:is|:|=)?\s*(\d+(?:\.\d+)?)/i.exec(question)?.[1];
  if (ph != null) constraints.soilPh = Number(ph);
  if (/\b(?:priority|prioriti[sz]e)\s+(?:is\s+)?water\b/.test(text)) constraints.priority = 'water';
  if (/\b(?:priority|prioriti[sz]e)\s+(?:is\s+)?(?:family|fewer family repeats)\b/.test(text)) constraints.priority = 'family';
  for (const [key, pattern] of [['planningYear', /\bplanning year\s*(?:is|:)?\s*(20\d{2})/i], ['referenceYear', /\breference year\s*(?:is|:)?\s*(20\d{2})/i]]) {
    const year = pattern.exec(question)?.[1]; if (year) constraints[key] = Number(year);
  }
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const month = /\bstart(?:ing)? (?:in |month )?([a-z]+)/.exec(text)?.[1];
  if (months.includes(month)) constraints.startMonth = months.indexOf(month) + 1;
  return { countries, location, baseline, allowed, constraints, wholeCountry, specificArea, intent, implicitList,
    farmId: /\bway\/(\d+)\b/.exec(question)?.[0],
    farmIndex: /\b(?:field|farm)\s+([1-9]\d?)\b/.exec(text)?.[1] ?? ({ first: 1, second: 2, third: 3 }[/\b(first|second|third) (?:mapped )?(?:field|farm)\b/.exec(text)?.[1]]),
    usePoint: /\b(?:use|using) (?:the |this |my |current |selected )*(?:point|coordinates|location)\b/.test(text),
    useFarm: /\b(?:this|current|selected|my) (?:specific )?(?:farm|farmland|field)\b/.test(text),
    findFarms: /\b(find|show|search|nearby)\b.*\b(fields|farms|farmland)\b/.test(text) };
}

export function resolveCropInput(name, catalog, country) {
  if (typeof name !== 'string' || !name.trim() || name.length > 80) throw new Error('Each crop name must contain 1–80 characters.');
  const key = normalizeName(name), allowedIds = country?.screeningCropIds ?? [];
  const existing = country.choices.find(choice => choice.id === name);
  if (existing) return existing;
  const crop = catalog.crops.find(crop => [crop.id, crop.name, ...crop.aliases].some(alias => normalizeName(alias) === key));
  if (crop && allowedIds.includes(crop.id)) return { id: crop.id, name: crop.name };
  const matches = country.choices.filter(choice => [choice.name, choice.name.split(',')[0]].some(label => normalizeName(label) === key));
  if (matches.length === 1) return matches[0];
  // Unrecognised farmer inputs are preserved, never mapped to a guessed variety.
  return { id: `unassessed:${name.trim()}`, name: name.trim() };
}

const reply = (text, followUps = [], source = []) => ({ schemaVersion: 1, mode: 'guided app workflow', topic: 'workflow', useSelectedLocation: false,
  blocks: (Array.isArray(text) ? text : [text]).map(text => ({ kind: 'workflow progress', text, sourceIds: source.map(s => s.id) })), sources: source, followUps });
const next = (label, question, workflowChoice) => workflowChoice ? ({ label, question, workflowChoice }) : ({ label, question });

// A short reply such as “Woodlands”, “Jurong” or “use Pune” is an answer to the pending
// place question. Accents and punctuation are folded; anything longer stays a sentence.
const foldCache = new Map();
// Folding keeps the script: a town shown as “Петровец” in step 1 is typeable as “Петровец”, while
// accents and punctuation stay optional. No transliteration is invented for a name the source
// stores only in another script.
const foldName = value => {
  const key = String(value);
  const cached = foldCache.get(key);
  if (cached !== undefined) return cached;
  const folded = normalizeName(key).normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();
  // Country lists hold tens of thousands of names and are folded on every typed reply.
  if (foldCache.size < 200_000) foldCache.set(key, folded);
  return folded;
};
const MENTION_LEAD_IN = /^(?:please|i want|i mean|let us|use|using|choose|select|pick|try|go to|switch to|change to|set|open|in|at|near|town of|city of)\s+/;
function mentionPhrase(question) {
  const folded = foldName(question);
  if (!folded || folded.length > 60) return null;
  const explicit = MENTION_LEAD_IN.test(folded);
  const phrase = folded.replace(MENTION_LEAD_IN, '').trim();
  // A bare two-letter fragment is usually a typo, but “Use As” answers the pending place question:
  // the lead-in is what makes it safe, and the saved list still decides whether the name exists.
  // The same lead-in is what lets “in Municipality of Ribnica na Pohorju” reach a long row name.
  if (phrase.length < (explicit ? 2 : 3) || phrase.split(' ').length > (explicit ? 5 : 4)) return null;
  return phrase;
}
const nameMatchesPhrase = (name, phrase) => {
  const folded = foldName(name);
  return Boolean(folded && phrase) && (folded === phrase || folded.startsWith(`${phrase} `) || phrase.startsWith(`${folded} `));
};
function listedPlaces(places, { phrase = null, regionCode = null, countryName, allowEponymous = false } = {}) {
  const eponymous = foldName(countryName);
  const matches = (places?.places ?? []).filter(place => {
    if (regionCode && place.regionCode !== regionCode) return false;
    if (!allowEponymous && foldName(place.name) === eponymous) return false;
    return phrase ? nameMatchesPhrase(place.name, phrase) : false;
  });
  // “Woodlands” must win over “Woodlands North Coast” when both are listed.
  const exact = matches.filter(place => foldName(place.name) === phrase);
  return exact.length ? exact : matches;
}
// One typed place = one code path, whether it comes from the farmer or a coverage check.
// A selected region narrows the search but never hides a town that exists outside it.
export function typedPlace(places, question, { countryName, regionCode = null, allowEponymous = false } = {}) {
  const phrase = mentionPhrase(question);
  if (!phrase) return [];
  const matched = listedPlaces(places, { phrase, countryName, allowEponymous, regionCode });
  return matched.length || !regionCode ? matched : listedPlaces(places, { phrase, countryName, allowEponymous, regionCode: null });
}
// Buttons mirror the first three rows of the visible step 1 Town list, in list order.
function townButtons(places, regionCode = null) {
  return (places?.places ?? []).filter(place => !regionCode || place.regionCode === regionCode).slice(0, 3)
    .map(place => ({ label: place.name, question: `Use ${place.name}`, workflowChoice: { type: 'town', id: place.id } }));
}
// A place spelling that only appears inside the country name written in the same sentence is not a
// place the farmer picked: “Príncipe” in “São Tomé and Príncipe” is that country, not its region. A
// town whose own name contains the country is still that town — “Pamayanang University of Philippines
// Employment Housing Cooperative Subdivision” is a Philippines row, so the wording is located whole
// instead of deleting country words. Sentence and row names share regionPhrase’s canonical shape,
// which is why accents, “&”, “and” and “of” are one spelling on both sides.
function placeMentions(question, codes) {
  const canonical = ` ${regionPhrase(question)} `;
  const countrySpans = [];
  for (const code of new Set(codes)) {
    const span = code ? ` ${regionPhrase(COUNTRY_NAMES.of(code))} ` : '';
    if (span.trim().length < 3) continue;
    for (let at = canonical.indexOf(span); at >= 0; at = canonical.indexOf(span, at + 1)) countrySpans.push([at, at + span.length]);
  }
  return name => {
    const needle = ` ${regionPhrase(name)} `;
    if (needle.trim().length < 3) return false;
    for (let at = canonical.indexOf(needle); at >= 0; at = canonical.indexOf(needle, at + 1)) {
      if (!countrySpans.some(([start, end]) => at >= start && at + needle.length <= end)) return true;
    }
    return false;
  };
}
// Unnamed source administrative codes are not shown to the farmer as if they were labels.
const placeLabel = (places, place) => { const name = places?.regions?.find(region => region.id === place.regionCode)?.name; return name ? `${place.name} · ${name}` : place.name; };

export function createWorkflowAssistant({ getState, actions, request = api, progress = () => {}, fieldsGraceMs = 10_000 }) {
  let active = false, generation = 0, baseline = null, allowed = null, constraints = {}, pointAccepted = false, scope = null, areaRegion = null, fieldsTask = null;
  const locationLists = new Map();
  function invalidate() { generation++; baseline = null; allowed = null; constraints = {}; pointAccepted = false; scope = null; areaRegion = null; fieldsTask = null; }
  async function respond(question, choice = null) {
    let parsed = choice ? { countries: [], constraints: {} } : parseWorkflowMessage(question, active);
    // The short-reply cap keeps sentences out of place matching; a reply the saved list itself
    // contains is not a sentence. Only the list can decide, so whenever the message carries no other
    // workflow signal it is checked against the rows: however long the name is (“Chak One Hundred
    // Forty Nine Left”), however much it opens like a question (“Can Tho City”), reads as a crop list
    // (“United Townships of Dysart, Dudley, … and Clyde”) or has already been pointed elsewhere.
    const noOtherSignal = !parsed || !parsed.intent && (parsed.implicitList ||
      !parsed.countries.length && !parsed.location && !parsed.baseline && !parsed.allowed &&
      !parsed.wholeCountry && !parsed.specificArea && !Object.keys(parsed.constraints).length);
    if (active && !choice && noOtherSignal) {
      const asked = generation;
      const regionCode = areaRegion ?? getState().regionCode ?? null;
      const row = await exactPlaceRow(question, { regionCode, preferRegion: scope === 'area' && !regionCode }).catch(() => null);
      if (row && asked === generation) { choice = row; parsed = { countries: [], constraints: {} }; }
    }
    if (!parsed) { generation++; return null; }
    if (parsed.cancel) { active = false; invalidate(); return reply('Guided planning stopped. Your current form values remain available.'); }
    // Asking for the mapped fields is an action in its own right: without this the sentence carries no
    // intent verb, falls out of the workflow at the place-reply check, and the retry button below does
    // nothing the farmer asked for.
    const hasInput=choice||parsed.intent||parsed.findFarms||parsed.countries.length||parsed.location||parsed.baseline||parsed.allowed||parsed.wholeCountry||parsed.specificArea||Object.keys(parsed.constraints).length;
    if(!hasInput&&!getState().country)return null;
    if (!active) { scope = null; areaRegion = null; pointAccepted = false; }
    active = true;
    const version = ++generation;
    const guard = () => { if (version !== generation) throw new DOMException('Planning context changed', 'AbortError'); };
    const run = async (name, ...args) => { const result = await actions[name](...args); guard(); return result; };
    // One mapped-field request in flight per guided session: asking again while a shared community
    // service is still holding the connection must not open a second identical request against it.
    const findFields = () => {
      if (!fieldsTask) {
        const task = Promise.resolve().then(() => actions.loadFarms())
          .finally(() => { if (fieldsTask === task) fieldsTask = null; });
        fieldsTask = task;
      }
      return fieldsTask;
    };
    // Measured 18 Nov: a service that accepts the connection and never answers keeps the lookup open for
    // its whole 75 s server deadline, and the chat was awaiting that before confirming the farmer's tap.
    // The reply therefore waits this long at most, then says which part of the answer has not arrived.
    const fieldsOutcome = async () => {
      const outcome = await Promise.race([findFields().then(() => 'done', error => ({ error })),
        new Promise(resolve => setTimeout(resolve, fieldsGraceMs, 'waiting'))]);
      guard();
      if (typeof outcome === 'object') throw outcome.error;
      return outcome;
    };
    const fieldsWaiting = message => reply(`${message} The shared OpenStreetMap field services have not answered yet, so no field list is shown and nothing was invented. You can continue with the selected point, or ask me to show the fields again in a moment.`,
      [next('Use selected point', 'Use the selected point'), next('Show mapped fields', 'Show mapped fields around this point')],
      [{ id: 'osm', title: 'OpenStreetMap contributors; community mapped land use, not verified ownership', url: 'https://www.openstreetmap.org/copyright' }]);
    if (parsed.countries.length > 1) return reply('Which country should I work in first?', parsed.countries.slice(0, 3).map(country => next(COUNTRY_NAMES.of(country), `Help me plan a rotation in ${COUNTRY_NAMES.of(country)}`)));
    if (parsed.baseline) baseline = parsed.baseline;
    if (parsed.allowed) allowed = parsed.allowed;
    Object.assign(constraints, parsed.constraints);
    if (baseline && (baseline.length !== 3 || baseline.some(name => name.length > 80))) return reply('Please give exactly three baseline crops in order, for example “crops: rice, wheat, beans”. I will preserve unsupported crops as unassessed.');
    if (constraints.soilPh != null && (constraints.soilPh < 0 || constraints.soilPh > 14)) return reply('Soil-test pH must be between 0 and 14. Please correct it before I continue.');
    if (constraints.referenceYear && (constraints.referenceYear < 2001 || constraints.referenceYear >= new Date().getUTCFullYear())) return reply('Choose a completed historical reference year from 2001 onward. Future NASA observations are not available.');
    let state = getState();
    let requestedCountry = parsed.countries[0];
    if (requestedCountry && requestedCountry !== state.country && state.country) {
      // “Carriacou and Petite Martinique” is a parish of Grenada and “Inner Mongolia” is a province
      // of China. A saved local place name that happens to contain another country’s name answers
      // the pending place question; it is not a request to move the whole plan to that country.
      const replied = foldName(question), phrase = mentionPhrase(question) ?? replied;
      const SWITCH_LEAD_IN = /^(?:switch to|change to|move to|go to)\s+/;
      const local = await getLocationList(state.country).catch(() => null);
      if (local && [...(local.regions ?? []), ...(local.places ?? [])].some(row => row.name && foldName(row.name) === phrase)
        && !SWITCH_LEAD_IN.test(replied)) requestedCountry = undefined;
    }
    if (requestedCountry && requestedCountry !== state.country) {
      progress(`Step 1: selecting ${COUNTRY_NAMES.of(requestedCountry)}…`);
      await run('chooseCountry', requestedCountry); pointAccepted = false; scope = null; areaRegion = null; state = getState();
    }
    if (!state.country) { actions.showStep('location'); return reply('Which country should we look at? Then we can explore the whole country or a particular area.'); }
    const countryName = COUNTRY_NAMES.of(state.country);
    // The saved place list for the selected country decides whether a short reply names
    // a place. A failed list request leaves the message unclaimed rather than guessing.
    let listed = null;
    try { listed = await getLocationList(state.country); guard(); } catch { listed = null; }
    const places = listed ?? { regions: [], places: [] };
    const mentionsPlace = placeMentions(question, parsed.countries);
    // A region spelled exactly like the country is dropped from the suggestion lists, but only when
    // the spelling is identical: Réunion’s single saved region is ASCII “Reunion”, and excluding it
    // here would leave a name the farmer can see in step 1 unanswerable in the chat.
    const namedRegions = places.regions.filter(region => region.name && normalizeName(region.name) !== normalizeName(countryName));
    const regionFilter = scope === 'area' ? (areaRegion ?? state.regionCode ?? null) : null;
    // The country’s own spelling stays out of the town matches while the plan is still asking which
    // region it covers, so no reply can quietly mean the whole country. Once a region is chosen, or the
    // saved list holds no regions at all, the pending question is “which town”, and seven lists really
    // do hold a town carrying the country’s name — Colombia in Huila, Djibouti in Djibouti, plus
    // Luxembourg, Monaco, Mozambique, San Marino and Türkmenistan — so that town has to be typeable.
    const allowEponymousTown = namedRegions.length === 0 || Boolean(regionFilter);
    // Coordinates the farmer supplied are the more precise input: a town named in the same sentence
    // verifies that point (checked above) instead of replacing it with the town centroid.
    const hasCoordinates = Boolean(parsed.location);
    const phrase = choice?.type === 'town' || hasCoordinates ? null : mentionPhrase(question);
    let regionMentions = phrase ? namedRegions.filter(region => nameMatchesPhrase(region.name, phrase)) : [];
    // A region spelled exactly like its country is left out of the suggestion lists so no button asks
    // for the country again, but the farmer can still type it: Luxembourg, San Marino, Taiwan,
    // Djibouti, Guatemala, Guadeloupe and Martinique really do hold such a saved region row in step 1’s
    // Region list. Only a reply equal to that whole name counts, and a region of another name is matched
    // first, so nothing that already resolved changes.
    if (phrase && !regionMentions.length && !regionFilter) regionMentions = places.regions
      .filter(region => region.name && normalizeName(region.name) === normalizeName(countryName) && foldName(region.name) === phrase);
    const exactRegions = regionMentions.filter(region => foldName(region.name) === phrase);
    if (exactRegions.length) regionMentions = exactRegions;
    // Tuvalu-style lists hold a town with the same name as its region. Once that region is
    // already selected, the phrase should choose the town instead of re-asking for one.
    if (areaRegion && phrase) regionMentions = regionMentions.filter(region =>
      !(region.id === areaRegion && listedPlaces(places, { phrase, countryName, allowEponymous: true, regionCode: region.id }).length));
    let townMentions = hasCoordinates ? [] : typedPlace(places, question, { countryName, regionCode: regionFilter, allowEponymous: allowEponymousTown });
    // A reply that is exactly the country’s own spelling is not a place name, even when the saved list
    // holds a row whose name sits inside it: typing “São Tomé & Príncipe” at the region question must
    // not narrow the whole country to the town São Tomé. A row whose own whole spelling *is* that reply
    // (Guadeloupe’s region row, the seven towns named like their country) really does answer the
    // question, so it is matched first and left alone here.
    const countrySpelling = foldName(regionPhrase(countryName));
    const replySpelling = foldName(regionPhrase(phrase ?? question));
    const rowCarriesReply = [...places.regions, ...places.places]
      .some(row => row.name && foldName(regionPhrase(row.name)) === replySpelling);
    if (replySpelling === countrySpelling && !rowCarriesReply) { regionMentions = []; townMentions = []; }
    const placeMention = regionMentions.length === 1 || townMentions.length > 0;
    // A town answer the saved list cannot match must still leave a tappable way forward;
    // the generic assistant cannot name a town, so silence here strands the pending plan.
    const placeRecovery = () => {
      actions.showStep('location');
      const regionName = places.regions.find(region => region.id === (areaRegion ?? state.regionCode))?.name;
      return reply(`No town by that name is in the saved place list for ${countryName}${regionName ? ` in ${regionName}` : ''}. Tap one of the towns below, choose any town in the step 1 Town list, search a place or enter your farm coordinates. I will not guess a similar name.`,
        [...townButtons(places, areaRegion ?? state.regionCode ?? null), next(`Whole ${countryName}`, `Whole ${countryName}`)]);
    };
    // Inside a chosen region the pending question is “which town”, so a short reply the list cannot
    // match is still an attempted town name — even after a town point exists. This message has already
    // been ruled out as a read-only question, and silence would leave the farmer nothing to tap.
    // Elsewhere the plan is not waiting for a town, so unmatched text runs no action at all.
    if (!hasInput && !placeMention && state.location) return phrase && areaRegion ? placeRecovery() : null;
    let inputsInForm = false;
    const keepInputs = async () => {
      if (!baseline && !allowed && !Object.keys(constraints).length) return;
      try { await run('applyPlanning', { baseline, constraints, allowed }); inputsInForm = Boolean(baseline); }
      catch (error) { if (error.name === 'AbortError') throw error; }
    };
    if(allowed){
      const missing=allowed.filter(name=>!state.countryCrops.screeningCropIds.includes(resolveCropInput(name,state.catalog,state.countryCrops).id));
      if(missing.length)return reply(`Your requested alternatives include crops without screening rules for ${countryName}: ${missing.join(', ')}. This leaves fewer than two allowed crops or an incomplete requested set. I will not silently discard or replace them. Choose a supported allowed-crop list in step 3, or keep these crops only as an unassessed baseline.`);
    }
    if (parsed.wholeCountry) {
      scope = 'country'; areaRegion = null; pointAccepted = false;
      if (!baseline && state.planning.baseline.every(Boolean)) baseline = [...state.planning.baseline];
      // A national request must not retain a field point or its NASA comparison.
      if (state.location || state.farm || state.regionCode) { await run('chooseCountry', state.country); state = getState(); }
    }
    if (parsed.specificArea) { const previousScope = scope; scope = 'area'; await keepInputs(); actions.showStep('location'); guard(); return areaPrompt(countryName, null, places, { regionCode: areaRegion, wholeEscape: previousScope !== 'country' }); }
    const explicitPoint = parsed.location || parsed.farmId || parsed.farmIndex || (!parsed.wholeCountry && (parsed.usePoint || parsed.useFarm)) || choice?.type === 'farm' || choice?.type === 'town';
    if (parsed.wholeCountry && !explicitPoint) { await keepInputs(); return countryOverview(getState(), inputsInForm); }
    if (parsed.location) {
      const { latitude, longitude } = parsed.location;
      if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return reply('Those coordinates are outside the latitude/longitude range. Please give latitude, longitude in decimal degrees.');
      progress('Step 1: checking the country at those coordinates…');
      const result = await request(`/api/places?${new URLSearchParams({...parsed.location,detail:'region'})}`); guard();
      const foundCountry = result.places[0]?.countryCode;
      if (!foundCountry || foundCountry !== state.country) return reply(`Those coordinates ${foundCountry ? `were identified in ${COUNTRY_NAMES.of(foundCountry)}` : 'could not be assigned to a country'}. Please correct the point or country before I continue.`);
      let list = locationLists.get(state.country);
      if (!list) { list = await request(`/api/locations?country=${state.country}`); guard(); locationLists.set(state.country,list); while(locationLists.size>4)locationLists.delete(locationLists.keys().next().value); }
      const q = normalizeName(question);
      const regions = list.regions.filter(region=>normalizeName(region.name)!==normalizeName(countryName) && (` ${q} `).includes(` ${normalizeName(region.name)} `));
      const fold = value=>normalizeName(value).normalize('NFD').replace(/\p{M}/gu,'');
      if (regions.length>1) return reply('Several regions are named. Which region should the supplied point be in?');
      if (regions.length===1 && (!result.places[0]?.region || fold(result.places[0].region)!==fold(regions[0].name))) return reply(`The point could not be verified in ${regions[0].name}. The reverse lookup reports ${result.places[0]?.region ?? 'no region'}. Please check the place and coordinates before I continue.`);
      const towns = list.places.filter(place=>(!regions.length || place.regionCode===regions[0].id) && normalizeName(place.name).length>=3 && (` ${q} `).includes(` ${normalizeName(place.name)} `));
      if (towns.length) {
        const distance = place=>{const rad=Math.PI/180,dy=(place.latitude-latitude)*rad,dx=(place.longitude-longitude)*rad;const a=Math.sin(dy/2)**2+Math.cos(latitude*rad)*Math.cos(place.latitude*rad)*Math.sin(dx/2)**2;return 6371*2*Math.asin(Math.min(1,Math.sqrt(a)));};
        if (!towns.some(place=>distance(place)<=50)) return reply(`Those coordinates are more than 50 km from the named town in the saved place list. Please confirm the town or point. This is a town-proximity check, not a farm-boundary measurement.`);
      }
      await run('chooseLocation', parsed.location, foundCountry); pointAccepted = true; scope = 'area'; state = getState();
    }
    if (choice?.type === 'farm' || parsed.farmId || parsed.farmIndex) {
      const id = choice?.id ?? parsed.farmId ?? state.farms[Number(parsed.farmIndex) - 1]?.id;
      if (!state.farms.some(farm => farm.id === id)) return reply('That field is not in the current mapped results. Find nearby fields and select one of the returned outlines.');
      await run('chooseFarm', id); pointAccepted = true; scope = 'area'; state = getState();
    }
    if (parsed.usePoint && state.location && !placeMention) { pointAccepted = true; scope = 'area'; }
    if (state.farm && (parsed.useFarm || !requestedCountry) && !placeMention) { pointAccepted = true; scope = 'area'; }
    if (parsed.findFarms && state.location) {
      progress('Step 1: finding community-mapped fields near the selected point…');
      if (await fieldsOutcome() === 'waiting') return fieldsWaiting('Your selected point is still in place.');
      return fieldPrompt(getState(), 'Choose the specific mapped field. Map coverage and crop tags may be incomplete.');
    }
    if (placeMention || !state.location || !pointAccepted) {
      progress('Step 1: looking for the named town…');
      const q = normalizeName(question);
      // “São Francisco de Assis do Piauí” is one town whose name contains the region Piauí, so when the
      // whole reply equals a listed town exactly that town wins over a region named inside it. One
      // wording can also be both a region row and a town row (Andorra, Tuvalu, Jordan, Japan): while
      // the plan is asking for a region the reply is that region, and inside a chosen region the same
      // wording is its town.
      const selectedRegion = areaRegion ?? state.regionCode ?? null;
      const askedForRegion = scope === 'area' && !selectedRegion;
      const wholeTown = askedForRegion ? [] : places.places.filter(place => normalizeName(place.name) === q &&
        (!selectedRegion || place.regionCode === selectedRegion));
      // A tapped town carries the source row id, so it must never be re-read as a region name:
      // Andorra la Vella, Gitega, Bodden Town and Al Aḩmadī are both a region and a town.
      const selectRegion = async region => {
        await run('chooseRegion', region.id); areaRegion = region.id; scope = 'area'; await keepInputs(); guard();
        return reply(`${region.name} is selected. Now choose a town in the Town list in step 1, or type its name here. After you pick a town, press “Continue planning with this location”.`,
          [...townButtons(places, region.id), next(`Whole ${countryName}`, `Whole ${countryName}`)]);
      };
      // A tapped region carries its row id, so an accent mismatch between the saved list and
      // Intl’s country spelling (Réunion/Reunion) cannot strand the tap.
      if (choice?.type === 'region') {
        const region = places.regions.find(row => row.id === choice.id);
        if (!region) return reply('That region is not in the current place list for this country. Choose a region from the step 1 list or tell me its name.');
        return selectRegion(region);
      }
      const regionMatches = choice?.type === 'town' || wholeTown.length === 1 ? [] : regionMentions.length === 1 ? regionMentions :
        namedRegions.filter(region => mentionsPlace(region.name));
      // Repeating the already-chosen region’s own name is not a new choice. In eleven saved lists that
      // name is also a town somewhere else (the city of Buenos Aires is not a town inside the province of
      // Buenos Aires), so the pending question is still “which town” and re-selecting the region would
      // answer the same question twice. Say what is missing and give the real towns instead.
      if (regionMatches.length === 1 && selectedRegion && regionMatches[0].id === selectedRegion && !state.location) {
        if (!townMentions.length) return placeRecovery();
      } else if (regionMatches.length === 1) return selectRegion(regionMatches[0]);
      const matches = choice?.type === 'town' ? places.places.filter(place => place.id === choice.id) :
        choice?.type === 'towns' ? places.places.filter(place => choice.ids.includes(place.id)) :
        townMentions.length ? townMentions : places.places.filter(place => {
        const name = normalizeName(place.name);
        return (scope === 'area' || name !== normalizeName(countryName)) && (!selectedRegion || place.regionCode === selectedRegion) &&
          name.length >= 3 && mentionsPlace(place.name) && (q === name || /\b(?:in|near|at|around)\b/.test(q));
      });
      if (matches.length === 1) {
        await run('chooseLocation', matches[0], state.country); scope = 'area';
        progress('Step 1: finding community-mapped fields near the town…');
        const fields = await fieldsOutcome();
        await keepInputs(); state = getState();
        if (fields === 'waiting') return fieldsWaiting(`${matches[0].name} is selected as a town point. The town itself is not farmland.`);
        return fieldPrompt(state, `${matches[0].name} is selected as a town point. Choose the specific field; the town itself is not farmland.`);
      }
      if (matches.length > 1) {
        // Only three rows are offered at a time, so say so when the list holds more, and separate two
        // rows that share both a name and a region (“Quezon · Cagayan Valley” twice) with the saved
        // coordinates: two identically worded buttons for two different points cannot be chosen between.
        const shown = matches.slice(0, 3);
        const labels = shown.map(place => placeLabel(places, place));
        return reply(`Several listed towns match${matches.length > shown.length ? `, showing ${shown.length} of ${matches.length}` : ''}. Which one do you mean?`,
          shown.map((place, index) => ({
            label: labels.filter(label => label === labels[index]).length > 1 ? `${labels[index]} · ${place.latitude}, ${place.longitude}` : labels[index],
            question: `Use ${place.name}`, workflowChoice: { type: 'town', id: place.id } })));
      }
      if(!hasInput&&!placeMention)return phrase&&!state.location&&(scope==='area'||areaRegion)?placeRecovery():null;
      // The country’s own name is neither a region nor a town, so a place question answered with it
      // cannot select anything — but answering with the very question the farmer is replying to leaves
      // the chat asking itself the same thing. Name the level that is still missing, offer its real
      // rows, and state plainly that nothing was selected. A saved row spelled like the country is
      // matched earlier and still selects itself. The long official spellings never reach the
      // short-reply rule, so the whole reply is compared in the same canonical shape.
      if (replySpelling === countrySpelling && !regionMentions.length && !townMentions.length && (scope === 'area' || selectedRegion)) {
        const regionName = places.regions.find(region => region.id === selectedRegion)?.name;
        const forTowns = Boolean(selectedRegion) || !namedRegions.length;
        const options = [...(forTowns
          ? townButtons(places, selectedRegion)
          : namedRegions.slice(0, 3).map(region => next(region.name, region.name, { type: 'region', id: region.id }))),
          next(`Whole ${countryName}`, `Whole ${countryName}`)];
        actions.showStep('location');
        if (!namedRegions.length && !places.places.length) return reply(`“${countryName}” is the country, and its saved place list holds no towns or regions to choose from. Choose Whole ${countryName} for the country overview, or give your farm coordinates. Nothing was selected.`, options);
        const level = regionName ? `a town in ${regionName}` : namedRegions.length ? 'one of its regions' : 'one of its towns';
        return reply(`“${countryName}” is the country, not ${level}. Tap a ${forTowns ? 'town' : 'region'} below, type its name here, or choose Whole ${countryName} for the country overview. Nothing was selected.`, options);
      }
      await keepInputs();
      actions.showStep('location');
      if (scope === 'country' && !explicitPoint && !placeMention) return countryOverview(getState(), inputsInForm);
      if (scope === 'area' || selectedRegion) return areaPrompt(countryName, places.regions.find(region => region.id === selectedRegion)?.name, places, { regionCode: selectedRegion, wholeEscape: scope !== 'country' });
      // Neutral on purpose: an empty list can be an uninhabited code or a list that did not load, and
      // only the second path can tell them apart. Both buttons work — “A specific area” states the gap.
      return reply(`Which part of ${countryName} should we focus on, or would you like an overview of the whole country?`,
        [next(`Whole ${countryName}`, `Whole ${countryName}`), next('A specific area', 'A specific area')]);
    }
    actions.showStep('si');
    const sequence = baseline ?? state.planning.baseline;
    if (sequence.length !== 3 || sequence.some(name => !name)) return reply('The location is set. What are the farmer’s three existing crops, in order? Reply “crops: rice, wheat, beans” or fill the baseline in step 3. Unknown soil and irrigation inputs will stay unknown.');
    progress('Step 3: applying the supplied crop sequence and constraints…');
    await run('applyPlanning', { baseline, constraints, allowed });
    baseline = null; allowed = null; constraints = {}; state = getState();
    const count = state.planning.allowedCrops.length;
    if (count < 2) {
      // The plan is blocked on allowed crops, so the reply must offer a way out inside the chat
      // instead of only naming a step 3 control. The list is the crops this app has screening
      // rules for — data coverage, not an agronomic recommendation.
      const screened = state.countryCrops.screeningCropIds.slice(0, 3)
        .map(id => state.countryCrops.choices.find(choice => choice.id === id)?.name ?? id);
      const options = screened.length >= 2
        ? [next(`Allow ${screened.join(', ')}`, `allowed crops: ${screened.join(', ')}`)] : [];
      if (options.length) return reply(`Your baseline is retained. Alternatives currently include fewer than two allowed crops with screening rules. Tap “${options[0].label}” to allow the crops this app has screening rules for, or name your own. That list reflects available crop rules, not a recommendation. In step 3, choose “Let me choose different crops below” and explicitly allow at least two crops, or tell me “allowed crops: …”. I will not add sweet corn or any other crop without your choice. Missing crop rules cannot be invented.`, options);
      // A country with fewer than two screened crops can never be compared here, so naming the
      // step 3 checkbox list would send the farmer to controls that do not exist. Deliver the
      // step 2 evidence the plan already asked for and state what cannot be concluded.
      if (!state.observations) {
        progress('Step 2: loading historical NASA evidence for the selected point…');
        if (!await run('loadEvidence')) return reply(`NASA evidence could not be loaded, and ${countryName} has fewer than two crops with screening rules, so neither weather evidence nor a rotation comparison is being claimed. Check the error shown in step 2, then ask me to continue.`, [next('Retry', 'Continue planning')]);
        state = getState();
      }
      return reply([`Your baseline is retained. Alternatives currently include fewer than two allowed crops with screening rules, and ${countryName} has ${state.countryCrops.screeningCropIds.length === 1 ? `one crop with screening rules in this app (${screened[0]})` : 'no crop with screening rules in this app'}, so module 04 cannot show two alternatives for this country. That is missing crop-rule coverage, not a finding about your farm.`,
        state.observations ? `The real NASA evidence for this point is now shown in step 2 with its units, observation dates, resolution and missing values, so you can still read rainfall, heat and vegetation for your own decision.` : '',
        `I will not invent crop rules or borrow another country’s crop rules to fill the gap.`].filter(Boolean).join(' '),
        [{ label: 'Explain this point’s weather', question: 'What does the NASA evidence show for rainfall and heat at this point?' }, next(`Whole ${countryName} overview`, `Whole ${countryName}`)]);
    }
    progress('Step 2: loading historical NASA evidence for the selected point…');
    if (!state.observations && !await run('loadEvidence')) return reply('NASA evidence could not be loaded. The app has not generated a comparison. Check the error in step 2 and retry.', [next('Retry', 'Continue planning')]);
    progress('Step 4: comparing the baseline and two alternatives…');
    const comparison = await run('compare');
    if (!comparison) return reply('The comparison could not finish. Check the form or data error in step 3; no successful result is being claimed.', [next('Retry', 'Continue planning')]);
    active = false;
    return reply(`Step 4 is ready: your baseline and two alternatives are displayed. The baseline is ${comparison.scenarios[0].timeline.map(slot => slot.cropName).join(' → ')}. Alternatives use the allowed starter crops. The plan starts in month ${state.planning.startMonth} of ${state.planning.planningYear}, using historical ${state.planning.referenceYear} weather. Missing soil, irrigation and local agronomy remain unknown; unsupported crops stay unassessed. Review the visible trade-offs and gaps before making a planting decision.`);
  }
  async function getLocationList(country){let data=locationLists.get(country);if(!data){data=await request(`/api/locations?country=${country}`);locationLists.set(country,data);while(locationLists.size>4)locationLists.delete(locationLists.keys().next().value);}return data;}
  // The whole saved list decides whether a reply is a place name, so the read-only question test in
  // chat-intent.js can stay list-blind. Only an unambiguous exact row name is accepted here. One
  // wording can be both a region row and a town row (Andorra, Tuvalu, Jordan, Japan), so the step
  // already reached decides: while the plan asks for a region the reply is that region, and inside a
  // chosen region the same wording is its town.
  async function exactPlaceRow(question, { regionCode = null, preferRegion = false } = {}) {
    const folded = foldName(question), country = getState().country;
    if (!folded || !country) return null;
    const list = await getLocationList(country);
    const towns = (list?.places ?? []).filter(row => row.name && foldName(row.name) === folded &&
      (!regionCode || row.regionCode === regionCode));
    const regions = (list?.regions ?? []).filter(row => row.name && foldName(row.name) === folded);
    if (preferRegion && regions.length === 1) return { type: 'region', id: regions[0].id };
    if (towns.length === 1) return { type: 'town', id: towns[0].id };
    // A region row equal to the region already selected answers no pending question. The saved list
    // puts the city of Buenos Aires in a different region row than the province, and California the
    // town in Maryland, so repeating the chosen region’s name has to fall through to the town rows
    // (or the honest “no town by that name here”) instead of selecting the same region twice.
    if (regionCode && regions.length === 1 && regions[0].id === regionCode) {
      const anywhere = (list?.places ?? []).filter(row => row.name && foldName(row.name) === folded);
      return anywhere.length === 1 ? { type: 'town', id: anywhere[0].id } : null;
    }
    // A chosen region narrows the search but never hides the country’s other towns: the saved lists
    // hold 33 short rows such as “As”, a town in one Belgian region, and typedPlace already looks
    // country-wide once its in-region filter finds nothing. One exact match elsewhere is that town;
    // two rows sharing the name stay a question rather than a guess.
    if (regionCode && !towns.length && !regions.length) {
      const elsewhere = (list?.places ?? []).filter(row => row.name && foldName(row.name) === folded);
      if (elsewhere.length === 1) return { type: 'town', id: elsewhere[0].id };
      // India really does list both “Un” and “Ūn”, whose folded spellings are the same one reply.
      // Two points share the name, so the honest answer is the question, not one of them.
      if (elsewhere.length > 1) return { type: 'towns', ids: elsewhere.map(row => row.id) };
    }
    return regions.length === 1 ? { type: 'region', id: regions[0].id } : null;
  }
  function areaPrompt(countryName, regionName, places, options = {}) {
    const { regionCode = null, wholeEscape = true } = options;
    const named = (places?.regions ?? []).filter(region => region.name && normalizeName(region.name) !== normalizeName(countryName));
    const shortcuts = [];
    if (!regionName && named.length) {
      const counts = new Map();
      for (const place of places.places ?? []) counts.set(place.regionCode, (counts.get(place.regionCode) ?? 0) + 1);
      for (const region of named.map(region => [region, counts.get(region.id) ?? 0]).filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name)).slice(0, 3).map(([region]) => region)) shortcuts.push(next(region.name, region.name, { type: 'region', id: region.id }));
      const noTowns = !(places.places ?? []).length;
      return reply(`Which state or region of ${countryName}? ${shortcuts.length ? 'Tap one below, ' : ''}choose any region in the Region list in step 1, or type its name.${shortcuts.length ? ' The buttons are the three regions with the most towns in the saved place list, not a recommendation.' : ''}${noTowns ? ` No towns are listed for ${countryName} in this saved place list, so after a region you may need the map, place search or coordinates.` : ''}`, shortcuts);
    }
    // Two saved lists (Guadeloupe, Martinique) hold region rows whose only name is the country’s own.
    // Leaving them out would ask “which region?” with nothing to tap, so the row is offered as it stands
    // and the wording says plainly why the button repeats the country name.
    const eponymous = (places?.regions ?? []).filter(region => region.name && normalizeName(region.name) === normalizeName(countryName));
    if (!regionName && !named.length && eponymous.length) {
      const options = eponymous.slice(0, 3).map(region => next(region.name, region.name, { type: 'region', id: region.id }));
      if (wholeEscape) options.push(next(`Whole ${countryName}`, `Whole ${countryName}`));
      const only = eponymous.length === 1;
      return reply(`${countryName} has ${only ? 'one region row' : `${eponymous.length} region rows`} in this saved place list and ${only ? 'it carries the country’s own name' : 'they all carry the country’s own name'}, so the button below repeats that name. Tap it, type “${eponymous[0].name}”, or choose the whole country instead. Towns are then offered from that list.`, options);
    }
    const towns = townButtons(places, regionCode);
    if (wholeEscape) towns.push(next(`Whole ${countryName}`, `Whole ${countryName}`));
    if (towns.filter(button => button.workflowChoice).length) {
      return reply(regionName ? `Which town in ${regionName}, ${countryName}? The buttons are the first three towns of that region in the step 1 Town list, in list order — not a recommendation. You can also choose any town in step 1, search a place, pick the map or enter coordinates. After a town is chosen, press “Continue planning with this location”.` :
        `${countryName} has no named regions in this place list, so no region is needed. The buttons below are the first three towns in the step 1 Town list, in list order — not a recommendation. You can also type a town name, search a place, pick the map or enter your farm coordinates.`, towns);
    }
    // With no towns to tap, the national overview is the only continuation the chat still has, so it
    // stays offered even when the caller came from it. The alternative is a reply with nothing to press.
    return reply(`No towns are listed for ${regionName ? `${regionName}, ` : ''}${countryName} in this saved place list, so the assistant cannot choose a point for you. Search a place by name, select a field on the map or enter your farm coordinates in step 1. A whole-country overview needs none of these.`,
      [next(`Whole ${countryName}`, `Whole ${countryName}`)]);
  }
  async function countryOverview(state, inputsInForm = false) {
    actions.showStep('location');
    const name = COUNTRY_NAMES.of(state.country), data = state.countryCrops;
    const places=await getLocationList(state.country),namedRegions=places.regions.some(region=>region.name&&normalizeName(region.name)!==normalizeName(name));
    // A saved list can also hold no towns at all (Antarctica, Heard & McDonald Islands and the other
    // uninhabited codes), and then naming a town control would point at an empty dropdown.
    const townsListed = places.places.length > 0;
    const sequence = baseline ?? state.planning.baseline.filter(Boolean);
    const cropNames = [], records = sequence.map(cropName => {
      const crop = resolveCropInput(cropName, state.catalog, data);
      cropNames.push(crop.name);
      const itemCode = /^unassessed:fao-(\d+)$/.exec(crop.id)?.[1];
      const record = data.records.find(record => String(record.itemCode) === itemCode || record.screeningId === crop.id);
      return record ? `${record.name} (${record.year})` : `${crop.name}: no matching production category`;
    });
    return reply([`Whole-country overview for ${name}.${sequence.length ? (inputsInForm ? ` Your crops are entered in step 3: ${cropNames.join(' → ')}.` : ` Your crops are remembered for this plan: ${cropNames.join(' → ')}.`) : ''}`,
      records.length ? `FAOSTAT national production records: ${records.join('; ')}. Snapshot retrieved ${data.source.retrievedAt.slice(0, 10)}; these are country records, not local suitability evidence.` :
        `${data.records.length} crop categories have saved national production records for 2020–2024. Missing categories remain unknown.`,
      `A rotation comparison needs NASA weather for one place, and a whole country has no single weather reading. ${namedRegions ? 'Choose a state or region next, then a town.' : townsListed ? 'Choose a town, a mapped field or farm coordinates next; this place list has no named regions.' : 'This saved place list has no towns to choose from, so pick a spot on the map or enter your farm coordinates in step 1.'} Your crops stay in step 3.`],
    [next(namedRegions ? 'Choose a state or region' : townsListed ? 'Choose a town or field' : 'Use the map or coordinates', 'A specific area')], [data.source]);
  }
  function fieldPrompt(state, message) {
    actions.showStep('location');
    const choices = state.farms.slice(0, 3).map((farm, i) => ({ label: `Field ${i + 1}: ${farm.name.slice(0, 30)}`, question: `Use mapped field ${farm.id}`, workflowChoice: { type: 'farm', id: farm.id } }));
    // The town point stays offered even when fields came back, so a chat-only plan never
    // depends on discovering the typed command.
    choices.push(next('Use selected point', 'Use the selected point'));
    return reply(`${message} ${state.farms.length} mapped fields were returned. You can also choose from the full field dropdown or use explicit farm coordinates.`, choices,
      [{ id: 'osm', title: 'OpenStreetMap contributors; community mapped land use, not verified ownership', url: 'https://www.openstreetmap.org/copyright' }]);
  }
  return { respond, invalidate, isActive: () => active };
}

import { api } from '../lib/api.js';
import { COUNTRY_NAMES, findCountries, normalizeName } from '../lib/countries.js';
import { isEvidenceQuestion } from '../lib/chat-intent.js';

export function parseWorkflowMessage(question, active = false) {
  const text = normalizeName(question);
  if (/^(cancel|stop|cancel planning|stop planning)$/.test(text)) return active ? { cancel: true } : null;
  // Knowledge questions stay read-only, even during a guided planning session.
  if (isEvidenceQuestion(question) || /^(hi|hello)\b/.test(text)) return null;
  const countries = findCountries(question);
  const wholeCountry = /\b(?:whole|entire) (?:country|nation)\b|\bnationwide\b|\bnational overview\b/.test(text) ||
    /^(?:all|whole|entire|all of it|whole thing)(?: please)?$/.test(text) || countries.some(country =>
      ['whole', 'whole of', 'all', 'all of', 'entire'].some(prefix => (` ${text} `).includes(` ${prefix} ${normalizeName(COUNTRY_NAMES.of(country))} `)));
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
  return { countries, location, baseline, allowed, constraints, wholeCountry, specificArea, intent,
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
const next = (label, question) => ({ label, question });

// A short reply such as “Woodlands”, “Jurong” or “use Pune” is an answer to the pending
// place question. Accents and punctuation are folded; anything longer stays a sentence.
const foldName = value => normalizeName(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, ' ').trim();
const MENTION_LEAD_IN = /^(?:please|i want|i mean|let us|use|using|choose|select|pick|try|go to|switch to|change to|set|open|in|at|near|town of|city of)\s+/;
function mentionPhrase(question) {
  const folded = foldName(question);
  if (!folded || folded.length > 60) return null;
  const phrase = folded.replace(MENTION_LEAD_IN, '').trim();
  if (phrase.length < 3 || phrase.split(' ').length > 4) return null;
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
// Buttons mirror the first three rows of the visible step 1 Town list, in list order.
function townButtons(places, regionCode = null) {
  return (places?.places ?? []).filter(place => !regionCode || place.regionCode === regionCode).slice(0, 3)
    .map(place => ({ label: place.name, question: `Use ${place.name}`, workflowChoice: { type: 'town', id: place.id } }));
}
// Unnamed source administrative codes are not shown to the farmer as if they were labels.
const placeLabel = (places, place) => { const name = places?.regions?.find(region => region.id === place.regionCode)?.name; return name ? `${place.name} · ${name}` : place.name; };

export function createWorkflowAssistant({ getState, actions, request = api, progress = () => {} }) {
  let active = false, generation = 0, baseline = null, allowed = null, constraints = {}, pointAccepted = false, scope = null, areaRegion = null;
  const locationLists = new Map();
  function invalidate() { generation++; baseline = null; allowed = null; constraints = {}; pointAccepted = false; scope = null; areaRegion = null; }
  async function respond(question, choice = null) {
    const parsed = choice ? { countries: [], constraints: {} } : parseWorkflowMessage(question, active);
    if (!parsed) { generation++; return null; }
    if (parsed.cancel) { active = false; invalidate(); return reply('Guided planning stopped. Your current form values remain available.'); }
    const hasInput=choice||parsed.intent||parsed.countries.length||parsed.location||parsed.baseline||parsed.allowed||parsed.wholeCountry||parsed.specificArea||Object.keys(parsed.constraints).length;
    if(!hasInput&&!getState().country)return null;
    if (!active) { scope = null; areaRegion = null; pointAccepted = false; }
    active = true;
    const version = ++generation;
    const guard = () => { if (version !== generation) throw new DOMException('Planning context changed', 'AbortError'); };
    const run = async (name, ...args) => { const result = await actions[name](...args); guard(); return result; };
    if (parsed.countries.length > 1) return reply('Which country should I work in first?', parsed.countries.slice(0, 3).map(country => next(COUNTRY_NAMES.of(country), `Help me plan a rotation in ${COUNTRY_NAMES.of(country)}`)));
    if (parsed.baseline) baseline = parsed.baseline;
    if (parsed.allowed) allowed = parsed.allowed;
    Object.assign(constraints, parsed.constraints);
    if (baseline && (baseline.length !== 3 || baseline.some(name => name.length > 80))) return reply('Please give exactly three baseline crops in order, for example “crops: rice, wheat, beans”. I will preserve unsupported crops as unassessed.');
    if (constraints.soilPh != null && (constraints.soilPh < 0 || constraints.soilPh > 14)) return reply('Soil-test pH must be between 0 and 14. Please correct it before I continue.');
    if (constraints.referenceYear && (constraints.referenceYear < 2001 || constraints.referenceYear >= new Date().getUTCFullYear())) return reply('Choose a completed historical reference year from 2001 onward. Future NASA observations are not available.');
    let state = getState();
    const requestedCountry = parsed.countries[0];
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
    const namedRegions = places.regions.filter(region => region.name && foldName(region.name) !== foldName(countryName));
    const allowEponymousTown = namedRegions.length === 0;
    const phrase = choice?.type === 'town' ? null : mentionPhrase(question);
    let regionMentions = phrase ? namedRegions.filter(region => nameMatchesPhrase(region.name, phrase)) : [];
    const exactRegions = regionMentions.filter(region => foldName(region.name) === phrase);
    if (exactRegions.length) regionMentions = exactRegions;
    const regionFilter = scope === 'area' ? (areaRegion ?? state.regionCode ?? null) : null;
    let townMentions = phrase ? listedPlaces(places, { phrase, countryName, allowEponymous: allowEponymousTown, regionCode: regionFilter }) : [];
    if (phrase && !townMentions.length && regionFilter) townMentions = listedPlaces(places, { phrase, countryName, allowEponymous: allowEponymousTown, regionCode: null });
    const placeMention = regionMentions.length === 1 || townMentions.length > 0;
    if (!hasInput && !placeMention && state.location) return null;
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
    if (parsed.findFarms && state.location) { await run('loadFarms'); return fieldPrompt(getState(), 'Choose the specific mapped field. Map coverage and crop tags may be incomplete.'); }
    if (placeMention || !state.location || !pointAccepted) {
      progress('Step 1: looking for the named town…');
      const q = normalizeName(question);
      const regionMatches = regionMentions.length === 1 ? regionMentions :
        namedRegions.filter(region => (` ${q} `).includes(` ${normalizeName(region.name)} `));
      if (regionMatches.length === 1) {
        const region = regionMatches[0];
        await run('chooseRegion', region.id); areaRegion = region.id; scope = 'area'; await keepInputs(); guard();
        return reply(`${region.name} is selected. Now choose a town in the Town list in step 1, or type its name here. After you pick a town, press “Continue planning with this location”.`,
          [...townButtons(places, region.id), next(`Whole ${countryName}`, `Whole ${countryName}`)]);
      }
      const selectedRegion = areaRegion ?? state.regionCode ?? null;
      const matches = choice?.type === 'town' ? places.places.filter(place => place.id === choice.id) :
        townMentions.length ? townMentions : places.places.filter(place => {
        const name = normalizeName(place.name);
        return (scope === 'area' || name !== normalizeName(countryName)) && (!selectedRegion || place.regionCode === selectedRegion) && name.length >= 3 && (` ${q} `).includes(` ${name} `) && (q === name || /\b(in|near|at|around)\b/.test(q));
      });
      if (matches.length === 1) {
        await run('chooseLocation', matches[0], state.country); scope = 'area';
        progress('Step 1: finding community-mapped fields near the town…');
        await run('loadFarms'); await keepInputs(); state = getState();
        return fieldPrompt(state, `${matches[0].name} is selected as a town point. Choose the specific field; the town itself is not farmland.`);
      }
      if (matches.length > 1) return reply('Several listed towns match. Which one do you mean?', matches.slice(0, 3).map(place => ({ label: placeLabel(places, place), question: `Use ${place.name}`, workflowChoice: { type: 'town', id: place.id } })));
      if(!hasInput&&!placeMention)return null;
      await keepInputs();
      actions.showStep('location');
      if (scope === 'country' && !explicitPoint && !placeMention) return countryOverview(getState(), inputsInForm);
      if (scope === 'area' || selectedRegion) return areaPrompt(countryName, places.regions.find(region => region.id === selectedRegion)?.name, places, { regionCode: selectedRegion, wholeEscape: scope !== 'country' });
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
      return reply(`Your baseline is retained. Alternatives currently include fewer than two allowed crops with screening rules.${options.length ? ` Tap “${options[0].label}” to allow the crops this app has screening rules for, or name your own. That list reflects available crop rules, not a recommendation.` : ''} In step 3, choose “Let me choose different crops below” and explicitly allow at least two crops, or tell me “allowed crops: …”. I will not add sweet corn or any other crop without your choice. Missing crop rules cannot be invented.`, options);
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
  function areaPrompt(countryName, regionName, places, options = {}) {
    const { regionCode = null, wholeEscape = true } = options;
    const named = (places?.regions ?? []).filter(region => region.name && normalizeName(region.name) !== normalizeName(countryName));
    const shortcuts = [];
    if (!regionName && named.length) {
      const counts = new Map();
      for (const place of places.places ?? []) counts.set(place.regionCode, (counts.get(place.regionCode) ?? 0) + 1);
      for (const region of named.map(region => [region, counts.get(region.id) ?? 0]).filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1] || a[0].name.localeCompare(b[0].name)).slice(0, 3).map(([region]) => region)) shortcuts.push(next(region.name, region.name));
      const noTowns = !(places.places ?? []).length;
      return reply(`Which state or region of ${countryName}? ${shortcuts.length ? 'Tap one below, ' : ''}choose any region in the Region list in step 1, or type its name.${shortcuts.length ? ' The buttons are the three regions with the most towns in the saved place list, not a recommendation.' : ''}${noTowns ? ` No towns are listed for ${countryName} in this saved place list, so after a region you may need the map, place search or coordinates.` : ''}`, shortcuts);
    }
    const towns = townButtons(places, regionCode);
    if (wholeEscape) towns.push(next(`Whole ${countryName}`, `Whole ${countryName}`));
    if (towns.filter(button => button.workflowChoice).length) {
      return reply(regionName ? `Which town in ${regionName}, ${countryName}? The buttons are the first three towns of that region in the step 1 Town list, in list order — not a recommendation. You can also choose any town in step 1, search a place, pick the map or enter coordinates. After a town is chosen, press “Continue planning with this location”.` :
        `${countryName} has no named regions in this place list, so no region is needed. The buttons below are the first three towns in the step 1 Town list, in list order — not a recommendation. You can also type a town name, search a place, pick the map or enter your farm coordinates.`, towns);
    }
    return reply(`No towns are listed for ${regionName ? `${regionName}, ` : ''}${countryName} in this saved place list, so the assistant cannot choose a point for you. Search a place by name, select a field on the map or enter your farm coordinates in step 1. A whole-country overview needs none of these.`,
      wholeEscape ? [next(`Whole ${countryName}`, `Whole ${countryName}`)] : []);
  }
  async function countryOverview(state, inputsInForm = false) {
    actions.showStep('location');
    const name = COUNTRY_NAMES.of(state.country), data = state.countryCrops;
    const places=await getLocationList(state.country),namedRegions=places.regions.some(region=>region.name&&normalizeName(region.name)!==normalizeName(name));
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
      `A rotation comparison needs NASA weather for one place, and a whole country has no single weather reading. ${namedRegions ? 'Choose a state or region next, then a town.' : 'Choose a town, a mapped field or farm coordinates next; this place list has no named regions.'} Your crops stay in step 3.`],
    [next(namedRegions ? 'Choose a state or region' : 'Choose a town or field', 'A specific area')], [data.source]);
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

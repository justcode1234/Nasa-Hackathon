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
  const specificArea = /\b(?:specific|particular) (?:area|part|region)\b|^choose a (?:region|town|field)$/.test(text);
  const intent = /\b(help me|guide me|walk me|take me|pick|select|choose|find|use|set|plan|rotate|compare|continue|next|proceed)\b/.test(text);
  if (!active && !wholeCountry && !specificArea && !(intent && (/\b(farm|farmland|field|rotation|rotate|crops|baseline|compare|step|task|point|coordinates)\b/.test(text) || countries.length))) return null;
  const point = /(?:^|[^\d.\w+-])([-+]?\d{1,3}(?:\.\d+)?)\s*,\s*([-+]?\d{1,3}(?:\.\d+)?)(?=$|[\s,;!?)\]]|\.(?!\d))/i.exec(question);
  const location = point ? { latitude: Number(point[1]), longitude: Number(point[2]) } : null;
  const clause = /\b(?:crops|baseline|(?:existing )?rotation)\s*(?:are|is|:|=)\s*(.+)/i.exec(question)?.[1] ??
    /\b(?:with (?:the )?crops|based on (?:these crops[: ]+)?|rotate:|farmer provides|currently grow|i grow)\s*(.+)/i.exec(question)?.[1] ??
    (/\brotate\s+(.+[,→].+)/i.exec(question)?.[1]);
  let cropText = clause?.split(/[.;]|\b(?:in|at|near|irrigation|priority|starting|planning year|reference year|soil)\b/i)[0].trim();
  if (!cropText && active && !location && !wholeCountry && !specificArea && !countries.length && /,|→|->|\bthen\b/.test(question) && !intent && !/\b(?:i|want|country|farm|not|near|region|state)\b/i.test(question)) cropText = question;
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
  return { countries, location, baseline, allowed, constraints, wholeCountry, specificArea,
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

export function createWorkflowAssistant({ getState, actions, request = api, progress = () => {} }) {
  let active = false, generation = 0, baseline = null, allowed = null, constraints = {}, pointAccepted = false, scope = null, areaRegion = null;
  const locationLists = new Map();
  function invalidate() { generation++; baseline = null; allowed = null; constraints = {}; pointAccepted = false; scope = null; areaRegion = null; }
  async function respond(question, choice = null) {
    const parsed = choice ? { countries: [], constraints: {} } : parseWorkflowMessage(question, active);
    if (!parsed) { generation++; return null; }
    if (parsed.cancel) { active = false; invalidate(); return reply('Guided planning stopped. Your current form values remain available.'); }
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
    if (parsed.wholeCountry) {
      scope = 'country'; areaRegion = null; pointAccepted = false;
      if (!baseline && state.planning.baseline.every(Boolean)) baseline = [...state.planning.baseline];
      // A national request must not retain a field point or its NASA comparison.
      if (state.location || state.farm || state.regionCode) { await run('chooseCountry', state.country); state = getState(); }
    }
    if (parsed.specificArea) { scope = 'area'; actions.showStep('location'); return areaPrompt(countryName); }
    const explicitPoint = parsed.location || parsed.farmId || parsed.farmIndex || (!parsed.wholeCountry && (parsed.usePoint || parsed.useFarm)) || choice?.type === 'farm' || choice?.type === 'town';
    if (parsed.wholeCountry && !explicitPoint) return countryOverview(state);
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
    if (parsed.usePoint && state.location) { pointAccepted = true; scope = 'area'; }
    if (state.farm && (parsed.useFarm || !requestedCountry)) { pointAccepted = true; scope = 'area'; }
    if (parsed.findFarms && state.location) { await run('loadFarms'); return fieldPrompt(getState(), 'Choose the specific mapped field. Map coverage and crop tags may be incomplete.'); }
    if (!state.location || !pointAccepted) {
      progress('Step 1: looking for the named town…');
      let places = locationLists.get(state.country);
      if (!places) { places = await request(`/api/locations?country=${state.country}`); guard(); locationLists.set(state.country, places); while (locationLists.size > 4) locationLists.delete(locationLists.keys().next().value); }
      const q = normalizeName(question);
      const regionMatches = places.regions.filter(region => normalizeName(region.name) !== normalizeName(countryName) && (` ${q} `).includes(` ${normalizeName(region.name)} `));
      if (regionMatches.length === 1) {
        const region = regionMatches[0];
        await run('chooseRegion', region.id); areaRegion = region.id; scope = 'area';
        return reply(`Which town or farmland in ${region.name}, ${countryName}? You can choose a town from the dropdown or name it here.`, [next(`Whole ${countryName}`, `Whole ${countryName}`)]);
      }
      const selectedRegion = areaRegion ?? state.regionCode ?? null;
      const matches = choice?.type === 'town' ? places.places.filter(place => place.id === choice.id) : places.places.filter(place => {
        const name = normalizeName(place.name);
        return (scope === 'area' || name !== normalizeName(countryName)) && (!selectedRegion || place.regionCode === selectedRegion) && name.length >= 3 && (` ${q} `).includes(` ${name} `) && (q === name || /\b(in|near|at|around)\b/.test(q));
      });
      if (matches.length === 1) {
        await run('chooseLocation', matches[0], state.country); scope = 'area';
        progress('Step 1: finding community-mapped fields near the town…');
        await run('loadFarms'); state = getState();
        return fieldPrompt(state, `${matches[0].name} is selected as a town point. Choose the specific field; the town itself is not farmland.`);
      }
      if (matches.length > 1) return reply('Several listed towns match. Which one do you mean?', matches.slice(0, 3).map(place => ({ label: `${place.name} · ${place.regionCode}`, question: `Use ${place.name}`, workflowChoice: { type: 'town', id: place.id } })));
      actions.showStep('location');
      if (scope === 'country' && !explicitPoint) return countryOverview(state);
      if (scope === 'area' || selectedRegion) return areaPrompt(countryName, places.regions.find(region => region.id === selectedRegion)?.name);
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
    if (count < 2) return reply('The baseline is entered, but fewer than two allowed crops have screening rules for this country. Select at least two supported alternatives in step 3. I cannot invent local rotation rules.');
    progress('Step 2: loading historical NASA evidence for the selected point…');
    if (!state.observations && !await run('loadEvidence')) return reply('NASA evidence could not be loaded. The app has not generated a comparison. Check the error in step 2 and retry.', [next('Retry', 'Continue planning')]);
    progress('Step 4: comparing the baseline and two alternatives…');
    const comparison = await run('compare');
    if (!comparison) return reply('The comparison could not finish. Check the form or data error in step 3; no successful result is being claimed.', [next('Retry', 'Continue planning')]);
    active = false;
    return reply(`Step 4 is ready: your baseline and two alternatives are displayed. The baseline is ${comparison.scenarios[0].timeline.map(slot => slot.cropName).join(' → ')}. Alternatives use the allowed starter crops. The plan starts in month ${state.planning.startMonth} of ${state.planning.planningYear}, using historical ${state.planning.referenceYear} weather. Missing soil, irrigation and local agronomy remain unknown; unsupported crops stay unassessed. Review the visible trade-offs and gaps before making a planting decision.`);
  }
  function areaPrompt(countryName, regionName) {
    return reply(regionName ? `Which town or farmland in ${regionName}, ${countryName}? Choose a town from the dropdown or name it here.` :
      `Which state, region or town in ${countryName}? You can name it here or use the location dropdowns.`,
    [next(`Whole ${countryName}`, `Whole ${countryName}`)]);
  }
  function countryOverview(state) {
    actions.showStep('si');
    const name = COUNTRY_NAMES.of(state.country), data = state.countryCrops;
    const sequence = baseline ?? state.planning.baseline.filter(Boolean);
    const cropNames = [], records = sequence.map(cropName => {
      const crop = resolveCropInput(cropName, state.catalog, data);
      cropNames.push(crop.name);
      const itemCode = /^unassessed:fao-(\d+)$/.exec(crop.id)?.[1];
      const record = data.records.find(record => String(record.itemCode) === itemCode || record.screeningId === crop.id);
      return record ? `${record.name} (${record.year})` : `${crop.name}: no matching production category`;
    });
    return reply([`Whole-country overview for ${name}.${sequence.length ? ` Your supplied crops are retained: ${cropNames.join(' → ')}.` : ''}`,
      records.length ? `FAOSTAT national production records: ${records.join('; ')}. Snapshot retrieved ${data.source.retrievedAt.slice(0, 10)}; these are country records, not local suitability evidence.` :
        `${data.records.length} crop categories have saved national production records for 2020–2024. Missing categories remain unknown.`,
      'There is no single country-wide planting calendar or field weather reading here. Choose a region when you want to compare rotations for a particular farm.'],
    [next('Choose a region', 'A specific area')], [data.source]);
  }
  function fieldPrompt(state, message) {
    actions.showStep('location');
    const choices = state.farms.slice(0, 3).map((farm, i) => ({ label: `Field ${i + 1}: ${farm.name.slice(0, 30)}`, question: `Use mapped field ${farm.id}`, workflowChoice: { type: 'farm', id: farm.id } }));
    if (choices.length < 3) choices.push(next('Use selected point', 'Use the selected point'));
    return reply(`${message} ${state.farms.length} mapped fields were returned. You can also choose from the full field dropdown or use explicit farm coordinates.`, choices,
      [{ id: 'osm', title: 'OpenStreetMap contributors; community mapped land use, not verified ownership', url: 'https://www.openstreetmap.org/copyright' }]);
  }
  return { respond, invalidate };
}

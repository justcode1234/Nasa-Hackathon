// Decides which loaded evidence a chat question may add to a sourced answer. Topic words are
// matched as whole words: the old `farm` test also matched a farmer, so a question about
// farmer-reported soil added a mapped field record, and `australia` on its own added the national
// irrigation benchmark to any question naming the country. Both blocks are prepended in chat.js
// and can displace the answer's own first blocks, so the extra context changed the answer's topic.
const TOPIC = {
  // A gate must not be narrower than the selectors behind it. `rain|rains|rainy` and `freeze|freezing` and
  // `frosty` are all enumerated by the series picker below, so until 18 Nov (UTC) the farmer's most common word for
  // the topic chose a series nobody could reach: "how much rain fell here?" added no weather evidence at all
  // while "rainfall" added the Rainfall paragraph. The six added words may not be followed by a hyphen, which
  // keeps compound modifiers of another noun out ("freeze-dried", "rain-fed") on the same principle that keeps
  // "farmer training" and "Australian grains" out; the app's own irrigation value is spelled `rainfed` and also
  // stays out, which is the limit of this rule rather than a silent widening. Nothing was removed, so no
  // question that reached the evidence before can stop reaching it.
  weather: /\b(?:weather|nasa|temperatures?|rainfalls?|precipitation|solar|frost)\b|\b(?:rain|rains|rainy|frosty|freeze|freezing)\b(?!-)/i,
  soil: /\bsoil\b|\bph\b|\bsand|\bclay|\bdrain/i,
  water: /\bwater\b|\birrigat/i,
  farm: /\bfarm(?:s|land)?\b|\bfields?\b/i,
  pest: /\b(?:pests?|insects?|moths?|worms?|diseases?)\b/i
};

export function contextBlocks(question, state, answer) {
  const blocks = [], sources = [];
  if (answer.topic === 'greeting' || answer.useSelectedLocation === false) return { blocks, sources };
  if (TOPIC.weather.test(question) && state.observations) {
    const data = state.observations;
    // Frost is defined by the coldest air, not the average: server/agronomy/rotation.js counts
    // T2M_MIN ≤ 0 as frost-tender exposure and the evidence table labels that series "Lowest air",
    // so a frost question that quotes T2M would answer with a different quantity than the plan does.
    // The three selectors match whole words for the reason recorded in subsection 17: "farmer
    // training" is not rainfall, "minimum wages" is not a cold night and a "defrost cycle" is not frost.
    const solar = /\bsolar\b/i.test(question);
    const rain = /\b(?:rain|rains|rainy|rainfall|precipitation)\b/i.test(question);
    const frost = /\b(?:frost|frosty|freeze|freezing)\b|\bcold snaps?\b|\b(?:minimum|lowest|coldest) (?:temperature|temperatures|reading|readings|night|nights|day|days)\b/i.test(question);
    const parameterId = solar ? 'ALLSKY_SFC_SW_DWN' : rain ? 'PRECTOTCORR'
      : frost && data.parameters.T2M_MIN ? 'T2M_MIN' : 'T2M';
    const parameter = data.parameters[parameterId], date = parameter.latestAvailableDate;
    const value = date ? parameter.values[data.dates.indexOf(date)] : null;
    blocks.push({ kind: 'historical weather evidence', text: `${parameter.label}: latest non-missing value inside ${data.period.start} to ${data.period.end} is ${value ?? 'missing'} ${parameter.units} on ${date ?? 'unknown date'}. Regional estimated gridded observation at ${data.location.latitude}°, ${data.location.longitude}°; retrieved ${data.retrievedAt}. It is not current weather, a forecast or a field measurement.`, sourceIds: ['nasa-power', 'nasa-power-request'] });
    // Two entries, two ids, because an id is the only key the panel has: public/js/modules/chat.js:99 appends
    // these sources after the answer's own and public/js/lib/dom.js:16 resolves an id with `sources.find`, so the
    // first entry wins - which is how the request URL below was silently discarded while the documentation page
    // opened instead. Citing the registry id alone would have kept the old single chip; pushing it here under the
    // URL the payload reports means this paragraph links what it quotes without depending on which of the
    // answer's own paragraphs survive the three-paragraph cap. Distinct ids are this file's own convention for
    // one paragraph carrying two sources (`pest.id` / `${pest.id}-host`).
    sources.push({ id: 'nasa-power', title: 'NASA POWER Daily API', url: data.source.documentationUrl });
    sources.push({ id: 'nasa-power-request', title: 'NASA POWER exact data request', url: data.source.url });
  }
  if (TOPIC.soil.test(question)) {
    if (state.soil) {
      const property = state.soil.properties.find(p => /sand/i.test(question) ? p.id === 'sand' : /clay/i.test(question) ? p.id === 'clay' : p.id === 'phh2o');
      [property].filter(Boolean).forEach(p => blocks.push({ kind: 'regional soil model', text: `${p.name}: mean ${p.mean ?? 'missing'} ${p.units}; source 5th–95th prediction quantiles ${p.lower ?? 'missing'}–${p.upper ?? 'missing'} ${p.units}. SoilGrids ${state.soil.nominalResolutionM} m grid, ${state.soil.depth}, retrieved ${state.soil.retrievedAt}; no single observation date. This is not a farm measurement.`, sourceIds: ['soilgrids'] }));
      blocks.push({ kind: 'limitation', text: 'ISRIC advises against local/farm-level use of SoilGrids. These estimates are regional context only; no measured pH, drainage or soil-water capacity is inferred for this field.', sourceIds: ['soilgrids'] });
      sources.push({ ...state.soil.source, id: 'soilgrids' });
    } else blocks.push({ kind: 'limitation', text: 'Mapped soil context is not loaded. Load it in Plan crops. No soil type or pH is guessed for this field.', sourceIds: [] });
  }
  if (TOPIC.water.test(question)) {
    if (state.water?.available) {
      const row = state.water.rows.find(row => /vegetable/i.test(row.category)) ?? state.water.rows[0];
      if (row) blocks.push({ kind: 'historical national irrigation context', text: `${row.category}: Australia ${state.water.period}, ${row.waterAppliedMl} ML applied ÷ ${row.irrigatedHa} irrigated ha = ${row.appliedMlPerIrrigatedHa.toFixed(2)} ML/ha annually. ABS release ${state.water.publishedDate}. This broad national ratio is not this farm's water requirement or a daily watering schedule.`, sourceIds: ['abs-irrigation'] });
      sources.push({ ...state.water.source, id: 'abs-irrigation' });
    } else blocks.push({ kind: 'limitation', text: 'No verified irrigation benchmark is loaded for this country. Australian national statistics are not substituted for another country or for a field irrigation schedule.', sourceIds: [] });
  }
  if (TOPIC.farm.test(question) && state.farm) {
    const farm = state.farm;
    blocks.push({ kind: 'mapped field record', text: `${farm.name}. ${farm.crops.length ? `Recorded crop tags: ${farm.crops.join(', ')}.` : 'No crop tags are recorded.'} OSM edit date: ${farm.updatedAt ?? 'unknown'}; current crops, ownership and access are unverified.`, sourceIds: ['selected-field'] });
    sources.push({ id: 'selected-field', title: 'Selected OpenStreetMap field', url: farm.sourceUrl });
  }
  // The trigger list cannot hold every species, and a farmer names the insect rather than the topic,
  // so the record names the app already holds open the branch too. Only the words that identify a species
  // are used, as whole words with an optional plural: the head noun when it can carry the name on its own
  // ("armyworm", "locust"), and when the head is a short generic noun ("moth") the word in front of it,
  // which is the part that makes the species unique. Matching every word would let "fall" as a season or
  // "Australian" as a demonym pull a pest paragraph into an unrelated question. The matched record is the
  // one quoted, instead of whatever the country list happens to start with.
  const askedPest = (state.pests?.records ?? []).find(p => {
    const words = p.name.toLowerCase().split(/\s+/), head = words.at(-1);
    const keys = head.length > 4 ? [head] : [head, words.at(-2)].filter(Boolean);
    return keys.some(key => new RegExp(`\\b${key}s?\\b`).test(question.toLowerCase()));
  });
  // The plan names the crops the farmer is growing and each watchlist entry names the crop it is about
  // (`cropIds`), yet the quoted record ignored both: a radish/tomato/cabbage plan asking a plain pest
  // question got the maize armyworm paragraph because the list happens to start with it. The entry that
  // matches the plan is the one that can say something about this farm; an insect named in the question
  // still wins, and a crop the watchlist does not cover keeps the existing first-entry answer.
  const planned = new Set([...(state.planning?.baseline ?? []), ...(state.planning?.allowedCrops ?? [])]);
  const cropPest = (state.pests?.records ?? []).find(pest => (pest.cropIds ?? []).some(id => planned.has(id)));
  if (TOPIC.pest.test(question) || askedPest) {
    if (state.pests) for (const pest of [askedPest ?? cropPest ?? state.pests.records[0]].filter(Boolean)) {
      blocks.push({ kind: 'country occurrence context', text: `${pest.name} in ${state.pests.country}: ${pest.status}${pest.occurrenceCount !== null ? ` (${pest.occurrenceCount} historical occurrence records)` : ''}. ${pest.hostNote} This does not establish farm presence or current outbreak.`, sourceIds: [pest.id, `${pest.id}-host`] });
      // The id goes after the spread everywhere in this file: the paragraph cites `<pest.id>-host`, the panel
      // counts ids (`chat.js:108`) and links only the ones it can resolve (`dom.js:17`), so a host entry that
      // carries its own id would otherwise leave the citation counted and unrenderable.
      sources.push({ id: pest.id, title: `GBIF ${pest.name} country query`, url: pest.sourceUrl }, { ...pest.hostSource, id: `${pest.id}-host` });
    } else blocks.push({ kind: 'limitation', text: 'Country pest context is not loaded. Use Plan crops → Country pest context. There are no pest observations for this farm in the app.', sourceIds: [] });
  }
  // Two measured blocks are what a reply can carry, but the old shared budget of two counted caveats too,
  // so the first thing a busy reply lost was the ISRIC advisory: a question naming both the rain and the
  // soil showed the mapped pH with no statement that SoilGrids is not a farm measurement, while the same
  // pH in a soil-only reply carried it. A caveat now travels with the estimate it qualifies instead of
  // competing with the other topics for a slot.
  let measured = 0, caveats = 0;
  const kept = blocks.filter(block => block.kind === 'limitation' ? caveats++ < 1 : measured++ < 2);
  return { blocks: kept, sources };
}

// How a reply is assembled once local evidence is added. The panel shows at most three paragraphs.
// Weather and soil estimates answer the question the generic templates cannot, so they stand in for
// the API's own paragraphs. A field record, a pest occurrence or the national irrigation ratio only
// describe the surroundings, so one paragraph of the crop answer has to survive beside them; the API
// limitation is kept unless the context already carries one.
export function composeAnswerBlocks(answerBlocks, extraBlocks) {
  if (!extraBlocks.length) return answerBlocks.slice(0, 3);
  // A mapped estimate answers the question itself, so all three paragraphs may be context and advisory.
  // Descriptive context (a field record, an occurrence, a national ratio) only surrounds the answer, so it
  // keeps two paragraphs and leaves the third for the crop facts.
  const replaces = extraBlocks.some(block => block.kind === 'historical weather evidence' || block.kind === 'regional soil model');
  const context = extraBlocks.slice(0, replaces ? 3 : 2);
  const facts = replaces ? [] : answerBlocks.filter(block => block.kind !== 'limitation').slice(0, 1);
  const caveat = context.some(block => block.kind === 'limitation') ? [] : answerBlocks.filter(block => block.kind === 'limitation').slice(0, 1);
  return [...context, ...facts, ...caveat].slice(0, 3);
}

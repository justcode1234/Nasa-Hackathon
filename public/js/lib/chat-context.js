// Decides which loaded evidence a chat question may add to a sourced answer. Topic words are
// matched as whole words: the old `farm` test also matched a farmer, so a question about
// farmer-reported soil added a mapped field record, and `australia` on its own added the national
// irrigation benchmark to any question naming the country. Both blocks are prepended in chat.js
// and can displace the answer's own first blocks, so the extra context changed the answer's topic.
const TOPIC = {
  weather: /\b(?:weather|nasa|temperatures?|rainfalls?|precipitation|solar|frost)\b/i,
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
    const parameterId = /solar/i.test(question) ? 'ALLSKY_SFC_SW_DWN' : /rain|precipitation/i.test(question) ? 'PRECTOTCORR' : 'T2M';
    const parameter = data.parameters[parameterId], date = parameter.latestAvailableDate;
    const value = date ? parameter.values[data.dates.indexOf(date)] : null;
    blocks.push({ kind: 'historical weather evidence', text: `${parameter.label}: latest non-missing value inside ${data.period.start} to ${data.period.end} is ${value ?? 'missing'} ${parameter.units} on ${date ?? 'unknown date'}. Regional estimated gridded observation at ${data.location.latitude}°, ${data.location.longitude}°; retrieved ${data.retrievedAt}. It is not current weather, a forecast or a field measurement.`, sourceIds: ['nasa-power'] });
    sources.push({ id: 'nasa-power', title: 'NASA POWER exact data request', url: data.source.url });
  }
  if (TOPIC.soil.test(question)) {
    if (state.soil) {
      const property = state.soil.properties.find(p => /sand/i.test(question) ? p.id === 'sand' : /clay/i.test(question) ? p.id === 'clay' : p.id === 'phh2o');
      [property].filter(Boolean).forEach(p => blocks.push({ kind: 'regional soil model', text: `${p.name}: mean ${p.mean ?? 'missing'} ${p.units}; source 5th–95th prediction quantiles ${p.lower ?? 'missing'}–${p.upper ?? 'missing'} ${p.units}. SoilGrids ${state.soil.nominalResolutionM} m grid, ${state.soil.depth}, retrieved ${state.soil.retrievedAt}; no single observation date. This is not a farm measurement.`, sourceIds: ['soilgrids'] }));
      blocks.push({ kind: 'limitation', text: 'ISRIC advises against local/farm-level use of SoilGrids. These estimates are regional context only; no measured pH, drainage or soil-water capacity is inferred for this field.', sourceIds: ['soilgrids'] });
      sources.push(state.soil.source);
    } else blocks.push({ kind: 'limitation', text: 'Mapped soil context is not loaded. Load it in Plan crops. No soil type or pH is guessed for this field.', sourceIds: [] });
  }
  if (TOPIC.water.test(question)) {
    if (state.water?.available) {
      const row = state.water.rows.find(row => /vegetable/i.test(row.category)) ?? state.water.rows[0];
      if (row) blocks.push({ kind: 'historical national irrigation context', text: `${row.category}: Australia ${state.water.period}, ${row.waterAppliedMl} ML applied ÷ ${row.irrigatedHa} irrigated ha = ${row.appliedMlPerIrrigatedHa.toFixed(2)} ML/ha annually. ABS release ${state.water.publishedDate}. This broad national ratio is not this farm's water requirement or a daily watering schedule.`, sourceIds: ['abs-irrigation'] });
      sources.push(state.water.source);
    } else blocks.push({ kind: 'limitation', text: 'No verified irrigation benchmark is loaded for this country. Australian national statistics are not substituted for another country or for a field irrigation schedule.', sourceIds: [] });
  }
  if (TOPIC.farm.test(question) && state.farm) {
    const farm = state.farm;
    blocks.push({ kind: 'mapped field record', text: `${farm.name}. ${farm.crops.length ? `Recorded crop tags: ${farm.crops.join(', ')}.` : 'No crop tags are recorded.'} OSM edit date: ${farm.updatedAt ?? 'unknown'}; current crops, ownership and access are unverified.`, sourceIds: ['selected-field'] });
    sources.push({ id: 'selected-field', title: 'Selected OpenStreetMap field', url: farm.sourceUrl });
  }
  if (TOPIC.pest.test(question)) {
    if (state.pests) for (const pest of [state.pests.records.find(p => question.toLowerCase().includes(p.name.toLowerCase())) ?? state.pests.records[0]].filter(Boolean)) {
      blocks.push({ kind: 'country occurrence context', text: `${pest.name} in ${state.pests.country}: ${pest.status}${pest.occurrenceCount !== null ? ` (${pest.occurrenceCount} historical occurrence records)` : ''}. ${pest.hostNote} This does not establish farm presence or current outbreak.`, sourceIds: [pest.id, `${pest.id}-host`] });
      sources.push({ id: pest.id, title: `GBIF ${pest.name} country query`, url: pest.sourceUrl }, { id: `${pest.id}-host`, ...pest.hostSource });
    } else blocks.push({ kind: 'limitation', text: 'Country pest context is not loaded. Use Plan crops → Country pest context. There are no pest observations for this farm in the app.', sourceIds: [] });
  }
  return { blocks: blocks.slice(0, 2), sources };
}

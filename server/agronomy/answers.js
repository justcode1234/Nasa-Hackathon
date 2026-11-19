import { catalog, mentionedCrops, ambiguousCornQuestion, nonSweetCornQuestion, cornScopeNotice } from './catalog.js';
import { findCountries, COUNTRY_NAMES } from '../../public/js/lib/countries.js';

// Capability limits and input checks are deterministic and shared by both runtimes.
// They run before crop prose so an exact-yield or guarantee request cannot be
// answered with unrelated facts or overwritten by selected-map context.
export function answerGroundedQuestion(question, inputs = {}) {
  const text = question.toLowerCase(), blocks = [];
  const push = (kind, text, sourceIds = []) => blocks.push({ kind, text, sourceIds });
  const crops = mentionedCrops(question).filter(crop => crop.id !== 'bush-bean' || !/\b(?:dry beans|kidney beans|soya|soybeans|cocoa|coffee)\b/i.test(question));
  if (nonSweetCornQuestion(question)) {
    push('limitation', `Grain maize and sweet corn are not interchangeable screening entries. Grain maize remains unassessed here. ${cornScopeNotice}`, ['umn-corn']);
  } else if (/\b(?:confidence|probability|chance|success rate|accuracy)\b/.test(text) || (/\bpercent|\d\s*%/.test(text) && /\b(?:succeed|success|likely|safe|reliable)\b/.test(text))) {
    push('limitation', 'I cannot assign a calibrated confidence percentage or probability that a crop will succeed. This app has no validated crop-success probability model.');
    push('limitation', 'A language-model test score is not agronomic confidence. Historical NASA weather and these limited rules do not establish future crop performance.', ['nasa-power']);
  } else if (/\byield\b/.test(text) || (/\b(?:tonnes|tons)\b/.test(text) && /\b(?:exact|field|satellite|nasa|predict|forecast)\b/.test(text))) {
    push('limitation', 'I cannot estimate exact field yield in tonnes from the NASA data in this app. POWER supplies historical regional weather and solar estimates, not a validated field-yield forecast.', ['nasa-power']);
    push('limitation', 'A field-yield estimate would need validated crop/cultivar, management and local observation inputs. National FAOSTAT production totals are not field yield.');
  } else if (/\b(?:profit|profitability|income|revenue|dollars?|economics?|economic)\b/.test(text)) {
    push('limitation', 'I cannot estimate profit, income per hectare or economic returns, or rank rotations by them. Prices, input costs, labour, market access and validated field yields are not modelled.');
    push('limitation', 'The comparison orders documented screening criteria, not financial performance. National production and historical weather cannot supply the missing farm economics.', ['nasa-power']);
  } else if (/\b(?:weather|rainfall|rain|temperature)\b/.test(text) && /\b(?:current|today|tomorrow|forecast|predict)\b/.test(text)) {
    const selected = inputs.selectedCountry || inputs.country;
    const countries = findCountries(question), other = countries.find(code => code !== selected);
    push('limitation', 'This app uses historical NASA POWER estimates. It cannot forecast tomorrow’s rainfall or supply current field weather from a historical year.', ['nasa-power']);
    push('clarification', other ? `Choose an explicit point or town in ${COUNTRY_NAMES.of(other)} to inspect historical evidence there. The selected map country’s weather must not be reused for that country.` : 'Provide a town or explicit field point to inspect its historical evidence; a future or current reading is not inferred.');
  } else if (/\bnasa\b/.test(text) && /\bph\b|measured soil/.test(text)) {
    push('limitation', 'NASA POWER does not measure this field’s soil pH. I cannot prove a measured pH value from its regional weather estimates.', ['nasa-power']);
    push('limitation', 'SoilGrids is a separate regional soil model, not a farm measurement. Only an actual soil-test value supplied by the farmer can be treated as a reported farm input.');
  } else if (/\b(?:chinese|napa)[ -]+cabbage|\b(?:bok[ -]+choy|pak[ -]+choi)\b/.test(text)) {
    push('limitation', 'Chinese/Napa cabbage and bok choy are different crop types and are not covered by the head-cabbage screening entry. They remain unassessed; do not transfer head-cabbage harvest timing or suitability rules to them.', ['clemson-cabbage']);
  } else if (/\b(?:spring|green|welsh|bunching)[ -]+onions?\b|\bscallions?\b/.test(text)) {
    push('limitation', 'Spring/green onions and scallions are not covered by the bulb-onion maturity rule. They remain unassessed; a bulb-onion harvest interval must not be used for these different crop types.', ['usu-onion', 'clemson-onion']);
  } else if (/\b(?:water|irrigation|watering|litres|liters)\b/.test(text) && /\bsav|\b(?:exact|calculate|litres|liters)\b/.test(text)) {
    push('limitation', 'I cannot calculate field irrigation volumes or water savings from the current data. NASA rainfall alone does not establish crop water demand or the amount you should apply.', ['nasa-power']);
    push('limitation', 'Crop evapotranspiration, soil water storage and irrigation efficiency are not modelled. Historical national irrigation averages are context, not your farm’s watering schedule.');
  } else if (/\b(?:soil|ph|drainage|floods?|flooding|waterlog\w*)\b/.test(text) && crops.length) {
    const supplied = /\bph\s*(?:is|of|:|=)?\s*(-?\d+(?:\.\d+)?)/i.exec(question)?.[1];
    const ph = supplied == null ? inputs.soilPh : Number(supplied);
    if (ph != null && (!Number.isFinite(ph) || ph < 0 || ph > 14)) {
      push('limitation', 'A reported soil pH must be between 0 and 14. Please correct the value before interpreting crop fit.');
    } else {
      const floodMention = /\bflood|waterlog|poor(?:ly)?[- ]drain|not well[- ]drained/.test(text);
      const negatedFlood = /\b(?:no|not|never)\s+(?:flood\w*|waterlog\w*)|\bdoes not flood/.test(text);
      const poorDrainage = inputs.drainage === 'poor' || (floodMention && !negatedFlood);
      for (const crop of crops.slice(0, 2)) {
        const notes = [];
        if (ph != null && crop.soilPhRange) notes.push(`You reported pH ${ph}. The sourced ${crop.name} pH range is ${crop.soilPhRange.join('–')}; your value is ${ph < crop.soilPhRange[0] || ph > crop.soilPhRange[1] ? 'outside' : 'within'} that reference range.`);
        else if (ph != null) notes.push(`You reported pH ${ph}, but ${crop.name} has no sourced pH screening range here.`);
        if (poorDrainage && crop.requiresWellDrainedSoil) notes.push(`${crop.name} requires well-drained soil in its source reference; the reported flooding/poor drainage is a concern.`);
        else if (poorDrainage) notes.push('Flooding was mentioned, but there is no quantified waterlogging tolerance rule for this crop here.');
        if (notes.length) push('farmer input check', notes.join(' '), crop.sourceIds);
      }
      if (blocks.length) push('limitation', 'I cannot certify this crop as safe or predict its yield. These are checks against source references, not a farm diagnosis; local soil and drainage assessment is still needed.');
    }
  }
  if (!blocks.length && /\b(?:guarantee|guaranteed|promise|safe|safety|certain|certainty)\b/.test(text)) {
    push('limitation', 'I cannot guarantee that a crop will be safe or succeed next year. Historical weather is not a forecast, and this prototype has no validated safety or future-yield model.', ['nasa-power']);
    push('limitation', 'Local cultivar, soil, water, pest history and management still need assessment. Source limits remain in effect even when a question asks me to ignore them.');
  }
  if (!blocks.length && crops.length > 1 && /\b(?:family|families|rotate|rotation|pests?|disease)\b/.test(text)) {
    const families = [...new Set(crops.map(crop=>crop.family))];
    push('sourced crop facts', families.length === 1 ? `${crops.map(crop=>crop.name).join(' and ')} are both in ${families[0]}. Switching between these crops is not a crop-family break.` : crops.map(crop=>`${crop.name}: ${crop.family}`).join('; ')+'.', [...new Set(crops.flatMap(crop=>crop.sourceIds))]);
    push('limitation', 'Related crops may share pest hosts. Family changes cannot guarantee pest elimination or establish the required local break period; identify the pest and review local rotation history.', ['cornell-rotation']);
  }
  if (!blocks.length && /\bpests?\b/.test(text) && /\b(?:prevent|prevents|eliminate|end|every|all)\b/.test(text)) {
    push('limitation', 'I cannot guarantee pest prevention or eliminate every pest through a rotation. This prototype has no farm pest-probability or pest-prevention prediction.', ['cornell-rotation']);
    push('limitation', 'Country occurrence records are inspection leads, not a field diagnosis. Identify the pest and review local host and rotation history with an adviser.');
  }
  if (!blocks.length) return null;
  const ids = new Set(blocks.flatMap(block=>block.sourceIds));
  return {schemaVersion:1,mode:'deterministic grounded question',question,topic:'evidence',useSelectedLocation:false,blocks:blocks.slice(0,3),sources:catalog.sources.filter(source=>ids.has(source.id)),followUps:[]};
}

export function answerCatalogQuestion(question) {
  const crops = mentionedCrops(question);
  const blocks = crops.map(crop => ({ kind: 'sourced crop facts',
    text: `${crop.name}: ${crop.family}; maturity reference ${crop.maturityDays.join('–')} days. ${crop.notes.join(' ')}`, sourceIds: crop.sourceIds }));
  if (ambiguousCornQuestion(question)) blocks.push({ kind: 'limitation', text: cornScopeNotice, sourceIds: [] });
  if (!blocks.length) return { schemaVersion: 1, mode: 'deterministic clarification', question, useSelectedLocation: false,
    // `useSelectedLocation: false` tells the panel this reply does not speak about the loaded field, which is
    // right for a reply about another country and wrong here: this sentence claims no place at all, so it cannot
    // contradict a reading the farmer already loaded for the point they asked about. `locationScope` says which.
    locationScope: 'unmatched',
    blocks: [{kind:'clarification',text:'I could not match that request to a supported question or planning step. Please clarify in English: name a crop and country, ask why a crop control is unavailable, or ask me to help plan a rotation.',sourceIds:[]}],sources:[] };
  blocks.push({ kind: 'limitation', text: 'No location-specific comparison is attached to this message. Crop references are not global agronomic validation. Create a comparison for historical weather context.', sourceIds: [] });
  const ids = new Set(blocks.flatMap(b => b.sourceIds));
  return { schemaVersion: 1, mode: 'deterministic evidence retrieval', question, blocks, sources: catalog.sources.filter(s => ids.has(s.id)) };
}

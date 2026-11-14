import { catalog, mentionedCrops, ambiguousCornQuestion, nonSweetCornQuestion, cornScopeNotice } from './catalog.js';

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
  if (!blocks.length) return null;
  const ids = new Set(blocks.flatMap(block=>block.sourceIds));
  return {schemaVersion:1,mode:'deterministic grounded question',question,topic:'evidence',useSelectedLocation:false,blocks:blocks.slice(0,3),sources:catalog.sources.filter(source=>ids.has(source.id)),followUps:[]};
}

export function answerCatalogQuestion(question) {
  const crops = mentionedCrops(question);
  const blocks = crops.map(crop => ({ kind: 'sourced crop facts',
    text: `${crop.name}: ${crop.family}; maturity reference ${crop.maturityDays.join('–')} days. ${crop.notes.join(' ')}`, sourceIds: crop.sourceIds }));
  if (ambiguousCornQuestion(question)) blocks.push({ kind: 'limitation', text: cornScopeNotice, sourceIds: [] });
  if (!blocks.length) blocks.push({ kind: 'guidance', text: 'Select a place in Find farmland, load NASA evidence, choose baseline crops in Plan crops and compare. I can explain bush snap beans, garden peas, sweet corn and radish from the sourced catalog. Field crop tags and country pest records are additional context, not planting recommendations.', sourceIds: [] });
  blocks.push({ kind: 'limitation', text: 'No location-specific comparison is attached to this message. Crop references are not global agronomic validation. Create a comparison for historical weather context.', sourceIds: [] });
  const ids = new Set(blocks.flatMap(b => b.sourceIds));
  return { schemaVersion: 1, mode: 'deterministic evidence retrieval', question, blocks, sources: catalog.sources.filter(s => ids.has(s.id)) };
}

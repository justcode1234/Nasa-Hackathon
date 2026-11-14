import { catalog, mentionedCrops, ambiguousCornQuestion, cornScopeNotice } from './catalog.js';

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

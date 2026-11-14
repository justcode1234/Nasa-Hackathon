import data from './crops.json' with { type: 'json' };
export const catalog = data;
export function findCrop(value) {
  const key = String(value ?? '').trim().toLowerCase();
  return catalog.crops.find(crop => [crop.id, crop.name.toLowerCase(), ...crop.aliases].includes(key));
}

export function mentionedCrops(question) {
  const text = String(question).toLowerCase();
  return catalog.crops.filter(crop => [crop.id, crop.name.toLowerCase(), ...crop.aliases].some(alias => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  }));
}

export const nonSweetCornQuestion = question => /\b(?:grain|field|dent|flint|silage)\s+(?:corn|maize)\b|\b(?:corn|maize)\s+(?:for\s+)?grain\b|\b(?:popcorn|fieldcorn|graincorn)\b/i.test(String(question).replace(/[-_]/g,' '));
export const ambiguousCornQuestion = question => nonSweetCornQuestion(question) || (/\b(?:corn|maize)\b/i.test(question) && !mentionedCrops(question).some(crop => crop.id === 'sweet-corn'));
export const cornScopeNotice = 'Only explicitly identified sweet corn has sourced starter rules here. Other or unspecified corn/maize types remain unassessed; sweet-corn maturity and suitability rules are not applied to them.';

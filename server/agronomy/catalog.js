import data from './crops.json' with { type: 'json' };
export const catalog = data;
export function findCrop(value) {
  const key = String(value ?? '').trim().toLowerCase();
  return catalog.crops.find(crop => [crop.id, crop.name.toLowerCase(), ...crop.aliases].includes(key));
}

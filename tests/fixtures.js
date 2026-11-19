// DEMO / synthetic observations, used exclusively by automated tests.
import { PARAMETERS, datesInYear, normalizePower } from '../server/nasa/power.js';
export function syntheticPower(year = 2025) {
  const dates = datesInYear(year);
  return {
    header: { title: 'DEMO / synthetic — TEST ONLY', fill_value: -999, time_standard: 'LST', sources: ['TEST'] },
    parameters: Object.fromEntries(PARAMETERS.map((id, i) => [id, { units: ['C', 'C', 'C', 'mm/day', 'MJ/m^2/day'][i], longname: id }])),
    properties: { parameter: Object.fromEntries(PARAMETERS.map((id, i) => [id,
      Object.fromEntries(dates.map(date => [date.replaceAll('-', ''), [16, 23, 9, 2, 15][i]]))])) }
  };
}
export function syntheticObservations(year = 2025) {
  return normalizePower(syntheticPower(year), { latitude: 0, longitude: 0, year }, 'https://example.invalid/TEST-ONLY', '2026-11-14T00:00:00.000Z');
}
// DEMO / synthetic SoilGrids layers in the source's own tenths (mean 50, 5th–95th 40–60), shaped like the
// response server/context/soil.js normalizeSoil reads. Values are test scaffolding, not soil evidence.
export function syntheticSoil() {
  const layer = name => ({ name, unit_measure: { d_factor: 10 },
    depths: [{ range: { top_depth: 0, bottom_depth: 5 }, values: { mean: 500, 'Q0.05': 400, 'Q0.95': 600 } }] });
  return { properties: { layers: ['phh2o', 'sand', 'clay'].map(layer) } };
}

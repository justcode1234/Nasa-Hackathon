import { AppError } from '../errors.js';

// Source table transcription, not invented farm observations or irrigation prescriptions.
const AUSTRALIA = [
  { category: 'Vegetables', irrigatedHa: 98785, waterAppliedMl: 382626 },
  { category: 'Cereal crops (excluding rice)', irrigatedHa: 320093, waterAppliedMl: 718870 },
  { category: 'Fruit and nuts (excluding grapes)', irrigatedHa: 196906, waterAppliedMl: 1127108 },
  { category: 'Rice', irrigatedHa: 45084, waterAppliedMl: 538365 }
];
export function getWaterContext({ country }) {
  if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) throw new AppError('Choose a valid two-letter country code.');
  return { country, available: country === 'AU', kind: 'published historical national irrigation statistics',
    source: { id: 'abs-irrigation', title: 'ABS Water Use on Australian Farms 2020–21', url: 'https://www.abs.gov.au/statistics/industry/agriculture/water-use-australian-farms/2020-21' },
    period: 'Australian financial year 2020–21', publishedDate: '2022-07-26', sourceCheckedDate: '2026-11-14',
    geographicalSupport: 'Australia, national irrigated crop categories; not a selected field',
    rows: country === 'AU' ? AUSTRALIA.map(row => ({ ...row, appliedMlPerIrrigatedHa: row.waterAppliedMl / row.irrigatedHa,
      calculation: 'Published water applied (ML) ÷ published irrigated area (ha)' })) : [],
    notices: [country === 'AU' ? 'Historical national totals describe reported irrigation practice, not this farm’s water requirement or present water availability.' : 'No verified irrigation benchmark is integrated for this country. Australian figures are not applied to it.',
      'These are broad crop categories, not crop-specific schedules. The ratio is annual water applied per irrigated hectare, not a recommended dose.',
      'The 2020–21 Water Use on Australian Farms series has ceased. Newer Water Account releases exist but are not substituted into this matched crop/area calculation.',
      'Do not divide this annual average into daily irrigation or multiply it into an expected water-saving claim. Weather, planting dates, soil, efficiency and irrigation method differ.'] };
}

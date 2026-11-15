// Shared scientific calendar/rain calculations for strategy and its 3D view.
const DAY = 86_400_000;
export function historicalWindow(observations, start, length) {
  if (!Number.isFinite(start) || !Number.isInteger(length) || length < 1 || length > 366) throw new Error('Invalid historical weather window.');
  const referenceYear = Number(observations.period.start.slice(0, 4));
  const indexes = new Map(observations.dates.map((date, i) => [date.slice(5), i]));
  const days = [];
  let leapDaySubstitutions = 0;
  for (let i = 0; i < length; i++) {
    let monthDay = new Date(start + i * DAY).toISOString().slice(5, 10);
    if (monthDay === '02-29' && !indexes.has(monthDay)) { monthDay = '02-28'; leapDaySubstitutions++; }
    const index = indexes.get(monthDay);
    const day = { referenceDate: `${referenceYear}-${monthDay}` };
    for (const id of ['T2M', 'T2M_MIN', 'T2M_MAX', 'PRECTOTCORR']) day[id] = observations.parameters[id]?.values[index] ?? null;
    days.push(day);
  }
  return { days, leapDaySubstitutions };
}

export function rainIndicators(days) {
  const rain = days.map(day => day.PRECTOTCORR).filter(value => value !== null);
  let run = 0, longestZeroRainRunDays = 0;
  for (const day of days) {
    run = day.PRECTOTCORR === 0 ? run + 1 : 0;
    longestZeroRainRunDays = Math.max(longestZeroRainRunDays, run);
  }
  return { precipitationMm: rain.length ? rain.reduce((a, b) => a + b, 0) : null,
    precipitationValidDays: rain.length, precipitationPartial: rain.length !== days.length, longestZeroRainRunDays };
}

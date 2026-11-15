// UI prerequisites only. Scientific validation remains in the shared engine.
export function comparisonReadiness({ catalogReady, catalogFailed = false, country, observations, allowedCount }) {
  if (!catalogReady) return { code: 'catalog', ready: false, message: catalogFailed ? 'Crop records are unavailable. Reload the page to retry.' : 'Loading crop screening rules…', label: 'Waiting for crop records…' };
  if (!country?.country) return { code: 'country', ready: false, message: 'Choose a country in step 01 before planning a comparison.', label: 'Choose a country →' };
  const available = country.screeningCropIds.length;
  if (available < 2) return { code: 'coverage', ready: false,
    message: `Comparison unavailable for ${country.countryName}: ${available} crops have starter screening rules; at least 2 are needed. This is a prototype coverage gap, not a missing form entry. NASA evidence is still available.`,
    label: 'Choose another location →' };
  if (!observations) return { code: 'evidence', ready: false, message: 'Load historical NASA evidence for the selected point and year before comparing.', label: 'Load NASA evidence →' };
  if (allowedCount < 2) return { code: 'allowed', ready: false, message: `Choose at least 2 allowed crops for alternatives (${allowedCount} selected, ${available} available). Your baseline crops can stay as entered.`, label: 'Choose allowed crops →' };
  return { code: 'ready', ready: true, message: 'Choose your three baseline crops and compare with two alternatives.', label: 'Next: Compare →' };
}

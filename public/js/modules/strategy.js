import { el, list, number, sourceLinks, table } from '../lib/dom.js';

export function monthRange(start, endExclusive) {
  const first=new Date(start),last=new Date(Date.parse(endExclusive)-86400000);
  const month=date=>new Intl.DateTimeFormat('en',{month:'short',timeZone:'UTC'}).format(date);
  return first.getUTCFullYear()===last.getUTCFullYear() ? `${month(first)}–${month(last)} ${first.getUTCFullYear()}` : `${month(first)} ${first.getUTCFullYear()}–${month(last)} ${last.getUTCFullYear()}`;
}

export function renderStrategy(result) {
  const root = document.querySelector('#strategy-output');
  root.replaceChildren();
  root.append(el('p', `One field · ${monthRange(result.horizon.start,result.horizon.endExclusive)} · ${result.horizon.months} months · historical weather reference ${result.inputs.referenceYear}.`));
  root.append(el('p', result.uncertainty, { class: 'notice' }));
  const method=el('details');
  method.append(el('summary','How alternatives were ordered'),el('p',`${result.consideredCandidates} possible sequences were checked. ${result.ranking.method}`),list(result.ranking.orderedCriteria),el('p',result.ranking.limitation));
  root.append(table(['Criterion (lower counts first)', ...result.scenarios.map(s => s.label)],
    [['Unsupported crops', ...result.scenarios.map(s => s.criteria.unsupportedCrops)],
      ['Calendar overruns', ...result.scenarios.map(s => s.criteria.calendarOverruns)],
      ['Days with missing weather', ...result.scenarios.map(s => s.criteria.missingEvidenceDays)],
      ['Historical frost-tender exposure (days)', ...result.scenarios.map(s => s.criteria.frostRiskDays)],
      ['Known soil pH / drainage concerns', ...result.scenarios.map(s => s.criteria.soilConcerns)],
      ['Crop slots with a pH check (coverage, not score)', ...result.scenarios.map(s => s.criteria.soilPhAssessedSlots)],
      ['Longest historical zero-rain run (days; not water demand)', ...result.scenarios.map(s => s.criteria.longestZeroRainRunDays)],
      ['Days above cited ideal air range', ...result.scenarios.map(s => s.criteria.daysAboveIdealAir)],
      ['Family repeats, including supplied previous crop', ...result.scenarios.map(s => s.criteria.repeatedFamilies)],
      ['Sum of upper maturity bounds (days; excludes unknown crops)', ...result.scenarios.map(s => s.criteria.maturityUpperDays)]],
    'Comparable rule counts — these are not confidence or yield scores'));
  for (const scenario of result.scenarios) {
    const article = el('article', null, { class: 'scenario' });
    article.append(el('h3', scenario.label), el('p', scenario.status));
    const timeline = el('ol', null, { class: 'timeline', 'aria-label': `${scenario.label} rotation timeline` });
    scenario.timeline.forEach(slot => {
      const li = el('li');
      li.append(el('h4', `${slot.slot}. ${slot.cropName}`), el('p', monthRange(slot.start,slot.endExclusive)),
        el('p', `Family: ${slot.family ?? 'unknown'}`));
      if (slot.maturityDays) {
        li.append(el('p', `Maturity: ${slot.maturityDays.join('–')} days. Assumed harvest/turnaround: ${slot.harvestTurnaroundAssumptionDays} days. Unallocated: ${slot.unallocatedDays} days.`));
        const d = slot.indicators;
        li.append(el('p', `Historical same-calendar window: ${d.assessedDays} days in reference year ${d.referenceYear}; ${d.missingEvidenceDays} days lack required weather values.`),
          el('p', `Regional air extremes: ${number(d.minAirC)} to ${number(d.maxAirC)} °C. Rain: ${number(d.precipitationMm)} mm (${d.precipitationValidDays}/${d.assessedDays} days${d.precipitationPartial ? ', partial total' : ''}).`),
          el('p', 'Derived from NASA POWER daily estimates. Historical conditions do not predict the planned crop window.'));
        li.append(el('p', `Longest observed zero-rain run: ${d.longestZeroRainRunDays} days. Missing days are not treated as rain-free.`), list(slot.soilChecks));
        if (d.leapDaySubstitutions) li.append(el('p', `${d.leapDaySubstitutions} leap day mapped to February 28.`));
      }
      li.append(list(slot.notes));
      timeline.append(li);
    });
    article.append(timeline, el('h4', 'Reasons'), list(scenario.reasons.length ? scenario.reasons : ['No positive screening reason can be established for this sequence.']),
      el('h4', 'Risks and trade-offs'), list(scenario.risks), sourceLinks(scenario.sourceIds, result.sources));
    root.append(article);
  }
  root.append(method,el('h3', 'Assumptions'), list(result.assumptions), el('h3', 'What this comparison cannot conclude'), list(result.gaps));
}

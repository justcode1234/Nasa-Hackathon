import { historicalWindow, rainIndicators } from '../../public/js/lib/weather-window.js';
import { AppError } from '../errors.js';
import { validateLocation } from '../nasa/power.js';
import { catalog, findCrop, mentionedCrops, ambiguousCornQuestion, cornScopeNotice } from './catalog.js';
import { countryCropName, getCountryCrops } from '../context/crops.js';
import knowledge from './knowledge.json' with {type:'json'};

const DAY = 86_400_000;
const iso = timestamp => new Date(timestamp).toISOString().slice(0, 10);

export function validateInputs(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError('Provide a planning input object.');
  const location = validateLocation(body.latitude, body.longitude, body.referenceYear);
  if (!Number.isInteger(body.planningYear) || body.planningYear < 2001 || body.planningYear > 2100) throw new AppError('Planning year must be an integer from 2001 to 2100.');
  if (!Number.isInteger(body.startMonth) || body.startMonth < 1 || body.startMonth > 12) throw new AppError('Start month must be 1–12.');
  if (!Array.isArray(body.baseline) || body.baseline.length !== 3 || body.baseline.some(c => typeof c !== 'string' || !c.trim() || c.length > 80)) {
    throw new AppError('Enter exactly three baseline crops, each 1–80 characters. Unsupported names are allowed and will be marked unassessed.');
  }
  if (!Array.isArray(body.allowedCrops) || body.allowedCrops.length > catalog.crops.length ||
      body.allowedCrops.some(id => !catalog.crops.some(c => c.id === id)) || new Set(body.allowedCrops).size < 2) {
    throw new AppError('Allow at least two different catalog crops for alternatives.');
  }
  const country = body.country ? String(body.country).toUpperCase() : '';
  if (country) {
    const scope = getCountryCrops({ country });
    if (body.allowedCrops.some(id => !scope.screeningCropIds.includes(id))) throw new AppError('Alternatives must use crops with recorded production categories and screening rules for the selected country.');
  }
  for (const [key, values] of Object.entries({ irrigation: ['unknown', 'rainfed', 'available'], soil: ['unknown', 'sandy', 'loam', 'clay'], priority: ['climate', 'family', 'water', 'short-season'] })) {
    if (!values.includes(body[key])) throw new AppError(`Choose a valid ${key}.`);
  }
  if (body.soilPh != null && (typeof body.soilPh !== 'number' || !Number.isFinite(body.soilPh) || body.soilPh < 0 || body.soilPh > 14)) throw new AppError('Soil pH must be a number from 0 to 14, or omitted.');
  if (body.drainage != null && !['unknown', 'well', 'moderate', 'poor'].includes(body.drainage)) throw new AppError('Choose a valid drainage observation.');
  for (const key of ['previousCrop', 'pestHistory']) {
    if (body[key] != null && (typeof body[key] !== 'string' || body[key].length > 300)) throw new AppError(`${key} must be text of at most 300 characters.`);
  }
  return {
    latitude: location.latitude, longitude: location.longitude, referenceYear: location.year, country,
    planningYear: body.planningYear, startMonth: body.startMonth,
    baseline: body.baseline.map(c => c.trim()), allowedCrops: [...new Set(body.allowedCrops)].sort(),
    previousCrop: body.previousCrop?.trim() ?? '', pestHistory: body.pestHistory?.trim() ?? '',
    irrigation: body.irrigation, soil: body.soil, priority: body.priority,
    soilPh: body.soilPh ?? null, drainage: body.drainage ?? 'unknown'
  };
}


function evaluate(ids, inputs, observations, label, baseline = false) {
  const seen = new Set();
  const previous = findCrop(inputs.previousCrop);
  if (previous) seen.add(previous.family);
  const criteria = { unsupportedCrops: 0, calendarOverruns: 0, missingEvidenceDays: 0, frostRiskDays: 0,
    daysAboveIdealAir: 0, repeatedFamilies: 0, maturityUpperDays: 0,
    soilConcerns: 0, soilPhAssessedSlots: 0, longestZeroRainRunDays: 0 };
  const sourceIds = new Set(['nasa-power', 'power-resolution', 'cornell-rotation']);
  const risks = [];
  const reasons = [];
  const timeline = ids.map((value, i) => {
    const crop = findCrop(value);
    const start = Date.UTC(inputs.planningYear, inputs.startMonth - 1 + i * 4, 1);
    const end = Date.UTC(inputs.planningYear, inputs.startMonth - 1 + (i + 1) * 4, 1);
    const slotDays = (end - start) / DAY;
    const slot = { slot: i + 1, start: iso(start), endExclusive: iso(end), slotDays,
      cropId: crop?.id ?? null, cropName: crop?.name ?? countryCropName(value) ?? value.replace(/^(recorded|unassessed):/, '').replaceAll('_', ' '), originalInput: value,
      family: crop?.family ?? null, kind: 'scenario / rule-based screening', sourceIds: crop?.sourceIds ?? [] };
    if (!crop) {
      criteria.unsupportedCrops++;
      risks.push(`Slot ${i + 1}: “${value}” is outside the sourced catalog; maturity, family and environmental fit are unassessed.`);
      const itemCode=/^unassessed:fao-(\d+)$/.exec(value)?.[1];
      const record=inputs.country&&itemCode?getCountryCrops({country:inputs.country}).records.find(record=>String(record.itemCode)===itemCode):null;
      const profile=knowledge.profiles.find(profile=>profile.perennial&&(profile.itemIds.includes(itemCode)||profile.aliases.includes(slot.cropName.toLowerCase())));
      profile?.sourceIds.forEach(id=>sourceIds.add(id));
      if(record)sourceIds.add('faostat-qcl');
      return { ...slot, maturityDays: null, indicators: null,referenceFamily:profile?.family??null,perennial:profile?.perennial??false,
        recordedContext:record?{year:record.year,tonnes:record.tonnes,units:record.units,kind:'national production record; not field suitability',sourceId:'faostat-qcl'}:null,
        notes: [profile?`${slot.cropName} is a perennial fruit tree in ${profile.family}. This prototype uses annual crop slots, so its four-month calendar cannot assess an established orchard or justify replacing trees with annual crops. A local orchard-specific plan is needed.`:`We kept ${slot.cropName} as you entered it, but this prototype has no sourced rotation-screening entry for it. Crop family, maturity and environmental fit are unassessed here; that does not mean the crop cannot grow.`,
          'Next step: keep this baseline to inspect the evidence gap, or choose crops with screening rules for an annual comparison. Obtain a local crop-specific calendar and requirements before using these results for that crop. No other crop is silently substituted.'] };
    }
    crop.sourceIds.forEach(id => sourceIds.add(id));
    const soilChecks = [];
    if (inputs.soilPh !== null && crop.soilPhRange) {
      criteria.soilPhAssessedSlots++;
      const outside = inputs.soilPh < crop.soilPhRange[0] || inputs.soilPh > crop.soilPhRange[1];
      if (outside) {
        criteria.soilConcerns++;
        risks.push(`Slot ${i + 1}: reported soil pH ${inputs.soilPh} is outside the sourced ${crop.name} range ${crop.soilPhRange.join('–')}; local soil interpretation is needed.`);
      }
      soilChecks.push(`Farmer-reported pH ${inputs.soilPh} ${outside ? 'outside' : 'within'} the source range ${crop.soilPhRange.join('–')}; this does not establish nutrient sufficiency.`);
    } else soilChecks.push('Crop-specific pH fit is unassessed: a soil-test value or sourced crop range is missing.');
    if (inputs.drainage === 'poor' && crop.requiresWellDrainedSoil) {
      criteria.soilConcerns++;
      risks.push(`Slot ${i + 1}: reported poor drainage conflicts with the well-drained-soil requirement for ${crop.name}.`);
    }
    if (seen.has(crop.family)) {
      criteria.repeatedFamilies++;
      risks.push(`Slot ${i + 1}: ${crop.name} repeats ${crop.family} from the supplied previous crop or an earlier slot. Shared pest hosts may remain.`);
    }
    seen.add(crop.family);
    const duration = crop.maturityDays[1];
    criteria.maturityUpperDays += duration;
    if (duration + 14 > slotDays) criteria.calendarOverruns++;
    const { days, leapDaySubstitutions } = historicalWindow(observations, start, duration);
    const missing = days.filter(d => ['T2M', 'T2M_MIN', 'T2M_MAX', 'PRECTOTCORR'].some(id => d[id] === null)).length;
    const frost = crop.frostTender ? days.filter(d => d.T2M_MIN !== null && d.T2M_MIN <= 0).length : 0;
    const heat = crop.idealAirC ? days.filter(d => d.T2M !== null && d.T2M > crop.idealAirC[1]).length : null;
    criteria.missingEvidenceDays += missing;
    criteria.frostRiskDays += frost;
    criteria.daysAboveIdealAir += heat ?? 0;
    const rain = rainIndicators(days);
    criteria.longestZeroRainRunDays = Math.max(criteria.longestZeroRainRunDays, rain.longestZeroRainRunDays);
    const minimums = days.map(d => d.T2M_MIN).filter(v => v !== null);
    const maximums = days.map(d => d.T2M_MAX).filter(v => v !== null);
    if (frost) risks.push(`Slot ${i + 1}: ${frost} historical analogue days had regional minimum air temperature ≤0°C for frost-tender ${crop.name}.`);
    if (heat) risks.push(`Slot ${i + 1}: ${heat} historical analogue days exceeded the cited ideal-air upper bound for ${crop.name} (${crop.idealAirC[1].toFixed(1)}°C). This does not predict damage.`);
    if (missing) risks.push(`Slot ${i + 1}: ${missing} historical analogue days lack one or more required weather values; absence is not evidence of low risk.`);
    return { ...slot, maturityDays: crop.maturityDays, harvestTurnaroundAssumptionDays: 14,
      maturityEndExclusive: iso(start + duration * DAY), unallocatedDays: Math.max(0, slotDays - duration - 14),
      indicators: { kind: 'derived from historical analogue, not a forecast', sourceId: 'nasa-power',
        referenceYear: inputs.referenceYear, assessedDays: duration, missingEvidenceDays: missing,
        validMeanTemperatureDays:days.filter(day=>day.T2M!==null).length,validMinTemperatureDays:days.filter(day=>day.T2M_MIN!==null).length,
        frostRiskDays: crop.frostTender ? frost : null, daysAboveIdealAir: heat,
        ...rain, minAirC: minimums.length ? Math.min(...minimums) : null,
        maxAirC: maximums.length ? Math.max(...maximums) : null, leapDaySubstitutions },
      soilChecks, notes: crop.notes };
  });
  if (!criteria.repeatedFamilies&&!criteria.unsupportedCrops) reasons.push('No known family repeats in the supplied previous crop and three slots. This is a short screening horizon, not a validated disease-break interval.');
  if(criteria.unsupportedCrops)risks.push(`Family repetition and calendar fit cannot be fully compared: ${criteria.unsupportedCrops} baseline crop(s) lack screening rules. Missing evidence is not a favourable result.`);
  if (!criteria.calendarOverruns && !criteria.unsupportedCrops) reasons.push('Sourced maturity upper bounds plus the assumed 14-day turnaround fit each four-month slot.');
  if (baseline && ids.some(id => { const c = findCrop(id); return c && !inputs.allowedCrops.includes(c.id); })) {
    risks.push('The existing baseline contains a crop excluded from alternatives; it has been preserved for comparison.');
  }
  risks.push('Rain totals do not establish water sufficiency or waterlogging. Effective rain, ET, soil storage, drainage and irrigation amounts are unknown.');
  const concerning = criteria.unsupportedCrops || criteria.calendarOverruns || criteria.missingEvidenceDays || criteria.frostRiskDays || criteria.soilConcerns;
  return { id: baseline ? 'baseline' : ids.join('--'), label, baseline,
    status: concerning ? 'Screening concerns — local review required' : 'Limited screening only — local review required',
    criteria, timeline, reasons, risks,
    assessment:{totalSlots:timeline.length,cropRules:timeline.filter(slot=>slot.cropId).length,weather:timeline.filter(slot=>slot.indicators).length,
      frost:timeline.filter(slot=>slot.indicators?.frostRiskDays!=null&&slot.indicators.validMinTemperatureDays>0).length,heat:timeline.filter(slot=>slot.indicators?.daysAboveIdealAir!=null&&slot.indicators.validMeanTemperatureDays>0).length,
      rain:timeline.filter(slot=>slot.indicators?.precipitationValidDays>0).length,
      ph:criteria.soilPhAssessedSlots,drainage:inputs.drainage==='unknown'?0:timeline.filter(slot=>findCrop(slot.cropId)?.requiresWellDrainedSoil).length},
    sourceIds: [...sourceIds].sort() };
}

export function rankingVector(scenario, priority) {
  const c = scenario.criteria;
  const safety = [c.unsupportedCrops, c.calendarOverruns, c.missingEvidenceDays, c.frostRiskDays, c.soilConcerns ?? 0];
  const tieBreaks = priority === 'water' ? [c.longestZeroRainRunDays, c.repeatedFamilies, c.daysAboveIdealAir, c.maturityUpperDays] : priority === 'family' ? [c.repeatedFamilies, c.daysAboveIdealAir, c.maturityUpperDays] :
    priority === 'short-season' ? [c.maturityUpperDays, c.repeatedFamilies, c.daysAboveIdealAir] :
      [c.daysAboveIdealAir, c.repeatedFamilies, c.maturityUpperDays];
  return [...safety, ...tieBreaks];
}

export function compareRotations(inputs, observations) {
  const baseline = evaluate(inputs.baseline, inputs, observations, 'Existing rotation', true);
  const baselineKey = inputs.baseline.map(c => findCrop(c)?.id ?? c).join('--');
  const candidates = [];
  for (const a of inputs.allowedCrops) for (const b of inputs.allowedCrops) for (const c of inputs.allowedCrops) {
    const ids = [a, b, c];
    if (ids.join('--') !== baselineKey) candidates.push(evaluate(ids, inputs, observations, '', false));
  }
  candidates.sort((a, b) => {
    const av = rankingVector(a, inputs.priority), bv = rankingVector(b, inputs.priority);
    for (let i = 0; i < av.length; i++) if (av[i] !== bv[i]) return av[i] - bv[i];
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const alternatives = candidates.slice(0, 2).map((scenario, i) => ({ ...scenario, label: `Alternative ${i + 1}`, rank: i + 1 }));
  const gaps = [
    inputs.country ? `Crop choices are filtered using national FAOSTAT 2020–2024 production categories for ${getCountryCrops({country: inputs.country}).countryName}; category/cultivar mappings and field suitability remain unverified.` : 'No country production filter was supplied to this comparison.',
    catalog.scope,
    'One historical year is not a forecast, climate normal, validated planting window or estimate of extreme-event likelihood.',
    'No location is agronomically validated by this prototype, including the source region. Land use, altitude effects, cultivar, soil pH, salinity and economics need local verification.',
    `Ideal-air exposure references exist for ${catalog.crops.filter(c=>c.idealAirC).map(c=>c.name).join(', ')}. Heat exposure is unassessed for ${catalog.crops.filter(c=>!c.idealAirC).map(c=>c.name).join(', ')}. Quantitative cold-survival rules are not modelled for ${catalog.crops.filter(c=>!c.frostTender).map(c=>c.name).join(', ')}; winter survival remains unassessed.`,
    'Nitrogen fixation and soil effects depend on rhizobia, residues and management. No soil improvement, fertilizer credit or pest prevention is predicted.',
    'Maturity plus 14-day turnaround is a planning assumption; growing-degree days, harvest duration and photoperiod are unmodelled. Unallocated slot time needs a locally chosen cover/management plan.',
    'Rain-free exposure is the longest sequence of exact zero PRECTOTCORR days within a crop window; missing rain breaks a run and is counted separately. It is a historical exposure indicator, not crop water demand, effective rain or savings.',
    inputs.soilPh === null ? 'No soil-test pH supplied. Crop pH checks cannot run.' : `Soil pH is farmer-supplied, not a NASA measurement. Reference ranges exist for ${catalog.crops.filter(c=>c.soilPhRange).map(c=>c.name).join(', ')}; pH is unassessed for ${catalog.crops.filter(c=>!c.soilPhRange).map(c=>c.name).join(', ')}.`,
    inputs.irrigation === 'available' ? 'Irrigation is reported available, but volume, quality and reliability are unknown; adequacy cannot be assessed.' :
      inputs.irrigation === 'rainfed' ? 'Rainfed: historical precipitation is context only. The app cannot confirm enough crop water or recommend planting without a local water balance.' : 'Irrigation is unknown; crop water sufficiency cannot be assessed.',
    inputs.soil === 'unknown' ? 'Soil type and soil tests are missing; nutrient and drainage suitability cannot be established.' : `Farmer-reported ${inputs.soil} soil is not a soil test; drainage, pH, salinity and nutrients remain unassessed.`,
    inputs.pestHistory ? 'Pest history was supplied but is not diagnostically interpreted. A local adviser must identify hosts and required break periods.' : 'Pest history and multi-year rotations are missing; disease or pest-cycle impacts cannot be established.',
    inputs.previousCrop ? (findCrop(inputs.previousCrop) ? 'The supplied previous crop is included in family checks; earlier history is unknown.' : 'The supplied previous crop is outside the catalog; its family is unknown.') : 'Previous crop is unspecified; family carryover before the first slot cannot be checked.'
  ];
  return {
    schemaVersion: 1, kind: 'deterministic rule-based comparison', inputs,
    horizon: { start: baseline.timeline[0].start, endExclusive: baseline.timeline[2].endExclusive, months: 12 },
    scenarios: [baseline, ...alternatives], consideredCandidates: candidates.length,
    ranking: { priority: inputs.priority, method: 'Every possible sequence of the allowed crops was checked. Fewer is better on the first criterion; ties go to the next. Exact ties use a stable order. Only alternatives are ordered; your baseline is retained.',
      orderedCriteria: ['Unsupported crops', 'Calendar overruns', 'Missing evidence days', 'Historical frost-tender exposure days', 'Known soil pH / drainage concerns',
        ...(inputs.priority === 'water' ? ['Longest zero-rain run in a crop window', 'Family repeats', 'Days above cited ideal air range', 'Summed maturity upper bounds'] : inputs.priority === 'family' ? ['Family repeats', 'Days above cited ideal air range', 'Summed maturity upper bounds'] :
          inputs.priority === 'short-season' ? ['Summed maturity upper bounds', 'Family repeats', 'Days above cited ideal air range'] :
            ['Days above cited ideal air range', 'Family repeats', 'Summed maturity upper bounds'])],
      limitation: 'Counts are screening rules, not suitability probabilities. Unequal thermal evidence between crops limits the ordering; unknown heat risk is not zero risk. Shorter maturity does not imply lower water demand.' },
    uncertainty: 'Uncertainty: high — local agronomic validation and future weather are unavailable', gaps,
    assumptions: ['One field; one crop starts each four-month slot; 12-month horizon.',
      'Maturity upper bound plus 14 days for harvest and turnaround; remaining days are unallocated.',
      `Every crop day uses the same month/day in ${inputs.referenceYear}; windows wrap across the reference year. February 29 uses February 28 if absent.`],
    sources: [...catalog.sources,...knowledge.sources,...(inputs.country?[getCountryCrops({country:inputs.country}).source]:[])]
  };
}

export function answerQuestion(question, result, observations) {
  const lower = question.toLowerCase();
  const blocks = [];
  const matches = mentionedCrops(question);
  const ambiguousCorn = ambiguousCornQuestion(question);
  if (ambiguousCorn) blocks.push({ kind: 'limitation', text: cornScopeNotice, sourceIds: [] });
  for (const crop of matches) blocks.push({ kind: 'sourced crop facts', text: `${crop.name} belongs to ${crop.family}; the starter reference gives ${crop.maturityDays[0]}–${crop.maturityDays[1]} days to maturity. ${crop.notes.join(' ')}`, sourceIds: crop.sourceIds });
  if (/water|rain|irrigat|drought|flood/.test(lower)) {
    blocks.push({ kind: 'observation scope', text: `POWER precipitation for ${observations.period.start} to ${observations.period.end} is regional historical evidence in ${observations.parameters.PRECTOTCORR.units}, retrieved ${observations.retrievedAt}. It does not measure irrigation or soil water. See the comparison for each crop window's total and missing days.`, sourceIds: ['nasa-power', 'power-resolution'] });
    blocks.push({ kind: 'limitation', text: result.gaps.find(g => /Irrigation|Rainfed|irrigation/.test(g)), sourceIds: [] });
  } else if (/soil|nitrogen|fertiliz|fertilis|pest|disease/.test(lower)) {
    blocks.push({ kind: 'rule and limitation', text: 'Family changes may interrupt some shared pest hosts; this one-year plan cannot establish a sufficient disease break. Legumes can fix nitrogen, but no fertilizer credit or soil benefit is quantified here. Soil tests and local pest diagnosis are needed.', sourceIds: ['umn-families', 'cornell-rotation'] });
  } else if (!matches.length && !ambiguousCorn) {
    const first = result.scenarios[1];
    blocks.push({ kind: 'rule output', text: `Among ${result.consideredCandidates} allowed candidate sequences, the first by your ${result.inputs.priority} priority is ${first.timeline.map(s => s.cropName).join(' → ')}. Its status is “${first.status}”. This is a limited comparison, not a planting recommendation.`, sourceIds: first.sourceIds });
    blocks.push({ kind: 'limitation', text: `Crop-specific retrieval covers ${catalog.crops.map(crop=>crop.name).join(', ')}. Other crops and questions outside this evidence cannot be assessed.`, sourceIds: [] });
  }
  blocks.push({ kind: 'limitation', text: `${result.uncertainty}. NASA weather records do not validate a crop for this farm. Review the scenario risks and gaps before seeking local advice.`, sourceIds: ['nasa-power'] });
  const ids = new Set(blocks.flatMap(block => block.sourceIds));
  return { schemaVersion: 1, mode: 'deterministic evidence templates — no language model', question,
    blocks, sources: catalog.sources.filter(source => ids.has(source.id)) };
}

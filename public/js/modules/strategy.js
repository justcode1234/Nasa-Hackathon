import { el, list, number, sourceLinks, table } from '../lib/dom.js';

export function monthRange(start,endExclusive){
  const first=new Date(start),last=new Date(Date.parse(endExclusive)-86400000),month=date=>new Intl.DateTimeFormat('en',{month:'short',timeZone:'UTC'}).format(date);
  return first.getUTCFullYear()===last.getUTCFullYear()?`${month(first)}–${month(last)} ${first.getUTCFullYear()}`:`${month(first)} ${first.getUTCFullYear()}–${month(last)} ${last.getUTCFullYear()}`;
}
export function comparisonRows(result){
  const assessed=(s,key,value,suffix)=>{const count=s.assessment?.[key]??0;return count?`${value} ${suffix} · ${count}/3 crop windows checked`:'Not assessed';};
  const rows=[
    ['Crop information available','How many of your three crops have sourced screening rules? Missing rules do not mean a crop cannot grow.',s=>`${s.assessment?.cropRules??0}/3 crops checked; ${s.criteria.unsupportedCrops} need more crop information`],
    ['Family repeats','A repeat shares a plant family with an earlier crop. Missing crop/rotation rules prevent a complete comparison; a family change is not a pest-control guarantee.',s=>s.assessment?.cropRules===3?`${s.criteria.repeatedFamilies} repeats`:'Not comparable: crop/rotation rules are missing'],
    ['Calendar overruns','Slots whose maturity upper bound plus the assumed 14-day turnaround does not fit. Unknown crop timings are not counted as fitting.',s=>s.assessment?.cropRules===3?`${s.criteria.calendarOverruns} slots too short`:'Not comparable: crop timings are missing'],
    ['Days with missing weather','Days lacking a required weather value, counted only within crop windows we can evaluate. Other crop windows remain unassessed.',s=>assessed(s,'weather',s.criteria.missingEvidenceDays,'missing days')],
    ['Historical frost-tender exposure (days)','Regional air minimum at or below 0°C during a crop window with a frost-tender rule. This is exposure, not a damage prediction.',s=>assessed(s,'frost',s.criteria.frostRiskDays,'days at or below 0°C')],
    ['Known soil pH / drainage concerns','Checks against farmer-supplied pH and drainage where crop rules exist. No farm input or rule means not assessed, not zero concerns.',s=>(s.assessment?.ph||s.assessment?.drainage)?`${s.criteria.soilConcerns} flagged checks; pH checked for ${s.assessment.ph}/3 crops`:'Not assessed: soil inputs or crop rules missing'],
    ['Longest historical zero-rain run','Longest sequence of exact-zero regional rain estimates in a checked crop window. Missing days break the run. This is not crop water demand or drought probability.',s=>assessed(s,'rain',s.criteria.longestZeroRainRunDays,'consecutive days without recorded rain')],
    ['Days above cited ideal air range','Exposure above a sourced crop-specific temperature reference. Different crops have unequal heat-rule coverage; a missing rule is not heat safety.',s=>assessed(s,'heat',s.criteria.daysAboveIdealAir,'days above a cited reference')],
    ['Sum of upper maturity bounds','Adds sourced maturity upper bounds for all three crops; excludes turnaround. A partial sum must not be compared with a complete sequence.',s=>s.assessment?.cropRules===3?`${s.criteria.maturityUpperDays} days across three crops`:'Not comparable: not all three crops have maturity references']
  ];
  return rows.map(([name,meaning,value])=>[name,meaning,...result.scenarios.map(value)]);
}
export function renderStrategy(result){
  const root=document.querySelector('#strategy-output');root.replaceChildren();
  root.append(el('p',`One field · ${monthRange(result.horizon.start,result.horizon.endExclusive)} · ${result.horizon.months} months · historical weather reference ${result.inputs.referenceYear}.`),el('p',result.uncertainty,{class:'notice'}));
  root.append(el('p',`The reference year is a historical comparison: each crop window uses the same calendar dates in ${result.inputs.referenceYear}. It is not a forecast for the planned year.`));
  // The ordering note lives in a collapsed <details> below, so a year with no readings would otherwise reach the
  // farmer as a ranked comparison whose stated evidence criterion meant nothing. Visible, unprompted, here.
  if(result.ranking.evidenceLimitation)root.append(el('p',result.ranking.evidenceLimitation,{class:'notice'}));
  const allowed=result.inputs.allowedCrops.map(id=>result.scenarios.flatMap(s=>s.timeline).find(slot=>slot.cropId===id)?.cropName??id).join(', ');
  root.append(el('p',`Allowed alternative crops: ${allowed}. Your baseline stays as entered. Each alternative is a different three-crop sequence from this set; no extra crop is added.`));
  if(result.scenarios[0].timeline.some(slot=>slot.perennial))root.append(el('p','Your baseline includes perennial fruit trees. This annual-slot planner cannot make a like-for-like orchard comparison. The alternative annual sequences are not advice to remove or replace an orchard; a local orchard-specific plan is needed.',{class:'notice'}));
  root.append(el('h3','What can we actually compare?'),el('p','First check coverage. “0” means no counted warning only where a check ran. “Not assessed” means missing inputs or rules. Do not treat missing information as a good result or compare a partial crop total against a complete one.'));
  const coverage=el('div',null,{class:'assessment-coverage'});
  for(const scenario of result.scenarios){const known=scenario.assessment?.cropRules??0,node=el('div');node.append(el('strong',scenario.label),el('p',`${known} of 3 crops have screening rules${known<3?`; ${3-known} crop(s) need more information`:''}. This bar shows evidence coverage, not crop suitability.`),el('meter',`${known} of 3`,{min:0,max:3,value:known,'aria-label':`${scenario.label}: screening rules for ${known} of 3 crops`}));coverage.append(node);}root.append(coverage);
  const explained=el('details');explained.append(el('summary','Explain the comparison checks'),el('p','Each row below states what was checked and why a value may be unavailable. On narrow screens, scroll this table sideways for all three scenarios, or read each scenario below.'),table(['What is checked','What this means',...result.scenarios.map(s=>s.label)],comparisonRows(result),'Comparison explained — evidence coverage and historical screening, not confidence or yield scores'));root.append(explained);
  const method=el('details');method.append(el('summary','How alternatives were ordered'),el('p',`${result.consideredCandidates} possible sequences were checked. ${result.ranking.method}`),list(result.ranking.orderedCriteria),el('p',result.ranking.limitation));
  for(const scenario of result.scenarios){
    const article=el('article',null,{class:'scenario'});article.append(el('h3',scenario.label),el('p',scenario.status));
    const timeline=el('ol',null,{class:'timeline','aria-label':`${scenario.label} rotation timeline`});
    scenario.timeline.forEach(slot=>{
      const li=el('li');li.append(el('h4',`${slot.slot}. ${slot.cropName}`),el('p',monthRange(slot.start,slot.endExclusive)),el('p',`Family: ${slot.family??(slot.referenceFamily?`${slot.referenceFamily} (botanical reference; annual rotation unassessed)`:'unknown — no sourced rule in this prototype')}`));
      if(slot.maturityDays){
        li.append(el('p',`Maturity: ${slot.maturityDays.join('–')} days. Assumed harvest/turnaround: ${slot.harvestTurnaroundAssumptionDays} days. Unallocated: ${slot.unallocatedDays} days.`));
        const d=slot.indicators;li.append(el('p',`Historical same-calendar window: ${d.assessedDays} days in reference year ${d.referenceYear}; ${d.missingEvidenceDays} days lack required weather values.`),el('p',`Regional air extremes: ${number(d.minAirC)} to ${number(d.maxAirC)} °C. Rain: ${number(d.precipitationMm)} mm (${d.precipitationValidDays}/${d.assessedDays} days${d.precipitationPartial?', partial total':''}).`),el('p','Derived from NASA POWER daily estimates. Historical conditions do not predict the planned crop window.'),el('p',`Longest observed zero-rain run: ${d.longestZeroRainRunDays} days. Missing days are not treated as rain-free.`),list(slot.soilChecks));
        if(d.leapDaySubstitutions)li.append(el('p',`${d.leapDaySubstitutions} leap day mapped to February 28.`));
        const weather=el('button','View historical rain in 3D',{type:'button','aria-label':`View historical rain in 3D: ${scenario.label}, slot ${slot.slot}, ${slot.cropName}`});weather.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('fieldshift:weather-window',{detail:{slot,scenarioLabel:scenario.label,inputs:result.inputs}})));li.append(weather);
      }else{
        li.append(el('p','Crop-specific screening is not available yet.',{class:'notice'}));
        if(slot.recordedContext){const c=slot.recordedContext;li.append(el('p',`What is recorded: national production ${c.tonnes.toLocaleString('en')} ${c.units} in ${c.year}. This is not your field’s yield or proof of suitability.`));}
      }
      li.append(list(slot.notes));timeline.append(li);
    });
    article.append(timeline,el('h4','Reasons'),list(scenario.reasons.length?scenario.reasons:['No positive screening reason can be established for this sequence.']),el('h4','Risks and trade-offs'),list(scenario.risks),sourceLinks(scenario.sourceIds,result.sources));root.append(article);
  }
  root.append(method,el('h3','Assumptions'),list(result.assumptions),el('h3','What this comparison cannot conclude'),list(result.gaps));
}

import {historicalWindow,rainIndicators} from './weather-window.js';
// Display scaling only; scientific aggregation stays in shared functions.
export function columnData(data,month){
  if(!Number.isInteger(month)||month<1||month>12)throw new Error('Choose a month from 1 to 12.');
  const maximum=Math.max(0,...data.cells.flatMap(cell=>cell.monthly.map(summary=>summary.sum??0)));
  const metresPerMm=20_000/Math.max(1,maximum);
  const features=data.cells.map(cell=>{const summary=cell.monthly[month-1];return{
    type:'Feature',id:cell.id,geometry:cell.geometry,properties:{cellId:cell.id,value:summary.sum,
      height:summary.sum===null?0:summary.sum*metresPerMm,missing:summary.sum===null,partial:summary.partial,selected:cell.id===data.selectedCellId}};
  });
  return{maximum,metresPerMm,features};
}

export function gridMatchesEvidence(data,observations){
  const selected=data.cells.find(cell=>cell.id===data.selectedCellId);
  return !!observations&&data.period.start===observations.period.start&&data.period.end===observations.period.end&&
    selected?.dates.length===observations.dates.length&&selected.dates.every((date,i)=>date===observations.dates[i]&&selected.values[i]===observations.parameters.PRECTOTCORR.values[i]);
}

export function windowColumnData(data,slot){
  const d=slot?.indicators;
  if(!d||d.referenceYear!==Number(data.period.start.slice(0,4)))throw new Error('This slot has no matching historical weather window.');
  const windows=data.cells.map(cell=>{
    const window=historicalWindow({period:data.period,dates:cell.dates,parameters:{PRECTOTCORR:{values:cell.values}}},Date.parse(slot.start),d.assessedDays);
    return{cell,...window,summary:rainIndicators(window.days)};
  });
  const selected=windows.find(window=>window.cell.id===data.selectedCellId);
  const expected=['precipitationMm','precipitationValidDays','precipitationPartial','longestZeroRainRunDays'];
  if(!selected||expected.some(key=>selected.summary[key]!==d[key])||selected.leapDaySubstitutions!==d.leapDaySubstitutions)throw new Error('The grid and strategy weather differ. Reload evidence and compare again.');
  const maximum=Math.max(0,...windows.map(window=>window.summary.precipitationMm??0)),metresPerMm=20_000/Math.max(1,maximum);
  const features=windows.map(({cell,summary})=>({type:'Feature',id:cell.id,geometry:cell.geometry,properties:{cellId:cell.id,value:summary.precipitationMm,
    height:summary.precipitationMm===null?0:summary.precipitationMm*metresPerMm,missing:summary.precipitationMm===null,partial:summary.precipitationPartial,selected:cell.id===data.selectedCellId,
    validDays:summary.precipitationValidDays,expectedDays:d.assessedDays}}));
  return{maximum,metresPerMm,features,windows,periods:[...new Set(selected.days.map(day=>day.referenceDate.slice(0,7)))],
    firstDate:selected.days[0].referenceDate,lastDate:selected.days.at(-1).referenceDate,leapDaySubstitutions:selected.leapDaySubstitutions};
}

import { el, list, number, table } from '../lib/dom.js';
import {temperatureValue,temperatureLabel} from '../lib/temperature.js';
const monthLabel=(period,withYear=false)=>new Intl.DateTimeFormat('en',{month:'short',...(withYear?{year:'numeric'}:{}),timeZone:'UTC'}).format(new Date(`${period}-01T00:00:00Z`));
export const displayUnits=units=>units==='C'?'°C':units;

function chart(monthly,id,title,bars=false,unit='C'){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 800 270');svg.setAttribute('class','chart');svg.setAttribute('role','img');svg.setAttribute('aria-label',`${title}. Month runs left to right. Exact values and missing days are in the monthly table.`);
  const add=(tag,attrs,text)=>{const node=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>node.setAttribute(k,v));if(text!=null)node.textContent=text;svg.append(node);return node;};
  add('title',{},title);
  const values=monthly.map(m=>id==='T2M'?temperatureValue(m.parameters[id].mean,unit):m.parameters[id][bars?'sum':'mean']);
  const ranges=id==='T2M'?monthly.map(m=>[temperatureValue(m.parameters.T2M_MIN.min,unit),temperatureValue(m.parameters.T2M_MAX.max,unit)]):[];
  const valid=[...values,...ranges.flat()].filter(v=>v!==null),lo=Math.min(id==='T2M'?temperatureValue(0,unit):0,...valid),hi=Math.max(id==='T2M'?temperatureValue(1,unit):1,...valid);
  const y=v=>215-(v-lo)/(hi-lo)*165,x=i=>75+i*61;
  add('text',{x:10,y:20,fill:'#18221c','font-size':15},title);
  for(let i=0;i<=4;i++){const v=lo+(hi-lo)*i/4;add('line',{x1:55,x2:780,y1:y(v),y2:y(v),stroke:'#d5dbd7'});add('text',{x:48,y:y(v)+4,'text-anchor':'end','font-size':12},number(v));}
  ranges.forEach((range,i)=>{if(i&&range.every(v=>v!==null)&&ranges[i-1].every(v=>v!==null))add('polygon',{points:`${x(i-1)},${y(ranges[i-1][0])} ${x(i)},${y(range[0])} ${x(i)},${y(range[1])} ${x(i-1)},${y(ranges[i-1][1])}`,fill:'#dbe6d6'});});
  let points=[];const flush=()=>{if(points.length>1)add('polyline',{points:points.join(' '),fill:'none',stroke:'#245a3a','stroke-width':3});points=[];};
  values.forEach((value,i)=>{
    add('text',{x:x(i),y:244,'text-anchor':'middle','font-size':12},monthLabel(monthly[i].period));
    if(value===null){flush();add('text',{x:x(i),y:265,'text-anchor':'middle','font-size':11},'Missing');return;}
    const p=monthly[i].parameters[id],description=`${monthLabel(monthly[i].period,true)}: ${number(value)} ${id==='T2M'?temperatureLabel(unit):bars?'mm':'MJ/m²/day'}; ${p.validDays} of ${p.expectedDays} days${p.partial?', partial data':''}`;
    let mark;
    if(bars)mark=add('rect',{x:x(i)-18,y:y(value),width:36,height:Math.max(0,y(0)-y(value)),fill:p.partial?'#9c6b20':'#245a3a'});
    else{points.push(`${x(i)},${y(value)}`);mark=add('circle',{cx:x(i),cy:y(value),r:4,fill:p.partial?'#9c6b20':'#245a3a'});}
    mark.setAttribute('tabindex','0');mark.setAttribute('aria-label',description);mark.dataset.value=String(value);mark.dataset.month=monthly[i].period;
    const tip=document.createElementNS(ns,'title');tip.textContent=description;mark.append(tip);
  });flush();return svg;
}

export function renderEvidence(data,unit=document.querySelector('#temperature-unit')?.value??'C'){
  const root=document.querySelector('#evidence-output'),label=temperatureLabel(unit);root.replaceChildren();root.dataset.temperatureUnit=unit;
  root.append(el('p',`NASA POWER · ${data.location.latitude}°, ${data.location.longitude}° · ${data.period.start} to ${data.period.end} (${data.period.timeStandard}). Retrieved ${data.retrievedAt}. ${data.cache.hit?'Cached response; original retrieval time retained.':'Retrieved from NASA.'}`));
  const source=el('details');source.append(el('summary','Source product and exact NASA response'),el('p',`Product: ${data.source.product}. Sources: ${data.source.products.join(', ')}. Values are estimated gridded observations. Latest non-missing day within this request: ${data.latestAvailableDate??'none'}.`),el('a','Open the exact NASA API response',{href:data.source.url,target:'_blank',rel:'noreferrer'}));
  root.append(el('p',`How to read the graphs: months run left to right. Temperature is displayed in ${label}; changing units does not change source values, screening rules or results. Green means complete data, brown means partial data, and a gap means missing data.`));
  const figure=(id,title,description,bars=false)=>{const node=el('figure');node.append(chart(data.monthly,id,title,bars,unit),el('figcaption',description));root.append(node);};
  figure('T2M',`Monthly mean air temperature (${label}), ${data.period.start.slice(0,4)}`,'The dark line is monthly mean air temperature at 2 m. The pale band spans each month’s lowest daily minimum to highest daily maximum: observed regional extremes, not a confidence interval. It does not measure soil warmth or predict crop damage.');
  figure('PRECTOTCORR',`Monthly precipitation sum (mm), ${data.period.start.slice(0,4)}`,'Each bar adds the available daily rain estimates for one month. A brown bar is an incomplete total. More rain does not establish enough crop water or drainage; irrigation and crop demand are not measured here.',true);
  figure('ALLSKY_SFC_SW_DWN',`Mean daily solar energy (MJ/m²/day), ${data.period.start.slice(0,4)}`,'Each point is the monthly average of daily solar energy. It is not a monthly energy total or a crop-yield estimate.');
  const complete=data.monthly.filter(m=>!m.parameters.T2M.partial&&m.parameters.T2M.mean!==null);
  if(complete.length){const cool=complete.reduce((a,b)=>a.parameters.T2M.mean<b.parameters.T2M.mean?a:b),warm=complete.reduce((a,b)=>a.parameters.T2M.mean>b.parameters.T2M.mean?a:b);
    root.append(el('p',`Reading this historical year: among complete temperature months, ${monthLabel(cool.period)} had the lowest monthly mean (${number(temperatureValue(cool.parameters.T2M.mean,unit))} ${label}) and ${monthLabel(warm.period)} the highest (${number(temperatureValue(warm.parameters.T2M.mean,unit))} ${label}). This describes that year, not next season’s planting suitability.`));}
  root.append(source,el('p','Source metadata below describes the original NASA units and regional grid size. Zooming the map does not turn these estimates into farm measurements.'));
  root.append(table(['Parameter','Source units','Nominal resolution (lat × lon)','Valid / requested days','Latest in requested period'],Object.values(data.parameters).map(p=>[p.label,displayUnits(p.units),`${p.resolution.latitudeDegrees}° × ${p.resolution.longitudeDegrees}°`,`${p.validDays} / ${data.dates.length}`,p.latestAvailableDate??'None']),'Source metadata for every daily parameter'));
  root.append(list(data.notices),el('p','The monthly table gives value [available days / expected days]. “Partial” means some days are missing. A missing value is never zero. Lowest/highest air are daily regional extremes, not average crop temperatures.'));
  const cell=(p,key,temp=false)=>`${number(temp?temperatureValue(p[key],unit):p[key])} [${p.validDays}/${p.expectedDays}]${p.partial?' partial':''}`;
  const monthlyTable=table(['Month',`Mean air (${label})`,`Lowest air (${label})`,`Highest air (${label})`,'Rain sum (mm)','Mean daily solar (MJ/m²/day)'],data.monthly.map(m=>[monthLabel(m.period,true),cell(m.parameters.T2M,'mean',true),cell(m.parameters.T2M_MIN,'min',true),cell(m.parameters.T2M_MAX,'max',true),cell(m.parameters.PRECTOTCORR,'sum'),cell(m.parameters.ALLSKY_SFC_SW_DWN,'mean')]),'Monthly derived indicators — NASA POWER, with missingness');
  monthlyTable.querySelectorAll('tbody tr').forEach((row,i)=>{row.dataset.evidenceMonth=data.monthly[i].period;row.dataset.rainSum=JSON.stringify(data.monthly[i].parameters.PRECTOTCORR.sum);});root.append(monthlyTable);
  const download=el('button','Download normalized evidence (JSON)',{type:'button'});download.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));el('a','',{href:url,download:`fieldshift-power-${data.location.latitude}-${data.location.longitude}-${data.period.start.slice(0,4)}.json`}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);});root.append(download);
}

globalThis.window?.addEventListener('fieldshift:monthchange',event=>{document.querySelectorAll('[data-evidence-month]').forEach(row=>{const periods=event.detail.periods??[event.detail.period],selected=periods.includes(row.dataset.evidenceMonth);row.classList.toggle('selected-evidence-month',selected);if(selected&&periods.length===1)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');if(selected&&event.detail.window)row.setAttribute('aria-description','This month overlaps the selected crop window. This row is a full-month total, not a crop-window total.');else row.removeAttribute('aria-description');});});

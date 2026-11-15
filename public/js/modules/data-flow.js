import { el, list, number, table } from '../lib/dom.js';
const monthLabel=(period,withYear=false)=>new Intl.DateTimeFormat('en',{month:'short',...(withYear?{year:'numeric'}:{}),timeZone:'UTC'}).format(new Date(`${period}-01T00:00:00Z`));
export const displayUnits=units=>units==='C'?'°C':units;

function chart(monthly, id, title, bars = false) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 800 250');
  svg.setAttribute('class', 'chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${title}. Exact values and missing days are in the following table.`);
  const add = (tag, attributes, text) => {
    const node = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    if (text != null) node.textContent = text;
    svg.append(node);
    return node;
  };
  add('title', {}, title);
  const values = monthly.map(m => m.parameters[id][bars ? 'sum' : 'mean']);
  const valid = values.filter(v => v !== null);
  const lo = Math.min(0, ...valid), hi = Math.max(1, ...valid);
  const y = value => 205 - (value - lo) / (hi - lo) * 165;
  const x = i => 75 + i * 61;
  add('text', { x: 10, y: 20, fill: '#18221c', 'font-size': 15 }, title);
  for (let i = 0; i <= 4; i++) {
    const value = lo + (hi - lo) * i / 4;
    add('line', { x1: 55, x2: 780, y1: y(value), y2: y(value), stroke: '#d5dbd7' });
    add('text', { x: 48, y: y(value) + 4, 'text-anchor': 'end', 'font-size': 12 }, number(value));
  }
  let points = [];
  const flush = () => {
    if (points.length > 1) add('polyline', { points: points.join(' '), fill: 'none', stroke: '#245a3a', 'stroke-width': 2 });
    points = [];
  };
  values.forEach((value, i) => {
    add('text', { x: x(i), y: 230, 'text-anchor': 'middle', 'font-size': 12 }, monthLabel(monthly[i].period));
    if (value === null) { flush(); return; }
    const partial = monthly[i].parameters[id].partial;
    if (bars) add('rect', { x: x(i) - 18, y: y(value), width: 36, height: Math.max(0, y(0) - y(value)), fill: partial ? '#9c6b20' : '#245a3a' });
    else {
      points.push(`${x(i)},${y(value)}`);
      add('circle', { cx: x(i), cy: y(value), r: 3, fill: partial ? '#9c6b20' : '#245a3a' });
    }
  });
  flush();
  return svg;
}

export function renderEvidence(data) {
  const root = document.querySelector('#evidence-output');
  root.replaceChildren();
  root.append(el('p', `NASA POWER · ${data.location.latitude}°, ${data.location.longitude}° · ${data.period.start} to ${data.period.end} (${data.period.timeStandard}). Retrieved ${data.retrievedAt}. ${data.cache.hit ? 'Cached response; original retrieval time retained.' : 'Retrieved from NASA.'}`));
  root.append(el('p', `Product: ${data.source.product}. Sources: ${data.source.products.join(', ')}. Values are estimated gridded observations. Latest non-missing day within this request: ${data.latestAvailableDate ?? 'none'}.`));
  const source = el('p');
  source.append(el('a', 'Open the exact NASA API response', { href: data.source.url, target: '_blank', rel: 'noreferrer' }));
  root.append(source);
  root.append(chart(data.monthly, 'T2M', `Monthly mean air temperature (°C), ${data.period.start.slice(0, 4)}`));
  root.append(chart(data.monthly, 'PRECTOTCORR', `Monthly precipitation sum (mm), ${data.period.start.slice(0, 4)}`, true));
  root.append(table(['Parameter', 'Units', 'Nominal resolution (lat × lon)', 'Valid / requested days', 'Latest in requested period'],
    Object.values(data.parameters).map(p => [p.label, displayUnits(p.units), `${p.resolution.latitudeDegrees}° × ${p.resolution.longitudeDegrees}°`,
      `${p.validDays} / ${data.dates.length}`, p.latestAvailableDate ?? 'None']), 'Source metadata for every daily parameter'));
  root.append(list(data.notices));
  root.append(el('p', 'Brown marks partial data; missing months remain blank. Table cells show value [valid/requested days]. Monthly air extremes are regional daily extremes. Solar is a monthly average of daily energy, not a monthly total.'));
  const cell = (p, key) => `${number(p[key])} [${p.validDays}/${p.expectedDays}]${p.partial ? ' partial' : ''}`;
  const monthlyTable=table(['Month', 'Mean air (°C)', 'Lowest air (°C)', 'Highest air (°C)', 'Rain sum (mm)', 'Mean daily solar (MJ/m²/day)'],
    data.monthly.map(m => [monthLabel(m.period,true), cell(m.parameters.T2M, 'mean'), cell(m.parameters.T2M_MIN, 'min'),
      cell(m.parameters.T2M_MAX, 'max'), cell(m.parameters.PRECTOTCORR, 'sum'), cell(m.parameters.ALLSKY_SFC_SW_DWN, 'mean')]),
    'Monthly derived indicators — NASA POWER, with missingness');
  monthlyTable.querySelectorAll('tbody tr').forEach((row,i)=>{row.dataset.evidenceMonth=data.monthly[i].period;row.dataset.rainSum=JSON.stringify(data.monthly[i].parameters.PRECTOTCORR.sum);});
  root.append(monthlyTable);
  const download = el('button', 'Download normalized evidence (JSON)', { type: 'button' });
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = el('a', '', { href: url, download: `fieldshift-power-${data.location.latitude}-${data.location.longitude}-${data.period.start.slice(0, 4)}.json` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  root.append(download);
}
globalThis.window?.addEventListener('fieldshift:monthchange',event=>{
  document.querySelectorAll('[data-evidence-month]').forEach(row=>{
    const periods=event.detail.periods??[event.detail.period];
    const selected=periods.includes(row.dataset.evidenceMonth);
    row.classList.toggle('selected-evidence-month',selected);
    if(selected&&periods.length===1)row.setAttribute('aria-current','true');else row.removeAttribute('aria-current');
    if(selected&&event.detail.window)row.setAttribute('aria-description','This month overlaps the selected crop window. This row is a full-month total, not a crop-window total.');else row.removeAttribute('aria-description');
  });
});

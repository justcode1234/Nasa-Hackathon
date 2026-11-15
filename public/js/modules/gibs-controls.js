import {api} from '../lib/api.js';
import {el,list} from '../lib/dom.js';
import {GIBS_PRODUCTS,isAvailableDate,imageryUrl} from '../lib/gibs-contract.js';

export function imageryControls({map,isClosed}){
  const root=el('details'),summary=el('summary','NASA imagery for visual context');
  const form=el('form'),select=el('select',null,{id:'gibs-layer'}),date=el('input',null,{id:'gibs-date',type:'date',disabled:''}),show=el('button','Show dated imagery',{type:'submit',disabled:''});
  select.append(el('option','No imagery overlay',{value:''}));
  for(const[id,product]of Object.entries(GIBS_PRODUCTS))select.append(el('option',product.name,{value:id}));
  const layerLabel=el('label','Imagery product '),dateLabel=el('label','Imagery date '),opacityLabel=el('label','Imagery opacity '),opacity=el('input',null,{type:'range',min:0,max:1,step:.05,value:.65}),opacityValue=el('output','65%');
  layerLabel.append(select);dateLabel.append(date);opacityLabel.append(opacity,opacityValue);
  form.append(layerLabel,dateLabel,show,opacityLabel);
  const status=el('p','Imagery is off. Values are not extracted from map colours.',{role:'status',id:'gibs-status'}),info=el('div',null,{id:'gibs-info'}),legend=el('div',null,{id:'gibs-legend'});
  const retry=el('button','Retry imagery metadata',{type:'button',hidden:''});
  root.append(summary,form,status,retry,info,legend);
  let catalog,selected,revision=0;
  function clear(){
    if(map.getLayer('gibs-imagery'))map.removeLayer('gibs-imagery');
    if(map.getSource('gibs-imagery'))map.removeSource('gibs-imagery');
    legend.replaceChildren();
  }
  select.addEventListener('change',async()=>{
    if(isClosed())return;
    const version=++revision;selected=null;clear();info.replaceChildren();date.value='';date.disabled=true;show.disabled=true;retry.hidden=true;
    if(!select.value){status.textContent='Imagery is off. POWER columns and values are unchanged.';return;}
    status.textContent='Reading available dates and legends from NASA GIBS…';
    try{
      catalog??=await api('/api/gibs-layers');
      if(isClosed()||version!==revision)return;
      selected=catalog.layers.find(layer=>layer.id===select.value);
      if(!selected)throw new Error('This layer is not advertised by NASA today. Choose another product.');
      date.min=selected.intervals.reduce((min,i)=>i.start<min?i.start:min,selected.intervals[0].start);
      date.max=selected.intervals.reduce((max,i)=>i.end>max?i.end:max,selected.intervals[0].end);
      date.value=selected.defaultDate;date.disabled=false;show.disabled=false;
      info.replaceChildren(el('p',`${selected.name} · ${selected.kind} · palette units: ${selected.units} · ${selected.spatialResolution}. Metadata retrieved ${selected.retrievedAt}.`),el('p',selected.missingness),el('p','Zooming in adds no product resolution. Imagery never supplies crop-screening or farm-soil inputs.'));
      const available=el('details');available.append(el('summary','NASA-advertised date intervals'),list(selected.intervals.map(interval=>`${interval.start} to ${interval.end}, every ${interval.stepDays} day(s)`)));
      info.append(available,el('a','Product resolution and interpretation',{href:selected.referenceUrl,target:'_blank',rel:'noreferrer'}),el('p',null));
      info.lastChild.append(el('a','NASA capabilities and availability source',{href:selected.url,target:'_blank',rel:'noreferrer'}));
      status.textContent='Choose an advertised date, then show imagery. The displayed date is separate from the POWER historical year.';
    }catch(error){if(!isClosed()&&version===revision){status.textContent=`${error.message} No dates or imagery were substituted.`;retry.hidden=Boolean(catalog);}}
  });
  retry.addEventListener('click',()=>select.dispatchEvent(new Event('change')));
  form.addEventListener('submit',event=>{
    event.preventDefault();
    if(isClosed())return;
    if(!selected||!isAvailableDate(selected,date.value)){status.textContent='Choose a date inside the NASA-advertised availability intervals. Missing dates stay unavailable.';return;}
    clear();
    map.addSource('gibs-imagery',{type:'raster',tiles:[imageryUrl(selected,date.value)],tileSize:256,maxzoom:selected.maxZoom,attribution:'NASA GIBS imagery (values not extracted)'});
    map.addLayer({id:'gibs-imagery',type:'raster',source:'gibs-imagery',paint:{'raster-opacity':Number(opacity.value),'raster-resampling':'nearest'}},'power-missing');
    legend.append(el('p',`${selected.product} · ${date.value} · ${selected.units} · ${selected.spatialResolution}. Imagery for visual context; values not extracted.`),el('img',null,{src:selected.legendUrl,alt:`NASA colour legend for ${selected.name} (${selected.units})`}));
    status.textContent=`Imagery selected: ${selected.name}, ${date.value}. Tile coverage may be incomplete. POWER rainfall values are unchanged.`;
  });
  opacity.addEventListener('input',()=>{if(isClosed())return;opacityValue.value=`${Math.round(Number(opacity.value)*100)}%`;if(map.getLayer('gibs-imagery'))map.setPaintProperty('gibs-imagery','raster-opacity',Number(opacity.value));});
  return root;
}

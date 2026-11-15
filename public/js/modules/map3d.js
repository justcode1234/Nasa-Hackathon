import {api} from '../lib/api.js';
import {el,list,table,number} from '../lib/dom.js';
import {columnData,windowColumnData,gridMatchesEvidence} from '../lib/power-columns.js';
import {imageryControls} from './gibs-controls.js';
import {terrainControls} from './terrain-controls.js';

let library;
async function renderer(){
  if(!document.querySelector('#maplibre-style')){
    const link=el('link',null,{id:'maplibre-style',rel:'stylesheet',href:'/vendor/maplibre/maplibre-gl.css'});document.head.append(link);
  }
  library??=import('/vendor/maplibre/maplibre-gl.mjs');return library;
}
export async function createEvidenceMap({getState,onClose}){
  const probe=document.createElement('canvas'),contextProbe=probe.getContext('webgl2');
  if(!contextProbe)throw new Error('3D is unavailable on this device (WebGL2 is required). The 2D map remains available.');
  contextProbe.getExtension('WEBGL_lose_context')?.loseContext();
  const lib=await renderer(),host=document.querySelector('#map3d-panel'),root=el('div');
  host.replaceChildren(root);
  const controls=el('div',null,{class:'map3d-controls'}),back=el('button','Return to 2D map',{type:'button'}),globe=el('button','Globe view',{type:'button'}),regional=el('button','Regional view',{type:'button'}),retry=el('button','Retry 3D NASA grid',{type:'button',hidden:''});
  controls.append(back,globe,regional,retry);
  const status=el('p','Loading 3D map…',{role:'status',id:'map3d-status'}),canvas=el('div',null,{id:'map3d-canvas',role:'region','aria-label':'NASA rainfall cells at their native regional scale'});
  const label=el('label','Historical month '),slider=el('input',null,{id:'map3d-month',type:'range',min:1,max:12,step:1,value:1}),output=el('output','',{for:'map3d-month'});label.append(slider,output);
  const legend=el('p','',{id:'map3d-legend'}),metadata=el('div',null,{id:'map3d-metadata'}),values=el('div',null,{id:'map3d-values'});
  const windowSummary=el('p','',{id:'map3d-window',tabindex:'-1',hidden:''}),monthly=el('button','Return to monthly view',{type:'button',hidden:''});
  const tileNotice=el('p','',{class:'notice',role:'status',hidden:''});
  root.append(controls,status,tileNotice,canvas,windowSummary,monthly,label,legend,metadata,values);
  let map,data,terrain,windowState=null,features=[],month=1,revision=0,closed=false;
  try{
    const initial=getState().location;if(!initial)throw new Error('The selected location changed. Open 3D for the new point.');
    map=new lib.Map({container:canvas,center:[initial.longitude,Math.max(-85,Math.min(85,initial.latitude))],zoom:6.8,pitch:50,preserveDrawingBuffer:true,style:{version:8,projection:{type:'mercator'},sources:{
      globe:{type:'raster',tiles:['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'],tileSize:256,maxzoom:8,attribution:'<a href="https://gibs.earthdata.nasa.gov/">NASA GIBS Blue Marble</a> (static composite)'},
      osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,minzoom:9,maxzoom:19,attribution:'<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>'}
    },layers:[{id:'globe',type:'raster',source:'globe',maxzoom:9},{id:'osm',type:'raster',source:'osm',minzoom:9}]}});
  }catch(error){root.replaceChildren();throw new Error(`3D is unavailable on this device (${error.message}). The 2D map remains available.`);}
  map.addControl(new lib.NavigationControl());
  map.on('error',()=>{tileNotice.hidden=false;tileNotice.textContent='Some 3D map tiles could not load. The text table and 2D map remain available.';});
  function view(global=false){
    const selection=data?.selection??getState().location;if(!selection)return;
    terrain?.disable();
    map.setProjection({type:global?'globe':'mercator'});
    map.jumpTo({center:[selection.longitude,Math.max(-85,Math.min(85,selection.latitude))],zoom:global?1.5:6.8,pitch:global?0:50,bearing:0});
  }
  globe.addEventListener('click',()=>view(true));regional.addEventListener('click',()=>view());
  function highlight(periods){
    window.dispatchEvent(new CustomEvent('fieldshift:monthchange',{detail:{period:periods.length===1?periods[0]:null,periods,window:!!windowState}}));
  }
  function draw(){
    if(!data)return;
    const period=`${data.period.start.slice(0,4)}-${String(month).padStart(2,'0')}`;
    const columns=windowState?windowState.columns:columnData(data,month),max=columns.maximum,scale=columns.metresPerMm;
    const date=new Intl.DateTimeFormat('en',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${period}-01T00:00:00Z`));
    output.value=date;slider.setAttribute('aria-valuetext',date);
    features=columns.features;
    map.getSource('power-cells').setData({type:'FeatureCollection',features});
    map.setPaintProperty('power-columns','fill-extrusion-color',['interpolate',['linear'],['coalesce',['get','value'],0],0,'#eff3ff',Math.max(1,max),'#2171b5']);
    const title=windowState?`${windowState.scenarioLabel}, slot ${windowState.slot.slot}: ${windowState.slot.cropName}`:date;
    legend.textContent=`${title} · rain sum of available days (mm). Colour: pale blue 0 to dark blue ${number(max,2)} mm, ${windowState?'scaled for this crop window':'fixed across this year'}. Height: 1 mm = ${number(scale,1)} display metres; columns are not water depth. Hatched cells have no available rain values; partial totals are labelled in the table.`;
    values.replaceChildren(table(['Native centre (lat, lon)','Rain sum (mm)','Available / expected days','Missingness'],data.cells.map(cell=>{
      const summary=windowState?.columns.windows.find(window=>window.cell.id===cell.id)?.summary;
      const s=summary?{sum:summary.precipitationMm,validDays:summary.precipitationValidDays,expectedDays:windowState.slot.indicators.assessedDays,partial:summary.precipitationPartial}:cell.monthly[month-1];return[`${cell.id===data.selectedCellId?'Selected: ':''}${cell.latitude}, ${cell.longitude}`,s.sum===null?'Missing':number(s.sum,2),`${s.validDays} / ${s.expectedDays}`,s.sum===null?'No available values':s.partial?'Partial sum; missing days omitted':'Complete'];
    }),`NASA POWER native cells · ${title}`));
    highlight(windowState?columns.periods:[period]);
  }
  slider.addEventListener('input',()=>{month=Number(slider.value);draw();});
  async function load(){
    const state=getState(),version=++revision;
    if(!state.location)throw new Error('Choose coordinates before opening 3D.');
    status.textContent='Retrieving the native NASA rainfall grid…';retry.hidden=true;
    try{
      const result=await api(`/api/power-grid?${new URLSearchParams({...state.location,year:state.year})}`);
      if(closed||version!==revision)return;
      data=result;
      const observations=state.observations;
      const matches=gridMatchesEvidence(data,observations);
      metadata.replaceChildren(el('p',`${data.product} · ${data.attribution} · ${data.kind} regional observations · ${data.period.start} to ${data.period.end} (${data.period.timeStandard}). Retrieved ${data.retrievedAt}. Native spacing: 0.5° latitude × 0.625° longitude.`),
        el('p',data.boundsKind),list(data.notices),el('a','Exact NASA grid request',{href:data.url,target:'_blank',rel:'noreferrer'}));
      metadata.append(el('p','Globe basemap: NASA GIBS Blue Marble static composite; no observation date is supplied by its layer. Raster tiles provide context, not extra rainfall values.'));
      if(observations&&!matches)metadata.append(el('p','The regional grid differs from the currently loaded point evidence. Reload the point evidence before comparing or linking its values.',{class:'notice'}));
      status.textContent=`${data.cells.length} native cells loaded. ${observations?(matches?'Selected-cell daily rain values match the loaded point evidence.':'Point/grid values differ; review the notice below.'):'Load point evidence in step 2 for a direct comparison.'}`;
      draw();
    }catch(error){if(!closed&&version===revision){status.textContent=`${error.message} No replacement readings were generated.`;retry.hidden=false;}}
  }
  retry.addEventListener('click',()=>load());
  function dispose(){if(closed)return;closed=true;revision++;map.remove();root.remove();if(window.fieldshift3D===instance){delete window.fieldshift3D;delete window.fieldshiftTerrainContext;}}
  back.addEventListener('click',()=>{dispose();onClose();});
  const instance={close:dispose,resize(){map.resize();},get map(){return map;},snapshot(){return{data,month,features,window:windowState?{slot:windowState.slot,scenarioLabel:windowState.scenarioLabel,periods:windowState.columns.periods}:null};},
    clearWindow(){if(!windowState||closed)return;windowState=null;windowSummary.hidden=true;monthly.hidden=true;label.hidden=false;slider.disabled=false;draw();},
    showWindow(slot,scenarioLabel){
      if(closed||!data)throw new Error('The NASA grid is not ready. Retry the grid before opening a crop window.');
      const state=getState();
      if(!gridMatchesEvidence(data,state.observations)||state.year!==slot.indicators?.referenceYear||state.location?.latitude!==data.selection.latitude||state.location?.longitude!==data.selection.longitude)throw new Error('The grid and current point evidence differ. Reload evidence and compare again.');
      const columns=windowColumnData(data,slot);windowState={slot,scenarioLabel,columns};
      windowSummary.hidden=false;monthly.hidden=false;label.hidden=true;slider.disabled=true;
      windowSummary.textContent=`${scenarioLabel}, slot ${slot.slot}: ${slot.cropName}. Planned assessment ${slot.start} to ${slot.maturityEndExclusive} (end excluded). Historical analogue: ${columns.firstDate} through ${columns.lastDate}, ${slot.indicators.assessedDays} mapped days in reference year ${slot.indicators.referenceYear}; dates follow the crop's calendar and may wrap December to January. ${columns.leapDaySubstitutions} leap days mapped to February 28. These are the exact rain days used by the strategy, not a forecast. Highlighted step-2 rows show whole-month totals, not these partial-month sums.`;
      view();draw();
    }};
  monthly.addEventListener('click',()=>{instance.clearWindow();slider.focus();});
  window.fieldshift3D=instance;
  instance.ready=(async()=>{
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('The 3D map did not load within 25 seconds.')),25_000);map.once('load',()=>{clearTimeout(timeout);resolve();});map.once('remove',()=>{clearTimeout(timeout);reject(new Error('3D closed.'));});});
  const hatch=document.createElement('canvas');hatch.width=8;hatch.height=8;const context=hatch.getContext('2d');context.fillStyle='#fffdf5';context.fillRect(0,0,8,8);context.strokeStyle='#596252';context.beginPath();context.moveTo(0,8);context.lineTo(8,0);context.stroke();
  map.addImage('missing-hatch',context.getImageData(0,0,8,8));
  map.addSource('power-cells',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'power-missing',type:'fill',source:'power-cells',filter:['==',['get','missing'],true],paint:{'fill-pattern':'missing-hatch','fill-opacity':.8}});
  map.addLayer({id:'power-columns',type:'fill-extrusion',source:'power-cells',filter:['==',['get','missing'],false],paint:{'fill-extrusion-height':['get','height'],'fill-extrusion-base':0,'fill-extrusion-opacity':.8,'fill-extrusion-color':'#2171b5'}});
  map.addLayer({id:'power-edges',type:'line',source:'power-cells',paint:{'line-color':['case',['get','selected'],'#173d2c','#657368'],'line-width':['case',['get','selected'],3,1]}});
  root.insertBefore(imageryControls({map,isClosed:()=>closed}),canvas);
  await load();
  if(!closed){
    terrain=terrainControls({map,getState,isClosed:()=>closed,setRainVisible:visible=>{legend.hidden=!visible;for(const id of ['power-columns','power-missing','power-edges'])map.setLayoutProperty(id,'visibility',visible?'visible':'none');}});
    root.insertBefore(terrain.root,canvas);
  }
  })().catch(error=>{dispose();throw error;});
  return instance;
}

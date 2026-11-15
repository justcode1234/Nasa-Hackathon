import {api} from '../lib/api.js';
import {el,list,number,table} from '../lib/dom.js';

const DEM='https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png';
export function terrainControls({map,getState,isClosed,setRainVisible}){
  const root=el('details'),summary=el('summary','Terrain and selected-field context');
  const point=el('button','View terrain at selected point',{type:'button'}),field=el('button','View selected field on terrain',{type:'button'}),exaggeration=el('select',null,{'aria-label':'Terrain exaggeration'}),exaggerationLabel=el('label','Terrain exaggeration ');
  for(const value of [1,2,3])exaggeration.append(el('option',`×${value}${value===1?' (actual vertical scale)':''}`,{value}));
  exaggerationLabel.append(exaggeration);
  const status=el('p','Terrain is off. Exaggeration defaults to ×1; it changes display only.',{id:'terrain-status',role:'status'}),output=el('div',null,{id:'terrain-context-output'});
  const state=getState(),farm=state.farm,position=state.location;let active=false,revision=0;
  field.disabled=!farm?.geometry;
  root.append(summary,point,field,exaggerationLabel,status,el('p',farm?`${farm.name} · ${farm.id}. Community-mapped outline; ownership, access and current crops are unverified.`:'No field boundary selected. Field slope and aspect remain unassessed; selecting a point does not supply a farm boundary.'),output);
  if(position){
    map.addSource('terrain-location',{type:'geojson',data:{type:'Feature',geometry:{type:'Point',coordinates:[position.longitude,position.latitude]},properties:{}}});
    map.addLayer({id:'terrain-location',type:'circle',source:'terrain-location',paint:{'circle-radius':5,'circle-color':'#173d2c','circle-stroke-color':'#fffdf5','circle-stroke-width':2}});
  }
  if(farm?.geometry){
    map.addSource('selected-field',{type:'geojson',data:{type:'Feature',geometry:farm.geometry,properties:{}}});
    map.addLayer({id:'selected-field-fill',type:'fill',source:'selected-field',paint:{'fill-color':'#426748','fill-opacity':.2}});
    map.addLayer({id:'selected-field-edge',type:'line',source:'selected-field',paint:{'line-color':'#173d2c','line-width':3}});
  }
  function activate(){
    map.setProjection({type:'mercator'});
    if(!map.getSource('terrain-dem')){
      const source={type:'raster-dem',tiles:[DEM],encoding:'terrarium',tileSize:256,maxzoom:12,attribution:'<a href="/licenses/terrain-attribution.txt">Terrain Tiles / contributing datasets including USGS SRTM</a>'};
      map.addSource('terrain-dem',source);map.addSource('terrain-shade-dem',{...source});
      map.addLayer({id:'terrain-hillshade',type:'hillshade',source:'terrain-shade-dem',paint:{'hillshade-exaggeration':.4,'hillshade-illumination-anchor':'map'}},'power-missing');
    }else{
      map.getSource('terrain-dem').setTiles([DEM]);map.getSource('terrain-shade-dem').setTiles([DEM]);
    }
    map.setLayoutProperty('terrain-hillshade','visibility','visible');
    map.setTerrain({source:'terrain-dem',exaggeration:Number(exaggeration.value)});active=true;setRainVisible(false);
    if(position)map.jumpTo({center:[position.longitude,Math.max(-85,Math.min(85,position.latitude))],zoom:13.5,pitch:55,bearing:0});
    status.textContent=`Terrain view · exaggeration ×${exaggeration.value}. Rainfall columns are hidden; their table remains available. Hillshade is a visual aid, not current sunlight.`;
  }
  function provenance(result){
    const sources=result.sourceTiles.map(tile=>`${tile.sourceFiles??'Source filenames unavailable in this response'} · retrieved ${tile.retrievedAt}${tile.fileModifiedAt?` · tile-file modification ${tile.fileModifiedAt} (not observation date)`:''}`);
    return[el('p',`${result.product} · ${result.kind} context. Observation/acquisition date: unknown or varies by source. DEM tile zoom ${result.spatialResolution.zoom}.`),list(result.notices),list(sources),el('a','Full terrain-provider attribution',{href:'/licenses/terrain-attribution.txt',target:'_blank',rel:'noreferrer'})];
  }
  async function analyse(which){
    if(isClosed())return;
    const version=++revision;delete window.fieldshiftTerrainContext;
    point.disabled=true;field.disabled=true;
    try{
      activate();output.replaceChildren(el('p','Retrieving actual elevation pixels…'));
      const result=which==='field'?await api('/api/terrain-context',{method:'POST',body:{fieldId:farm.id,geometry:farm.geometry}}):await api(`/api/terrain-point?${new URLSearchParams(position)}`);
      if(isClosed()||version!==revision)return;
      if(which==='point')output.replaceChildren(el('p',`Nearest DEM pixel at the selected point: ${number(result.elevationM,1)} m. Sampling spacing approximately ${number(result.sampleSpacingM,1)} m/pixel. This is modelled terrain, not a survey. Field slope and aspect require a boundary.`),...provenance(result));
      else{
        const rows=[['Interior pixel centres',result.interiorPixels],['Available elevations',result.validElevationPixels],['Valid gradients',result.validGradientPixels],['Missing gradients',result.missingGradientPixels],['DEM elevation range (m)',`${number(result.elevationMinM,1)} to ${number(result.elevationMaxM,1)}`],['Median / maximum slope (degrees)',result.assessed?`${number(result.slopeMedianDegrees,1)} / ${number(result.slopeMaxDegrees,1)}`:'Unassessed — fewer than nine valid gradients'],['Circular mean downhill aspect (degrees clockwise from north)',result.assessed&&result.aspectMeanDegrees!==null?number(result.aspectMeanDegrees,0):'Unassessed — insufficient, flat or mixed directions'],['Sample spacing (m/pixel)',result.sampleSpacingM?result.sampleSpacingM.map(value=>number(value,1)).join(' to '):'Unknown']];
        output.replaceChildren(table(['Derived context','Value'],rows,'Selected-field terrain context — not an erosion prediction'),...provenance(result));
      }
      window.fieldshiftTerrainContext=result;
    }catch(error){if(!isClosed()&&version===revision)output.replaceChildren(el('p',`${error.message} Retry using the terrain button; no values are inferred.`,{class:'error'}));}
    finally{if(!isClosed()&&version===revision){point.disabled=false;field.disabled=!farm?.geometry;}}
  }
  point.addEventListener('click',()=>analyse('point'));field.addEventListener('click',()=>analyse('field'));
  exaggeration.addEventListener('change',()=>{if(isClosed())return;if(active){map.setTerrain({source:'terrain-dem',exaggeration:Number(exaggeration.value)});status.textContent=`Terrain view · exaggeration ×${exaggeration.value}. Slope/aspect use unexaggerated pixels. Rainfall columns are hidden; the rain table remains available.`;}});
  return{root,disable(){
    if(isClosed())return;active=false;map.setTerrain(null);if(map.getLayer('terrain-hillshade'))map.setLayoutProperty('terrain-hillshade','visibility','none');setRainVisible(true);
    status.textContent=`Terrain off · selected exaggeration ×${exaggeration.value}. Existing numeric context still refers to unexaggerated DEM pixels.`;
  }};
}

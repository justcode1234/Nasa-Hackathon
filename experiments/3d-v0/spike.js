const $=id=>document.getElementById(id);
window.spikeMetrics={errors:[],requestsBeforeOpen:performance.getEntriesByType('resource').map(r=>r.name)};
let map,terrain=false;
function jump(field){
  terrain=field;
  map.setTerrain(field?{source:'terrain',exaggeration:Number($('exaggeration').value)}:null);
  map.setProjection({type:field?'mercator':'globe'});
  map.jumpTo(field?{center:[116.77,-31.89],zoom:12,pitch:55,bearing:0}:{center:[116.77,-25],zoom:1.5,pitch:0,bearing:0});
  $('terrain-status').textContent=field?`Terrain exaggeration ×${$('exaggeration').value}. Pixel spacing near this point at zoom 12 is approximately 32.45 m; this is tile sampling, not a claim of field measurement accuracy.`:'Terrain off in globe view.';
}
$('open').addEventListener('click',async()=>{
  $('open').disabled=true;const start=performance.now();$('status').textContent='Loading the optional renderer…';
  try{
    const link=document.createElement('link');link.rel='stylesheet';link.href='/vendor/maplibre-gl.css';document.head.append(link);
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/vendor/maplibre-gl.js';s.onload=resolve;s.onerror=()=>reject(Error('Renderer download failed'));document.head.append(s);});
    map=new maplibregl.Map({container:'map3d',center:[116.77,-25],zoom:1.5,preserveDrawingBuffer:true,style:{version:8,projection:{type:'globe'},sources:{
      globe:{type:'raster',tiles:['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'],tileSize:256,maxzoom:8,attribution:'<a href="https://www.earthdata.nasa.gov/engage/open-data-services-and-software/earthdata-developer-portal/gibs">NASA GIBS Blue Marble</a> (static composite)'},
      osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,minzoom:9,maxzoom:19,attribution:'© OpenStreetMap contributors'},
      terrain:{type:'raster-dem',tiles:['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],encoding:'terrarium',tileSize:256,maxzoom:15,attribution:'<a href="/terrain-attribution.txt">Terrain Tiles / USGS SRTM; full credits</a>'}
    },layers:[{id:'globe',type:'raster',source:'globe',maxzoom:9},{id:'osm',type:'raster',source:'osm',minzoom:9}]}});
    window.spikeMap=map;
    map.on('error',e=>{window.spikeMetrics.errors.push(e.error?.message??String(e));$('status').textContent='A map or terrain source failed. The 2D app remains available using the link below.';});
    map.once('load',()=>{window.spikeMetrics.interactiveMs=performance.now()-start;window.spikeMetrics.renderer=map.getCanvas().getContext('webgl2')?.getParameter(0x1F01)??'unknown';$('status').textContent='3D loaded. Use the buttons or map controls to change the view.';$('controls').hidden=false;});
    map.addControl(new maplibregl.NavigationControl());
    $('globe').addEventListener('click',()=>jump(false));$('field').addEventListener('click',()=>jump(true));
    $('exaggeration').addEventListener('change',()=>{if(terrain)jump(true);});
    window.spikePan=async()=>{
      const frames=[],start=performance.now();let previous=start;
      await new Promise(resolve=>{function frame(now){frames.push(now-previous);previous=now;map.panBy([1,0],{duration:0});if(now-start<2000)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
      const valid=frames.slice(1).sort((a,b)=>a-b);return{durationMs:performance.now()-start,frames:valid.length,fps:1000/(valid.reduce((a,b)=>a+b,0)/valid.length),p95FrameMs:valid[Math.floor(valid.length*.95)]};
    };
  }catch(error){window.spikeMetrics.errors.push(error.message);$('status').textContent=`3D unavailable: ${error.message}. Use the submitted 2D app below.`;}
});

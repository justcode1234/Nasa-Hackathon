import {AppError} from '../errors.js';
import {readCached,writeCached} from '../persistence.js';
import {locationInput} from './farms.js';
import {TILE_ZOOM,TILE_SIZE,worldPixel,pixelPosition,pixelSpacing,validateBoundary,insidePolygon,slopeAspect,decodeTerrariumPng} from './terrain-math.js';

export const TERRAIN_TEMPLATE='https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png';
const notes=[
  'Historical DEM mosaic including SRTM and other providers, not a surveyed farm height or current observation.',
  'Tile sampling spacing is not source accuracy. Elevation datum, source resolution and age can vary.',
  'Slope uses central differences of unexaggerated elevation and neighbouring pixels; aspect is downhill, clockwise from north.',
  'Only DEM pixel centres inside the supplied polygon, excluding holes, are summarised. Boundaries are approximate.',
  'Transparent and lowest encoded elevation pixels remain missing. Fewer than nine valid interior gradients leave slope/aspect unassessed.',
  'Terrain is context only: no erosion prediction, crop suitability, ownership or access is established.'
];
const median=values=>{const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length?(sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2):null;};
export function circularMean(values){
  if(!values.length)return null;
  const x=values.reduce((sum,value)=>sum+Math.sin(value*Math.PI/180),0),y=values.reduce((sum,value)=>sum+Math.cos(value*Math.PI/180),0);
  return Math.hypot(x,y)<values.length*1e-9?null:(Math.atan2(x,y)*180/Math.PI+360)%360;
}
export function summariseField(geometry,tiles,bounds=validateBoundary(geometry)){
  const byId=new Map(tiles.map(tile=>[`${tile.x},${tile.y}`,tile]));
  const sample=(x,y)=>{const tile=byId.get(`${Math.floor(x/TILE_SIZE)},${Math.floor(y/TILE_SIZE)}`);return tile?.values[((y%TILE_SIZE)+TILE_SIZE)%TILE_SIZE*TILE_SIZE+((x%TILE_SIZE)+TILE_SIZE)%TILE_SIZE]??NaN;};
  let interiorPixels=0,missingGradients=0;const heights=[],slopes=[],aspects=[],spacing=[];
  for(let y=bounds.minY;y<bounds.maxY;y++)for(let x=bounds.minX;x<bounds.maxX;x++){
    const position=pixelPosition(x+.5,y+.5);
    if(!insidePolygon([position.longitude,position.latitude],geometry))continue;
    interiorPixels++;const height=sample(x,y);if(Number.isFinite(height))heights.push(height);
    const metres=pixelSpacing(position.latitude),gradient=Number.isFinite(height)?slopeAspect(sample(x-1,y),sample(x+1,y),sample(x,y-1),sample(x,y+1),metres):null;
    if(!gradient){missingGradients++;continue;}
    slopes.push(gradient.slopeDegrees);spacing.push(metres);if(gradient.aspectDegrees!==null)aspects.push(gradient.aspectDegrees);
  }
  const assessed=slopes.length>=9;
  return{assessed,interiorPixels,validElevationPixels:heights.length,validGradientPixels:slopes.length,missingGradientPixels:missingGradients,
    elevationMinM:heights.length?Math.min(...heights):null,elevationMaxM:heights.length?Math.max(...heights):null,
    slopeMedianDegrees:assessed?median(slopes):null,slopeMaxDegrees:assessed?Math.max(...slopes):null,
    aspectMeanDegrees:assessed?circularMean(aspects):null,nonFlatAspectPixels:aspects.length,
    sampleSpacingM:spacing.length?[Math.min(...spacing),Math.max(...spacing)]:null};
}
export function createTerrainClient({fetchImpl=fetch,now=()=>new Date(),ttlMs=86_400_000}={}){
  const cache=new Map(),pending=new Map(),limit=2**TILE_ZOOM;
  async function tile(x,y){
    if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=limit||y>=limit)throw new AppError('Terrain tile is outside the supported map.');
    const url=TERRAIN_TEMPLATE.replace('{z}',TILE_ZOOM).replace('{x}',x).replace('{y}',y),key=`terrain:terrarium:v1:${TILE_ZOOM}/${x}/${y}`;
    if(cache.has(key)&&now().getTime()-cache.get(key).storedAt<ttlMs)return cache.get(key).data;
    if(pending.has(key))return pending.get(key);
    const task=(async()=>{
      const saved=await readCached(key,ttlMs);if(saved){cache.set(key,saved);while(cache.size>16)cache.delete(cache.keys().next().value);return saved.data;}
      try{
        const response=await fetchImpl(url,{signal:AbortSignal.timeout(20_000)});
        if(!response.ok)throw Error(`HTTP ${response.status}`);
        if(Number(response.headers?.get('content-length')??0)>1_000_000)throw Error('Oversized terrain tile.');
        const decoded=await decodeTerrariumPng(await response.arrayBuffer());
        if(decoded.width!==TILE_SIZE||decoded.height!==TILE_SIZE)throw Error('Terrain tile dimensions changed.');
        const data={...decoded,x,y,url,retrievedAt:now().toISOString(),fileModifiedAt:response.headers?.get('last-modified')??null,
          sourceFiles:response.headers?.get('x-amz-meta-x-imagery-sources')??response.headers?.get('x-imagery-sources')??null};
        cache.set(key,{data,storedAt:now().getTime()});while(cache.size>16)cache.delete(cache.keys().next().value);
        await writeCached(key,data,data.retrievedAt);return data;
      }catch(error){const wrapped=new AppError('Terrain data is unavailable. Elevation, slope and aspect remain unknown; no values were substituted.',502,'TERRAIN_UNAVAILABLE');wrapped.cause=error;throw wrapped;}
    })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
  }
  function metadata(tiles){return{id:'terrain-context',product:'Terrain Tiles Terrarium DEM mosaic',kind:'derived',units:{elevation:'m',slope:'degrees',aspect:'degrees clockwise from north'},
    date:null,observationDate:null,retrievedAt:tiles.map(t=>t.retrievedAt).sort().at(-1),spatialResolution:{zoom:TILE_ZOOM,tilePixels:TILE_SIZE},
    attribution:'Mapzen Terrain Tiles / contributing datasets including USGS SRTM',url:'https://registry.opendata.aws/terrain-tiles/',
    sourceTiles:tiles.map(({url,retrievedAt,fileModifiedAt,sourceFiles})=>({url,retrievedAt,fileModifiedAt,sourceFiles})),
    missingness:'Missing DEM pixels and gradients stay unknown. Source headers can be unavailable to browser clients.',notices:notes};}
  return{
    async point(input){
      const location=locationInput(input);let position;try{position=worldPixel(location.longitude,location.latitude);}catch(error){throw new AppError(error.message);}
      const x=Math.min(limit*TILE_SIZE-1,Math.floor(position.x)),y=Math.min(limit*TILE_SIZE-1,Math.floor(position.y)),data=await tile(Math.floor(x/TILE_SIZE),Math.floor(y/TILE_SIZE));
      const elevation=data.values[(y%TILE_SIZE)*TILE_SIZE+x%TILE_SIZE];
      return{...metadata([data]),kind:'estimated',location,elevationM:Number.isFinite(elevation)?elevation:null,sampleSpacingM:pixelSpacing(location.latitude),
        sampling:'Nearest DEM pixel at the selected coordinate; not a surveyed point. Slope/aspect require a selected field.'};
    },
    async field(input){
      let bounds;try{bounds=validateBoundary(input?.geometry);}catch(error){throw new AppError(error.message);}
      if((bounds.maxX-bounds.minX)*(bounds.maxY-bounds.minY)>50_000)throw new AppError('Field terrain context supports at most 50,000 DEM pixel centres. Choose a smaller boundary.');
      const west=Math.max(0,Math.floor((bounds.minX-1)/TILE_SIZE)),east=Math.min(limit-1,Math.floor(bounds.maxX/TILE_SIZE)),north=Math.max(0,Math.floor((bounds.minY-1)/TILE_SIZE)),south=Math.min(limit-1,Math.floor(bounds.maxY/TILE_SIZE));
      if((east-west+1)*(south-north+1)>9)throw new AppError('This boundary spans more than nine terrain tiles. Choose a smaller boundary.');
      const tiles=[];for(let y=north;y<=south;y++)for(let x=west;x<=east;x++)tiles.push(await tile(x,y));
      return{...metadata(tiles),fieldId:typeof input.fieldId==='string'?input.fieldId.slice(0,40):null,...summariseField(input.geometry,tiles,bounds)};
    }
  };
}

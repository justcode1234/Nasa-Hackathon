import {AppError} from '../errors.js';
import {createCachedJson} from '../context/client.js';
import {normalizePower,validateLocation,createPowerClient} from './power.js';

// MERRA-2 output centres: (-180,-90), 576 x 361, 0.625 x 0.5 degrees.
// NASA GMAO MERRA-2 file specification. Bounds are derived centre midpoints,
// clipped at the poles, not a surveyed parcel or instrument footprint.
export const GRID_SOURCE='https://gmao.gsfc.nasa.gov/pubs/docs/Collow1466.pdf';
export const RAIN='PRECTOTCORR';
export function nativeCell(latitude,longitude){
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw new AppError('Invalid grid coordinates.');
  const row=Math.max(0,Math.min(360,Math.round((latitude+90)/.5)));
  const column=((Math.round((longitude+180)/.625)%576)+576)%576;
  const lat=-90+row*.5,lon=-180+column*.625;
  return{id:`${row}:${column}`,row,column,latitude:lat,longitude:lon,
    south:Math.max(-90,lat-.25),north:Math.min(90,lat+.25),west:lon-.3125,east:lon+.3125};
}
export function cellGeometry(cell){
  const spans=cell.west < -180 ? [[cell.west+360,180],[-180,cell.east]] : cell.east > 180 ? [[cell.west,180],[-180,cell.east-360]] : [[cell.west,cell.east]];
  const rings=spans.map(([west,east])=>[[west,cell.south],[east,cell.south],[east,cell.north],[west,cell.north],[west,cell.south]]);
  return rings.length===1?{type:'Polygon',coordinates:[rings[0]]}:{type:'MultiPolygon',coordinates:rings.map(ring=>[ring])};
}
function cellRecord(data,cell){
  return{...cell,geometry:cellGeometry(cell),dates:data.dates,values:data.parameters[RAIN].values,
    monthly:data.monthly.map(month=>({period:month.period,...month.parameters[RAIN]}))};
}
export function normalizeGrid(raw,selection,url,retrievedAt){
  if(raw?.type!=='FeatureCollection'||!Array.isArray(raw.features)||raw.features.length>1000||!raw.header?.sources?.includes('MERRA2')||!raw.parameters?.[RAIN])throw new AppError('NASA returned an unsupported native grid.',502,'NASA_SCHEMA');
  const selected=nativeCell(selection.latitude,selection.longitude),seen=new Set(),cells=[];
  for(const feature of raw.features){
    const coordinates=feature.geometry?.coordinates;
    if(feature.geometry?.type!=='Point'||!Array.isArray(coordinates))throw new AppError('NASA grid coordinates are missing.',502,'NASA_SCHEMA');
    const [lon,lat]=coordinates,cell=nativeCell(lat,lon);
    if(Math.abs(lat-cell.latitude)>1e-6||Math.abs(lon-cell.longitude)>1e-6||seen.has(cell.id))throw new AppError('NASA grid alignment changed; columns are unavailable.',502,'NASA_SCHEMA');
    seen.add(cell.id);
    const dx=Math.min(Math.abs(cell.column-selected.column),576-Math.abs(cell.column-selected.column));
    if(dx>1||Math.abs(cell.row-selected.row)>1)continue;
    const data=normalizePower({header:raw.header,parameters:raw.parameters,properties:feature.properties},selection,url,retrievedAt);
    cells.push(cellRecord(data,cell));
  }
  if(!cells.some(cell=>cell.id===selected.id))throw new AppError('NASA did not return the selected native grid centre.',502,'NASA_SCHEMA');
  return gridResult(cells,selected,selection,url,retrievedAt,raw.header.title);
}
function gridResult(cells,selected,selection,url,retrievedAt,product){
  return{schemaVersion:1,id:'power-native-rain',product,kind:'estimated',units:'mm',sourceUnits:'mm/day',
    parameter:RAIN,period:{start:`${selection.year}-01-01`,end:`${selection.year}-12-31`,timeStandard:'LST'},
    spatialResolution:{latitudeDegrees:.5,longitudeDegrees:.625,sourceUrl:GRID_SOURCE},retrievedAt,url,
    attribution:'NASA POWER / MERRA-2',selection:{latitude:selection.latitude,longitude:selection.longitude},selectedCellId:selected.id,cells,
    missingness:'Null days remain missing; partial monthly sums include available days only.',
    boundsKind:'Derived midpoint bounds around documented native output centres; not field measurements.',
    notices:['Historical estimated regional rainfall, not a forecast or a farm sensor.','Monthly sums cover available daily values; missing rainfall is never treated as zero.','Cell bounds illustrate the native output grid using centre midpoints. They are not surveyed boundaries.']};
}
export function createPowerGridClient(options={}){
  const request=createCachedJson(options),point=createPowerClient(options);
  return async input=>{
    const selection=validateLocation(input.latitude,input.longitude,input.year),cell=nativeCell(selection.latitude,selection.longitude);
    // A wrapped regional bbox is unsupported by POWER. Fetch the single native
    // centre at the date line; do not invent its neighbours.
    if(cell.longitude-1.01 < -180||cell.longitude+1.01 > 180){
      const data=await point({latitude:cell.latitude,longitude:cell.longitude,year:selection.year});
      const result=gridResult([cellRecord(data,cell)],cell,selection,data.source.url,data.retrievedAt,data.source.product);
      result.notices.push('Only the selected cell is shown here because a regional request would cross the date line.');return result;
    }
    const south=Math.max(-90,Math.min(87.98,cell.latitude-1.01)),west=cell.longitude-1.01;
    const url=new URL('https://power.larc.nasa.gov/api/temporal/daily/regional');
    url.search=new URLSearchParams({parameters:RAIN,community:'AG','latitude-min':south.toFixed(4),'latitude-max':Math.min(90,south+2.02).toFixed(4),
      'longitude-min':west.toFixed(4),'longitude-max':(west+2.02).toFixed(4),start:`${selection.year}0101`,end:`${selection.year}1231`,format:'JSON','time-standard':'LST'});
    const raw=await request(url,{timeoutMs:25_000});
    return normalizeGrid(raw,selection,url.href,raw._fieldshiftRetrievedAt??new Date().toISOString());
  };
}

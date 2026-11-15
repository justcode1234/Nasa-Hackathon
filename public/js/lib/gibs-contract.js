const metadata='https://raw.githubusercontent.com/nasa-gibs/worldview/main/config/default/common/config/metadata/layers/';
export const GIBS_PRODUCTS={
  MODIS_Terra_NDVI_8Day:{name:'MODIS Terra greenness (rolling 8-day NDVI)',units:'unitless NDVI',spatialResolution:'250 m sensor and imagery resolution',referenceUrl:metadata+'modis/terra/MODIS_Terra_NDVI_8Day.md'},
  SMAP_L4_Analyzed_Surface_Soil_Moisture:{name:'SMAP L4 surface soil moisture (model value-added)',units:'m³/m³',spatialResolution:'9 km EASE-Grid; model-derived top 5 cm soil moisture',referenceUrl:metadata+'smap/SMAP_L4_Analyzed_Surface_Soil_Moisture.md'},
  IMERG_Precipitation_Rate:{name:'IMERG precipitation rate (daily imagery)',units:'mm/hour',spatialResolution:'0.1° × 0.1° source grid (about 11 km at the Equator)',referenceUrl:metadata+'multi-mission/imerg/IMERG_Precipitation_Rate.md'},
  MODIS_Terra_Land_Surface_Temp_Day:{name:'MODIS Terra daytime land-surface temperature',units:'K',spatialResolution:'1 km sensor and imagery resolution',referenceUrl:metadata+'modis/terra/MODIS_Terra_Land_Surface_Temp_Day.md'}
};
export function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function isAvailableDate(layer,date){
  if(!validDate(date))return false;
  return layer.intervals.some(interval=>date>=interval.start&&date<=interval.end&&(Date.parse(date)-Date.parse(interval.start))%(interval.stepDays*86_400_000)===0);
}
export function nasaUrl(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.hostname!=='gibs.earthdata.nasa.gov'||url.username||url.password)throw new Error('Unexpected GIBS resource host.');
  return value;
}
export function imageryUrl(layer,date){
  if(!isAvailableDate(layer,date))throw new Error('Choose a date inside the NASA-advertised availability intervals.');
  return nasaUrl(layer.template.replace('{Time}',date).replace('{TileMatrixSet}',layer.matrix).replace('{Style}','default').replace('{TileMatrix}','{z}').replace('{TileRow}','{y}').replace('{TileCol}','{x}'));
}

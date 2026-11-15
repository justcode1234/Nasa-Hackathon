import {AppError} from '../errors.js';
import {readCached,writeCached} from '../persistence.js';

export const CAPABILITIES='https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml';
import {GIBS_PRODUCTS,isAvailableDate,imageryUrl,validDate,nasaUrl} from '../../public/js/lib/gibs-contract.js';
export {GIBS_PRODUCTS,isAvailableDate,imageryUrl,validDate} from '../../public/js/lib/gibs-contract.js';
const decode=value=>String(value).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const tag=(xml,name)=>decode(xml.match(new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}>`))?.[1]??'').trim();
const tags=(xml,name)=>[...xml.matchAll(new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}>`,'g'))].map(match=>decode(match[1]).trim());
function attributes(text){return Object.fromEntries([...text.matchAll(/([\w:.-]+)\s*=\s*(["'])(.*?)\2/g)].map(match=>[match[1],decode(match[3])]));}
export function parseGibsCapabilities(xml,retrievedAt){
  if(typeof xml!=='string'||xml.length>12_000_000||!/<(?:[\w.-]+:)?Capabilities\b/.test(xml)||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new AppError('NASA imagery metadata changed or is unavailable. No dates were guessed.',502,'GIBS_SCHEMA');
  const layers=[],unavailable=[];
  for(const block of tags(xml,'Layer')){
    const id=tag(block,'Identifier');if(!Object.hasOwn(GIBS_PRODUCTS,id))continue;
    try{
      const matrix=tag(block,'TileMatrixSet'),zoom=matrix.match(/^GoogleMapsCompatible_Level(\d+)$/);
      const time=tags(block,'Dimension').find(dimension=>tag(dimension,'Identifier')==='Time');
      const intervals=tags(time??'','Value').map(value=>{
        const match=value.match(/^(\d{4}-\d{2}-\d{2})(?:\/(\d{4}-\d{2}-\d{2})\/P(\d+)D)?$/);
        if(!match||!validDate(match[1])||!validDate(match[2]??match[1])||Number(match[3]??1)<1)throw new Error('Unsupported imagery date interval.');
        return{start:match[1],end:match[2]??match[1],stepDays:Number(match[3]??1)};
      });
      const resources=[...block.matchAll(/<(?:[\w.-]+:)?ResourceURL\b([^>]*?)\/?\s*>/g)].map(match=>attributes(match[1]));
      const resource=resources.find(item=>item.resourceType==='tile'&&item.template?.includes(id));
      const legends=[...block.matchAll(/<(?:[\w.-]+:)?LegendURL\b([^>]*?)\/?\s*>/g)].map(match=>attributes(match[1]));
      const legend=legends.find(item=>(item['xlink:role']??'').endsWith('/horizontal'))??legends[0];
      if(!zoom||Number(zoom[1])>20||!resource||!legend||!intervals.length)throw new Error('Missing imagery scale, time or legend metadata.');
      const layer={id,...GIBS_PRODUCTS[id],product:tag(block,'Title'),kind:'imagery',matrix,maxZoom:Number(zoom[1]),intervals,defaultDate:tag(time,'Default'),
        template:nasaUrl(resource.template),legendUrl:nasaUrl(legend['xlink:href']),url:CAPABILITIES,retrievedAt,attribution:'NASA GIBS / NASA Worldview',
        missingness:'Transparent or unavailable tiles can indicate missing coverage. Imagery is visual context; values are not extracted.'};
      if(!isAvailableDate(layer,layer.defaultDate))throw new Error('NASA default date is outside its advertised intervals.');
      imageryUrl(layer,layer.defaultDate);layers.push(layer);
    }catch(error){unavailable.push({id,reason:error.message});}
  }
  for(const id of Object.keys(GIBS_PRODUCTS))if(!layers.some(layer=>layer.id===id)&&!unavailable.some(layer=>layer.id===id))unavailable.push({id,reason:'Layer is not advertised in the current capabilities.'});
  if(!layers.length)throw new AppError('NASA did not advertise any supported imagery layers. No imagery dates were guessed.',502,'GIBS_SCHEMA');
  return{schemaVersion:1,url:CAPABILITIES,retrievedAt,layers,unavailable};
}
export function createGibsClient({fetchImpl=fetch,ttlMs=86_400_000,now=()=>new Date()}={}){
  let cached,pending;const key='gibs:epsg3857:science-layers:v1';
  return async()=>{
    if(cached&&now().getTime()-cached.storedAt<ttlMs)return cached.data;
    if(pending)return pending;
    pending=(async()=>{
      const saved=await readCached(key,ttlMs);if(saved){cached=saved;return saved.data;}
      let response;
      try{response=await fetchImpl(CAPABILITIES,{headers:{Accept:'application/xml'},signal:AbortSignal.timeout(25_000)});}
      catch{throw new AppError('NASA imagery metadata could not be reached. Retry later; no dates were guessed.',502,'GIBS_UNAVAILABLE');}
      if(!response.ok)throw new AppError(`NASA imagery metadata is unavailable (HTTP ${response.status}). Retry later.`,502,'GIBS_UNAVAILABLE');
      if(Number(response.headers?.get('content-length')??0)>12_000_000)throw new AppError('NASA imagery metadata exceeds the supported size.',502,'GIBS_SCHEMA');
      const result=parseGibsCapabilities(await response.text(),now().toISOString());cached={storedAt:now().getTime(),data:result};
      await writeCached(key,result,result.retrievedAt);return result;
    })();
    try{return await pending;}finally{pending=null;}
  };
}

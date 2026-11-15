// Shared, dependency-free Terrarium decoding and finite-difference context.
export const TILE_ZOOM=12,TILE_SIZE=256,RADIUS=6378137;
export function terrariumHeight(red,green,blue,alpha=255){
  if(![red,green,blue,alpha].every(value=>Number.isInteger(value)&&value>=0&&value<=255))throw Error('Invalid terrain pixel.');
  if(alpha===0||(red===0&&green===0&&blue===0))return null;
  return red*256+green+blue/256-32768;
}
export function worldPixel(longitude,latitude,zoom=TILE_ZOOM){
  if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||Math.abs(longitude)>180||Math.abs(latitude)>85.05112878)throw Error('Terrain tiles support Web Mercator latitudes only.');
  const scale=TILE_SIZE*2**zoom;
  return{x:(longitude+180)/360*scale,y:(1-Math.asinh(Math.tan(latitude*Math.PI/180))/Math.PI)/2*scale};
}
export function pixelPosition(x,y,zoom=TILE_ZOOM){
  const scale=TILE_SIZE*2**zoom;
  return{longitude:x/scale*360-180,latitude:Math.atan(Math.sinh(Math.PI*(1-2*y/scale)))*180/Math.PI};
}
export const pixelSpacing=(latitude,zoom=TILE_ZOOM)=>Math.cos(latitude*Math.PI/180)*2*Math.PI*RADIUS/(TILE_SIZE*2**zoom);
export function slopeAspect(left,right,north,south,spacing){
  if(![left,right,north,south,spacing].every(Number.isFinite)||spacing<=0)return null;
  const east=(right-left)/(2*spacing),down=(south-north)/(2*spacing),gradient=Math.hypot(east,down);
  return{slopeDegrees:Math.atan(gradient)*180/Math.PI,aspectDegrees:gradient<1e-12?null:(Math.atan2(-east,down)*180/Math.PI+360)%360};
}
function inRing(point,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
export const insidePolygon=(point,geometry)=>inRing(point,geometry.coordinates[0])&&!geometry.coordinates.slice(1).some(ring=>inRing(point,ring));
export function validateBoundary(geometry){
  if(geometry?.type!=='Polygon'||!Array.isArray(geometry.coordinates)||!geometry.coordinates.length||geometry.coordinates.length>20)throw Error('Select a supported Polygon field boundary.');
  let count=0;const points=[];
  for(const ring of geometry.coordinates){
    if(!Array.isArray(ring)||ring.length<4)throw Error('A field boundary needs a closed ring.');
    count+=ring.length;if(count>1000)throw Error('This prototype supports at most 1,000 field-boundary vertices.');
    for(const point of ring){if(!Array.isArray(point)||point.length!==2||!point.every(Number.isFinite))throw Error('Invalid field coordinate.');worldPixel(point[0],point[1]);points.push(point);}
    if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])throw Error('The field boundary is not closed.');
  }
  if(count>1000)throw Error('This prototype supports at most 1,000 field-boundary vertices.');
  const west=Math.min(...points.map(p=>p[0])),east=Math.max(...points.map(p=>p[0])),south=Math.min(...points.map(p=>p[1])),north=Math.max(...points.map(p=>p[1]));
  if(east-west>180)throw Error('Field terrain analysis does not yet support boundaries crossing the date line.');
  const top=worldPixel(west,north),bottom=worldPixel(east,south);
  if(bottom.x-top.x<1||bottom.y-top.y<1)throw Error('This boundary is smaller than one terrain pixel; slope and aspect remain unassessed.');
  return{west,east,south,north,minX:Math.floor(top.x),maxX:Math.ceil(bottom.x),minY:Math.floor(top.y),maxY:Math.ceil(bottom.y)};
}
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
export function crc32(bytes){let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return(value^0xffffffff)>>>0;}
export async function decodeTerrariumPng(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.length>1_000_000||bytes.length<33||[137,80,78,71,13,10,26,10].some((value,i)=>bytes[i]!==value))throw Error('Invalid or oversized terrain PNG.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),chunks=[];let width,height,channels,ended=false;
  for(let offset=8;offset+12<=bytes.length;){
    const length=view.getUint32(offset),end=offset+8+length;
    if(end+4>bytes.length)throw Error('Truncated terrain PNG.');
    const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8)),data=bytes.subarray(offset+8,end);
    if(crc32(bytes.subarray(offset+4,end))!==view.getUint32(end))throw Error('Terrain PNG integrity check failed.');
    if(type==='IHDR'){
      if(width||length!==13)throw Error('Invalid terrain PNG header.');
      width=view.getUint32(offset+8);height=view.getUint32(offset+12);channels=data[9]===2?3:data[9]===6?4:null;
      if(width<3||height<3||width>512||height>512||data[8]!==8||!channels||data[10]||data[11]||data[12])throw Error('Unsupported terrain PNG format.');
    }else if(type==='IDAT')chunks.push(data);
    else if(type==='IEND'){ended=true;break;}
    offset=end+4;
  }
  if(!ended||!width||!chunks.length)throw Error('Incomplete terrain PNG.');
  const expected=height*(1+width*channels),reader=new Blob(chunks).stream().pipeThrough(new DecompressionStream('deflate')).getReader(),parts=[];let total=0;
  try{while(true){const{value,done}=await reader.read();if(done)break;total+=value.length;if(total>expected)throw Error('Terrain PNG decompressed size changed.');parts.push(value);}}
  finally{await reader.cancel().catch(()=>{});}
  if(total!==expected)throw Error('Terrain PNG scanlines are incomplete.');
  const raw=new Uint8Array(total);let cursor=0;for(const part of parts){raw.set(part,cursor);cursor+=part.length;}
  const stride=width*channels,pixels=new Uint8Array(width*height*channels);
  const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];if(filter>4)throw Error('Unknown PNG scanline filter.');
    for(let x=0;x<stride;x++){
      const index=y*stride+x,left=x>=channels?pixels[index-channels]:0,up=y?pixels[index-stride]:0,diagonal=y&&x>=channels?pixels[index-stride-channels]:0;
      const prediction=[0,left,up,Math.floor((left+up)/2),paeth(left,up,diagonal)][filter];pixels[index]=(raw[y*(stride+1)+1+x]+prediction)&255;
    }
  }
  const values=new Float64Array(width*height);
  for(let i=0;i<values.length;i++)values[i]=terrariumHeight(pixels[i*channels],pixels[i*channels+1],pixels[i*channels+2],channels===4?pixels[i*channels+3]:255)??NaN;
  return{width,height,values};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deflateSync} from 'node:zlib';
import {terrariumHeight,decodeTerrariumPng,crc32,slopeAspect,worldPixel,pixelPosition,pixelSpacing,validateBoundary} from '../server/context/terrain-math.js';
import {createTerrainClient,summariseField,circularMean} from '../server/context/terrain.js';

const realTile=()=>readFileSync(new URL('fixtures/terrarium-york-z12.png',import.meta.url));
test('Terrarium PNG decoding matches independently checked recorded RGB pixels and rejects corruption',async()=>{
  const tile=await decodeTerrariumPng(realTile());assert.equal(tile.width,256);assert.equal(tile.height,256);
  assert.equal(tile.values[0],260);assert.equal(terrariumHeight(128,0,0),0);assert.equal(terrariumHeight(127,255,128),-.5);
  assert.equal(tile.values[128*256+128],209);assert.equal(tile.values[255*256+255],188);
  assert.equal(terrariumHeight(0,0,0),null);assert.equal(terrariumHeight(128,0,0,0),null);
  const broken=Buffer.from(realTile());broken[50]^=1;await assert.rejects(decodeTerrariumPng(broken),/integrity/);
  await assert.rejects(decodeTerrariumPng(new Uint8Array(40)),/Invalid/);
  assert.throws(()=>terrariumHeight(256,0,0));
});
// TEST ONLY: a known 3x3 RGB PNG, no filters/interlace. Tests missing pixels
// independently of the real provider fixture's adaptive PNG filters.
test('minimal synthetic PNG preserves fractional heights and missing pixels',async()=>{
  const chunk=(type,data)=>{const label=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([label,data])));return Buffer.concat([size,label,data,crc]);};
  const header=Buffer.alloc(13);header.writeUInt32BE(3,0);header.writeUInt32BE(3,4);header[8]=8;header[9]=2;
  const rows=Buffer.from([0,128,0,0,128,0,128,0,0,0,0,128,1,0,128,2,0,128,3,0,0,128,4,0,128,5,0,128,6,0]);
  const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
  const result=await decodeTerrariumPng(png);assert.deepEqual(Array.from(result.values).slice(0,3),[0,.5,NaN]);assert.equal(result.values[8],6);
});
test('finite differences recover plane slope, downhill aspect and flat/unknown cases',()=>{
  assert.deepEqual(slopeAspect(10,10,10,10,30),{slopeDegrees:0,aspectDegrees:null});
  assert.equal(slopeAspect(-30,30,0,0,30).slopeDegrees,45);assert.equal(slopeAspect(-30,30,0,0,30).aspectDegrees,270);
  assert.equal(slopeAspect(0,0,-30,30,30).aspectDegrees,0);assert.equal(slopeAspect(NaN,1,2,3,30),null);
  assert.ok(Math.abs(circularMean([359,1]))<1e-9);assert.equal(circularMean([0,180]),null);assert.equal(circularMean([]),null);
});
test('polygon masking excludes holes and never invents a small-field slope',()=>{
  const origin=2048*256,spacing=pixelSpacing(0),values=Float64Array.from({length:256*256},(_,i)=>(i%256)*spacing);
  const ring=(left,top,right,bottom)=>[[left,top],[right,top],[right,bottom],[left,bottom],[left,top]].map(([x,y])=>{const p=pixelPosition(origin+x,origin+y);return[p.longitude,p.latitude];});
  const geometry={type:'Polygon',coordinates:[ring(10,10,15,15),ring(11,11,14,14)]},tile={x:2048,y:2048,values};
  const result=summariseField(geometry,[tile]);assert.equal(result.interiorPixels,16);assert.equal(result.validGradientPixels,16);assert.equal(result.assessed,true);
  assert.ok(Math.abs(result.slopeMedianDegrees-45)<1e-4);assert.ok(Math.abs(result.aspectMeanDegrees-270)<1e-8);
  const tiny={type:'Polygon',coordinates:[ring(10,10,12,12)]},small=summariseField(tiny,[tile]);assert.equal(small.interiorPixels,4);assert.equal(small.assessed,false);assert.equal(small.slopeMedianDegrees,null);
  assert.throws(()=>validateBoundary({type:'Polygon',coordinates:[[[179,0],[-179,0],[-179,1],[179,0]]]}),/date line/);
  const point=worldPixel(116.77,-31.89);assert.ok(pixelSpacing(-31.89)>32&&pixelSpacing(-31.89)<33);assert.ok(Number.isFinite(point.x));
});
test('terrain point client uses bounded fixed-host tiles and retains cached provenance',async()=>{
  let calls=0,requested;
  const client=createTerrainClient({fetchImpl:async url=>{requested=url;calls++;return{ok:true,arrayBuffer:async()=>realTile(),headers:{get:name=>name==='x-amz-meta-x-imagery-sources'?'TEST recorded SRTM fixture':null}};}});
  const first=await client.point({latitude:-31.89,longitude:116.77,url:'https://untrusted.invalid'}),second=await client.point({latitude:-31.89,longitude:116.77});
  assert.equal(calls,1);assert.equal(requested,'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/12/3376/2431.png');assert.equal(first.retrievedAt,second.retrievedAt);assert.equal(first.observationDate,null);assert.ok(Number.isFinite(first.elevationM));
  await assert.rejects(client.point({latitude:89,longitude:0}),/Mercator/);
  const failed=createTerrainClient({fetchImpl:async()=>({ok:false,status:503})});await assert.rejects(failed.point({latitude:0,longitude:0}),/remain unknown/);
});

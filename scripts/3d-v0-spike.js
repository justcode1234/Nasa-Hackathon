// Isolated V0 experiment. MapLibre is NOT an application dependency or build input.
import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'artifacts/3d-v0');
export async function prepareSpike(){
  await mkdir(path.join(out,'vendor'),{recursive:true});
  const meta=await(await fetch('https://registry.npmjs.org/maplibre-gl/5.24.0')).json();
  if(meta.name!=='maplibre-gl'||meta.version!=='5.24.0'||new URL(meta.dist.tarball).hostname!=='registry.npmjs.org')throw Error('Unexpected package metadata');
  const tarball=Buffer.from(await(await fetch(meta.dist.tarball)).arrayBuffer());
  if('sha512-'+createHash('sha512').update(tarball).digest('base64')!==meta.dist.integrity)throw Error('Pinned npm package integrity mismatch');
  const tar=gunzipSync(tarball),files=[];
  for(let offset=0;offset+512<=tar.length;){
    const h=tar.subarray(offset,offset+512),name=h.subarray(0,100).toString().replace(/\0.*$/s,''),size=parseInt(h.subarray(124,136).toString().replace(/\0.*$/s,'').trim(),8)||0;
    if(['package/dist/maplibre-gl.js','package/dist/maplibre-gl.css','package/LICENSE.txt'].includes(name)){
      const data=tar.subarray(offset+512,offset+512+size);await writeFile(path.join(out,'vendor',path.basename(name)),data);
      files.push({name,bytes:data.length,gzipBytes:gzipSync(data).length,sha256:createHash('sha256').update(data).digest('hex')});
    }
    offset+=512+Math.ceil(size/512)*512;
  }
  if(files.length!==3)throw Error('Pinned package is missing required files');
  await writeFile(path.join(out,'package-size.json'),JSON.stringify({version:meta.version,integrity:meta.dist.integrity,integrityVerified:true,tarballBytes:tarball.length,files},null,2));
  const attribution=await(await fetch('https://raw.githubusercontent.com/tilezen/joerd/master/docs/attribution.md')).text();
  await writeFile(path.join(out,'terrain-attribution.txt'),attribution);
}
export function createSpikeServer(){
  const files={'/':'experiments/3d-v0/index.html','/spike.js':'experiments/3d-v0/spike.js','/app.css':'public/css/app.css',
    '/vendor/maplibre-gl.js':'artifacts/3d-v0/vendor/maplibre-gl.js','/vendor/maplibre-gl.css':'artifacts/3d-v0/vendor/maplibre-gl.css','/vendor/LICENSE.txt':'artifacts/3d-v0/vendor/LICENSE.txt','/terrain-attribution.txt':'artifacts/3d-v0/terrain-attribution.txt'};
  return http.createServer(async(req,res)=>{
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; worker-src blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tile.openstreetmap.org https://gibs.earthdata.nasa.gov; connect-src 'self' https://tile.openstreetmap.org https://gibs.earthdata.nasa.gov https://elevation-tiles-prod.s3.amazonaws.com; object-src 'none'; base-uri 'none'");
    const name=files[new URL(req.url,'http://localhost').pathname];if(!name){res.writeHead(404);res.end('Not found');return;}
    const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.txt':'text/plain'}[path.extname(name)];
    try{const body=await readFile(path.join(root,name));res.writeHead(200,{'Content-Type':type+'; charset=utf-8'});res.end(body);}catch{res.writeHead(404);res.end('Not prepared; run node scripts/3d-v0-spike.js');}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  await prepareSpike();const server=createSpikeServer();server.listen(4175,'127.0.0.1',()=>console.log('V0-only experiment: http://127.0.0.1:4175 (Ctrl+C stops it). No application dependency added.'));
}

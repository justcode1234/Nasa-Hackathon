import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
const root=path.resolve(fileURLToPath(new URL('../dist/client/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.bin':'application/octet-stream','.png':'image/png','.svg':'image/svg+xml','.pdf':'application/pdf','.zip':'application/zip','.txt':'text/plain; charset=utf-8'};
const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
const identity=directory=>createHash('sha256').update(directory).digest('hex').slice(0,16);
export function createStaticPreview({directory=root}={}){
  const staticRoot=path.resolve(directory),previewId=identity(staticRoot);
  return http.createServer(async(request,response)=>{
    for(const header of config.headers[0].headers)response.setHeader(header.key,header.value);
    try{
      if(!['GET','HEAD'].includes(request.method))throw new Error('Not found');
      const url=new URL(request.url,'http://localhost');
      if(url.pathname==='/.well-known/fieldshift-preview'){
        response.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
        response.end(JSON.stringify({app:'fieldshift-static-preview',previewId}));return;
      }
      const name=decodeURIComponent(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname).replace(/^\/+/, '');
      const filename=path.resolve(staticRoot,name);
      if(!filename.startsWith(staticRoot+path.sep)||!types[path.extname(filename)])throw new Error('Not found');
      const bytes=await readFile(filename);
      response.writeHead(200,{'Content-Type':types[path.extname(filename)],'Cache-Control':'no-cache'});
      response.end(request.method==='HEAD'?undefined:bytes);
    }catch{response.writeHead(404,{'Content-Type':'text/plain'});response.end('Not found');}
  });
}
export function openBrowser(url){
  let child;
  if(process.platform==='win32')child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Start-Process -FilePath '${url}'`],{windowsHide:true,stdio:'ignore'});
  else child=spawn(process.platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'});
  child.on('error',()=>console.log(`Open ${url} in your browser.`));child.unref();
}
export async function startPreview({port=3000,open=true,opener=openBrowser,maxAttempts=20,directory=root,createServer,appName='fieldshift-static-preview'}={}){
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be an integer from 1 to 65535.');
  const staticRoot=path.resolve(directory),previewId=identity(staticRoot);
  for(let candidate=port;candidate<Math.min(65536,port+maxAttempts);candidate++){
    const url=`http://localhost:${candidate}`;
    const server=createServer?createServer():createStaticPreview({directory:staticRoot});
    try{
      await new Promise((resolve,reject)=>{
        const failed=error=>{server.removeListener('listening',ready);reject(error);};
        const ready=()=>{server.removeListener('error',failed);resolve();};
        server.once('error',failed);server.once('listening',ready);server.listen(candidate,'127.0.0.1');
      });
      if(open)opener(url);
      return{server,url,port:candidate,reused:false};
    }catch(error){
      if(error.code!=='EADDRINUSE')throw error;
      try{
        const response=await fetch(`http://127.0.0.1:${candidate}/.well-known/fieldshift-preview`,{signal:AbortSignal.timeout(1200)});
        const marker=await response.json();
        if(marker.app===appName&&marker.previewId===previewId){
          if(open)opener(url);
          return{server:null,url,port:candidate,reused:true};
        }
      }catch{/* Another application owns this port; try the next one. */}
    }
  }
  throw new Error(`No available preview port between ${port} and ${Math.min(65535,port+maxAttempts-1)}.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const result=await startPreview({port:Number(process.env.PORT??3000),open:process.env.NO_OPEN!=='1'&&!process.argv.includes('--no-open')});
    console.log(`Opening FieldShift: ${result.url}`);
  }catch(error){console.error(error.message);process.exitCode=1;}
}

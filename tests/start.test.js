import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { startPreview } from '../scripts/static-preview.js';

test('starting twice reuses the project preview and opens the same browser URL',async()=>{
  const reservation=http.createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
  const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const opened=[];const first=await startPreview({port,opener:url=>opened.push(url)});
  try{
    const second=await startPreview({port,opener:url=>opened.push(url)});
    assert.equal(second.reused,true);assert.equal(second.server,null);assert.equal(second.url,first.url);
    assert.deepEqual(opened,[first.url,first.url]);
    assert.equal((await fetch(first.url)).status,200);
  }finally{await new Promise(resolve=>first.server.close(resolve));}
});
test('an unrelated app keeps its port and FieldShift opens the next free one',async()=>{
  const other=http.createServer((req,res)=>res.end('another application'));other.listen(0,'127.0.0.1');await once(other,'listening');
  const port=other.address().port;const opened=[];let preview;
  try{
    preview=await startPreview({port,opener:url=>opened.push(url)});
    assert.notEqual(preview.port,port);assert.equal(preview.reused,false);
    assert.deepEqual(opened,[preview.url]);assert.equal(await(await fetch(`http://127.0.0.1:${port}`)).text(),'another application');
  }finally{if(preview?.server)await new Promise(resolve=>preview.server.close(resolve));await new Promise(resolve=>other.close(resolve));}
});

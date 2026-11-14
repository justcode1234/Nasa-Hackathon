import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startPreview } from '../scripts/static-preview.js';
import { startNodePreview } from '../scripts/node-preview.js';

async function previewFiles(t) {
  const parent = path.resolve(os.tmpdir());
  const directory = await mkdtemp(path.join(parent, 'fieldshift-preview-'));
  t.after(async () => {
    assert.equal(path.dirname(directory), parent);
    assert.ok(path.basename(directory).startsWith('fieldshift-preview-'));
    await rm(directory, { recursive: true, force: true });
  });
  await writeFile(path.join(directory, 'index.html'), '<title>FieldShift preview test fixture</title>');
  return directory;
}

test('starting twice reuses the project preview and opens the same browser URL',async t=>{
  const directory = await previewFiles(t);
  const reservation=http.createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
  const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const opened=[];const first=await startPreview({port,directory,opener:url=>opened.push(url)});
  try{
    const second=await startPreview({port,directory,opener:url=>opened.push(url)});
    assert.equal(second.reused,true);assert.equal(second.server,null);assert.equal(second.url,first.url);
    assert.deepEqual(opened,[first.url,first.url]);
    const response=await fetch(first.url);
    assert.equal(response.status,200);
    assert.match(await response.text(),/FieldShift preview test fixture/);
  }finally{await new Promise(resolve=>first.server.close(resolve));}
});
test('an unrelated app keeps its port and FieldShift opens the next free one',async t=>{
  const directory = await previewFiles(t);
  const other=http.createServer((req,res)=>res.end('another application'));other.listen(0,'127.0.0.1');await once(other,'listening');
  const port=other.address().port;const opened=[];let preview;
  try{
    preview=await startPreview({port,directory,opener:url=>opened.push(url)});
    assert.notEqual(preview.port,port);assert.equal(preview.reused,false);
    assert.deepEqual(opened,[preview.url]);assert.equal(await(await fetch(`http://127.0.0.1:${port}`)).text(),'another application');
  }finally{if(preview?.server)await new Promise(resolve=>preview.server.close(resolve));await new Promise(resolve=>other.close(resolve));}
});

test('a preview of a different directory is never reused as this project', async t => {
  const firstDirectory = await previewFiles(t), secondDirectory = await previewFiles(t);
  const first = await startPreview({ port: 30000, directory: firstDirectory, open: false, maxAttempts: 100 });
  let second;
  try {
    second = await startPreview({ port: first.port, directory: secondDirectory, open: false });
    assert.equal(second.reused, false);
    assert.notEqual(second.port, first.port);
    assert.equal((await fetch(second.url)).status, 200);
    assert.equal((await fetch(first.url)).status, 200);
  } finally {
    if (second?.server) await new Promise(resolve => second.server.close(resolve));
    await new Promise(resolve => first.server.close(resolve));
  }
});

test('Node testing and static showcase previews keep separate identities and can run together', async t => {
  const directory = await previewFiles(t);
  const reservation = http.createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const node = await startNodePreview({ port, open: false });
  let showcase;
  try {
    assert.equal((await startNodePreview({ port, open: false })).reused, true);
    showcase = await startPreview({ port, directory, open: false });
    assert.notEqual(showcase.port, node.port);
    assert.equal(showcase.reused, false);
    assert.equal((await fetch(node.url + '/api/health')).status, 200);
    assert.match(await (await fetch(node.url)).text(), /fieldshift-transport" content="http/);
    assert.equal((await fetch(showcase.url + '/api/health')).status, 404);
  } finally {
    if (showcase?.server) await new Promise(resolve => showcase.server.close(resolve));
    await new Promise(resolve => node.server.close(resolve));
  }
});

// Native WebDriver BiDi: https://developer.mozilla.org/en-US/docs/Web/WebDriver/How_to/Create_BiDi_connection
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import path from 'node:path';

export async function openFirefox() {
  const executable = process.env.FIREFOX_PATH ?? ['C:/Program Files/Mozilla Firefox/firefox.exe',
    'C:/Program Files (x86)/Mozilla Firefox/firefox.exe', '/usr/bin/firefox'].find(existsSync);
  if (!executable) throw new Error('Installed Firefox required; no browser or driver will be downloaded.');
  await mkdir('artifacts', { recursive: true });
  const profileRoot=await realpath(tmpdir());
  const profile = await mkdtemp(path.join(profileRoot,'fieldshift-firefox-'));
  async function removeProfile(){
    const target=await realpath(profile);
    if(path.dirname(target)!==profileRoot || !path.basename(target).startsWith('fieldshift-firefox-'))throw new Error('Temporary Firefox profile escaped its intended root');
    await rm(target,{recursive:true,force:true,maxRetries:8,retryDelay:150});
  }
  const processHandle = spawn(executable, ['--headless', '-no-remote', '-profile', profile, '--remote-debugging-port', '0', 'about:blank'],
    { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let socket;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Firefox BiDi startup timed out.')), 20_000);
      processHandle.stderr.on('data', bytes => {
        output += bytes;
        const match = output.match(/WebDriver BiDi listening on (ws:\/\/[^\s]+)/);
        if (match) { clearTimeout(timeout); resolve(match[1].replace(/\/$/, '') + '/session'); }
      });
      processHandle.on('error', error => { clearTimeout(timeout); reject(error); });
      processHandle.on('exit', code => { clearTimeout(timeout); reject(new Error(`Firefox exited during startup: ${code}`)); });
    });
    socket = new WebSocket(endpoint);
    await once(socket, 'open');
    const pending = new Map(), events = [];
    let sequence = 0;
    const call = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`BiDi timeout: ${method}`)); }, 40_000);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params }));
    });
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id != null && pending.has(message.id)) {
        const task = pending.get(message.id); pending.delete(message.id); clearTimeout(task.timeout);
        if (message.type === 'error') task.reject(new Error(`${message.error}: ${message.message}`));
        else task.resolve(message.result);
      } else if (message.method) events.push(message);
    });
    socket.addEventListener('close', () => {
      for (const task of pending.values()) { clearTimeout(task.timeout); task.reject(new Error('Firefox BiDi connection closed.')); }
      pending.clear();
    });
    const session = await call('session.new', { capabilities: {} });
    const { context } = await call('browsingContext.create', { type: 'tab' });
    await call('session.subscribe', { events: ['log.entryAdded', 'network.beforeRequestSent', 'network.fetchError'] });
    // Callers serialize complex results as JSON text; workflow checks use primitives.
    const evaluate = async expression => {
      const result = await call('script.evaluate', { expression, target: { context }, awaitPromise: true });
      if (result.type === 'exception') throw new Error(result.exceptionDetails?.text ?? 'Firefox script evaluation failed.');
      return result.result?.value;
    };
    return { call, evaluate, context, session, events, processId: processHandle.pid,
      async navigate(url) { await call('browsingContext.navigate', { context, url, wait: 'complete' }); },
      async waitFor(expression, timeoutMs = 40_000) {
        const stop = Date.now() + timeoutMs;
        while (Date.now() < stop) {
          if (await evaluate(expression)) return;
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        throw new Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText')}`);
      },
      async close() {
        try { await call('browser.close'); } catch { /* Closing the browser can close its socket first. */ }
        socket.close(); processHandle.kill();await removeProfile();
      }
    };
  } catch (error) { socket?.close(); processHandle.kill(); await removeProfile();throw error; }
}

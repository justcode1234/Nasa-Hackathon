import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { once } from 'node:events';
import path from 'node:path';
export async function openChrome({ profileDirectory } = {}) {
  const executable = process.env.CHROME_PATH ?? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);
  if (!executable) throw new Error('Installed Chrome/Chromium required; no browser will be downloaded.');
  await mkdir('artifacts', { recursive: true });
  const profile = profileDirectory ?? await mkdtemp(path.resolve('artifacts/chrome-check-'));
  const processHandle = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Chrome startup timed out.')), 20000);
    processHandle.stderr.on('data', bytes => {
      output += bytes; const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    processHandle.on('error', reject);
  });
  const targets = await (await fetch(`http://${new URL(endpoint).host}/json/list`)).json();
  const socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await once(socket, 'open');
  const pending = new Map();
  let sequence = 0;
  const events = [];
  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const task = pending.get(data.id); pending.delete(data.id);
      if (data.error) task.reject(new Error(JSON.stringify(data.error))); else task.resolve(data.result);
    } else if (data.method) events.push(data);
  });
  const call = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const evaluate = async expression => {
    const value = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description ?? value.exceptionDetails.text);
    return value.result.value;
  };
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  return { call, evaluate, events, processId: processHandle.pid,
    async waitFor(expression, timeoutMs = 60_000) {
      const stop = Date.now() + timeoutMs;
      while (Date.now() < stop) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 250)); }
      throw new Error(`Timed out: ${expression}`);
    },
    async close() {
      try { const browser = new WebSocket(endpoint); await once(browser, 'open'); browser.send(JSON.stringify({ id: 1, method: 'Browser.close' })); browser.close(); } catch {}
      socket.close(); processHandle.kill();
    }
  };
}

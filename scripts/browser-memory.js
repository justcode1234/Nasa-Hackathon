import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const run = promisify(execFile);

export function processTree(records, rootProcessId) {
  const ids = new Set([rootProcessId]);
  let changed;
  do {
    changed = false;
    for (const record of records) {
      if (ids.has(record.parentId) && !ids.has(record.id)) { ids.add(record.id); changed = true; }
    }
  } while (changed);
  return records.filter(record => ids.has(record.id));
}

export async function sampleBrowserMemory(rootProcessId, phase) {
  if (process.platform !== 'win32') return { supported: false, phase, reason: 'Windows process counters are unavailable on this platform.' };
  if (!Number.isSafeInteger(rootProcessId) || rootProcessId < 1) throw new Error('A live isolated browser process ID is required.');
  const script = await readFile(new URL('./browser-memory.ps1', import.meta.url), 'utf8');
  const { stdout } = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `& {\n${script}\n} -RootProcessId ${rootProcessId}`],
    { windowsHide: true, timeout: 20_000, maxBuffer: 1_000_000 });
  return { ...JSON.parse(stdout.trim()), phase, supported: true };
}

export function summarizeMemory(samples) {
  const available = samples.filter(sample => sample.supported);
  if (!available.length) return { supported: false, samples };
  const peaks = new Map();
  const totals = available.map(sample => {
    const records = processTree(sample.processes, sample.rootProcessId);
    if (!records.some(record => record.id === sample.rootProcessId)) throw new Error('Browser root is missing from a memory snapshot; cannot report zero memory.');
    for (const record of records) {
      for (const key of ['workingSetBytes', 'privateBytes', 'peakWorkingSetBytes']) {
        if (!Number.isSafeInteger(record[key]) || record[key] < 0) throw new Error(`Invalid process memory counter: ${key}`);
      }
      const identity = `${record.id}:${record.startedAt}`;
      peaks.set(identity, Math.max(peaks.get(identity) ?? 0, record.peakWorkingSetBytes));
    }
    return { phase: sample.phase, startedAt: sample.startedAt, finishedAt: sample.finishedAt, processCount: records.length,
      workingSetBytes: records.reduce((sum, record) => sum + record.workingSetBytes, 0),
      privateBytes: records.reduce((sum, record) => sum + record.privateBytes, 0) };
  });
  return { supported: true, method: 'Windows .NET process counters for the isolated browser and descendants; snapshots at workflow phases.',
    maxSampledWorkingSetBytes: Math.max(...totals.map(sample => sample.workingSetBytes)),
    maxSampledPrivateBytes: Math.max(...totals.map(sample => sample.privateBytes)),
    sumObservedProcessPeakWorkingSetsBytes: [...peaks.values()].reduce((sum, value) => sum + value, 0),
    observedProcessCount: peaks.size, snapshots: totals,
    limitations: ['Working-set sums can count shared physical pages more than once.',
      'Summed per-process lifetime peaks are not a simultaneous browser peak.',
      'Subprocesses that start and exit entirely between snapshots can be missed; this is not an exact full-session peak.',
      'These are desktop headless measurements, not real mobile hardware or a memory guarantee.'] };
}

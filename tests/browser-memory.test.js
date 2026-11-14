import test from 'node:test';
import assert from 'node:assert/strict';
import { processTree, summarizeMemory } from '../scripts/browser-memory.js';

// Synthetic OS counters verify bookkeeping only; these are never benchmark results.
const record = (id, parentId, workingSetBytes, peakWorkingSetBytes, startedAt = 'TEST start') =>
  ({ id, parentId, workingSetBytes, peakWorkingSetBytes, privateBytes: workingSetBytes / 2, startedAt });
const sample = processes => ({ supported: true, rootProcessId: 10, phase: 'TEST', processes });

test('memory accounting includes descendants in any order and excludes unrelated user browsers', () => {
  const records = [record(12, 11, 20, 30), record(99, 1, 900, 1000), record(10, 1, 40, 60), record(11, 10, 10, 20)];
  assert.deepEqual(processTree(records, 10).map(process => process.id), [12, 10, 11]);
  const result = summarizeMemory([sample(records)]);
  assert.equal(result.maxSampledWorkingSetBytes, 70);
  assert.equal(result.maxSampledPrivateBytes, 35);
  assert.equal(result.sumObservedProcessPeakWorkingSetsBytes, 110);
});

test('lifetime peak bookkeeping retains observed exited processes and distinguishes reused process IDs', () => {
  const result = summarizeMemory([
    sample([record(10, 1, 40, 60), record(11, 10, 20, 30)]),
    sample([record(10, 1, 50, 70), record(11, 10, 10, 20, 'TEST new start')])
  ]);
  assert.equal(result.maxSampledWorkingSetBytes, 60);
  assert.equal(result.sumObservedProcessPeakWorkingSetsBytes, 120);
  assert.equal(result.observedProcessCount, 3);
});

test('unavailable or malformed memory evidence is never reported as zero usage', () => {
  assert.equal(summarizeMemory([{ supported: false }]).supported, false);
  assert.throws(() => summarizeMemory([sample([])]), /root is missing/);
  assert.throws(() => summarizeMemory([sample([record(10, 1, NaN, 1)])]), /Invalid process/);
});

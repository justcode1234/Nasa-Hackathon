#!/usr/bin/env python3
"""Iteration 49 census: the citation counts the ledger quotes, and the shipped rule's own readings.

Two jobs, one log. First, the numbers `docs/handoff-2026-11-18.md` cites for the wrap incident: how many archive
citations and file:line references the guard regexes find in prose read as-is versus read with every newline replaced
by a space. A join can only ADD matches, because no character class here contains a space, so each extra match is a
citation that spans a line break today and is invisible to every scanner. Second, the readings
`tests/documentation-reflow.test.js` was sized against - files, path-ended lines, resolving joins, doubled markers -
with the patterns and the walk constants parsed out of that file rather than retyped, so this probe cannot drift from
the guard it is describing.

Run it from the repository root (`python3 scripts/ledger-census.py`): the walk starts at `.` and the constants are read
from `tests/documentation-reflow.test.js` by relative path. Iteration 49 wrote it as `artifacts/iter49-census.py`,
inside the gitignored scratch directory, and iteration 60 moved it here because validation.md quotes its output.
"""
import os
import re
import sys

TEST = 'tests/documentation-reflow.test.js'
src = open(TEST, encoding='utf8').read()


def const_pattern(name):
    m = re.search(r'^const %s = /(.+)/;' % name, src, re.M)
    if not m:
        sys.exit('cannot parse %s out of %s' % (name, TEST))
    return re.compile(m.group(1))


def const_list(name):
    m = re.search(r'^const %s = new Set\(\[(.*?)\]\);' % name, src, re.M | re.S)
    if not m:
        sys.exit('cannot parse %s out of %s' % (name, TEST))
    return [t.strip().strip("'") for t in m.group(1).split(',') if t.strip()]


HEAD, TAIL, DOUBLED = (const_pattern(n) for n in ('HEAD', 'TAIL', 'DOUBLED'))
SKIP = set(const_list('SKIP_DIRS'))
EXTS = set(const_list('EXTS'))
CAP = int(re.search(r"^const CAP = (\d+) \* 1024;", src, re.M).group(1)) * 1024
LEDGER = const_pattern('LEDGER')

# The two scanners this census is quoting counts for, copied from the committed guards.
ARCHIVE = re.compile(r'docs/evidence/[A-Za-z0-9_.\-*/]+')
LINEREF = re.compile(r'([A-Za-z0-9_.\-/]{1,120}\.(?:js|mjs|cjs|css|py|sh)):(\d+)(?:-(\d+))?')

files = []
for root, dirs, names in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in SKIP]
    for n in names:
        rel = os.path.normpath(os.path.join(root, n))
        if os.path.splitext(n)[1] not in EXTS:
            continue
        if os.path.getsize(rel) <= CAP or LEDGER.search(rel):
            files.append(rel)
files.sort()

print('walk constants parsed from %s: %d skip dirs, %d extensions, cap %d KiB, ledger %s'
      % (TEST, len(SKIP), len(EXTS), CAP // 1024, LEDGER.pattern))
print('prose files in scope : %d' % len(files))

# Part one: line-boundary dependence of the two scanners.
tot = {'a_raw': 0, 'a_join': 0, 'r_raw': 0, 'r_join': 0}
extra_a, extra_r = [], []
for f in files:
    text = open(f, encoding='utf8', errors='ignore').read()
    flow = text.replace('\n', ' ')
    a_raw, a_join = ARCHIVE.findall(text), ARCHIVE.findall(flow)
    r_raw = [m[0] for m in LINEREF.findall(text)]
    r_join = [m[0] for m in LINEREF.findall(flow)]
    tot['a_raw'] += len(a_raw)
    tot['a_join'] += len(a_join)
    tot['r_raw'] += len(r_raw)
    tot['r_join'] += len(r_join)
    for m in a_join:
        if m not in a_raw:
            extra_a.append((f, m, os.path.exists(m)))
    for m in set(r_join) - set(r_raw):
        extra_r.append((f, m, os.path.exists(m)))

print()
print('archive citations    : read as-is %d, newline-joined %d' % (tot['a_raw'], tot['a_join']))
print('file:line references : read as-is %d, newline-joined %d' % (tot['r_raw'], tot['r_join']))
print('split archive citations (%d):' % len(extra_a))
for f, m, ok in extra_a[:20]:
    print('  %-46s %-70s resolves=%s' % (f, m, ok))
if not extra_a:
    print('  (none)')
print('split file:line references (%d):' % len(extra_r))
for f, m, ok in extra_r[:20]:
    print('  %-46s %-70s resolves=%s' % (f, m, ok))
if not extra_r:
    print('  (none)')

# Part two: what the shipped rule sees, using the shipped patterns.
heads = joins = doubled = 0
join_list, double_list = [], []
for f in files:
    lines = open(f, encoding='utf8', errors='ignore').read().split('\n')
    for i, line in enumerate(lines):
        if DOUBLED.search(line):
            doubled += 1
            double_list.append('%s:%d' % (f, i + 1))
        m = HEAD.search(line.rstrip())
        if not m:
            continue
        heads += 1
        nxt = lines[i + 1] if i + 1 < len(lines) else None
        if nxt is None:
            continue
        t = TAIL.search(nxt)
        if not t:
            continue
        joined = m.group(0).rstrip() + t.group(1)
        if os.path.exists(joined):
            joins += 1
            join_list.append('%s:%d -> %s' % (f, i + 1, joined))

print()
print('shipped rule, same patterns and same walk:')
print('  lines ending in a path-shaped token : %d' % heads)
print('  adjacent-line joins that resolve    : %d  %s' % (joins, join_list))
print('  lines with a doubled list marker    : %d  %s' % (doubled, double_list))

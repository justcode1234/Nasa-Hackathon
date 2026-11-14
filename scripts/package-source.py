"""Create a bounded, reproducible source ZIP without local caches or credentials."""
import hashlib
import json
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
out = root / 'public/submission'
out.mkdir(parents=True, exist_ok=True)
root_files = ['.gitattributes', '.gitignore', 'AGENTS.md', 'README.md', 'package.json', 'package-lock.json', 'vercel.json']
files = [root / name for name in root_files if (root / name).is_file()]
for folder in ['server', 'public', 'scripts', 'tests', 'models', 'notebooks', 'docs']:
    for path in (root / folder).rglob('*'):
        if not path.is_file() or path.is_symlink():
            continue
        relative = path.relative_to(root).as_posix()
        if any(part in ['__pycache__', '.ipynb_checkpoints', 'node_modules'] for part in path.parts):
            continue
        if relative.startswith('public/vendor/') or relative == 'public/js/lib/core-worker.bundle.js':
            continue
        if path.name in ['fieldshift-source.zip', 'source-manifest.json'] or path.name.startswith('.env'):
            continue
        files.append(path)
entries = {path.relative_to(root).as_posix(): path.read_bytes() for path in sorted(files)}
manifest = {'format': 1, 'project': 'FieldShift', 'notes': 'Source only; npm ci then npm run start. Build outputs, dependencies, local profiles, secrets and the archive itself are excluded.',
            'files': [{'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()} for name, data in entries.items()]}
manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + '\n').encode('utf-8')
(out / 'source-manifest.json').write_bytes(manifest_bytes)
entries['SOURCE-MANIFEST.json'] = manifest_bytes
target = out / 'fieldshift-source.zip'
with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in sorted(entries.items()):
        info = zipfile.ZipInfo(name, date_time=(2026, 11, 14, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, data)
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    for entry in manifest['files']:
        assert hashlib.sha256(archive.read(entry['path'])).hexdigest() == entry['sha256']
print(f'PASS: source ZIP contains {len(entries)} files; all hashes verified; {target.stat().st_size:,} bytes.')

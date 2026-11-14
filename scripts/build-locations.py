"""Build country-sized GeoNames place lists; no account or runtime third-party API."""
import hashlib
import io
import json
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
out = root / 'public/data/locations'
out.mkdir(parents=True, exist_ok=True)
inputs = []

def download(name):
    url = 'https://download.geonames.org/export/dump/' + name
    request = urllib.request.Request(url, headers={'User-Agent': 'FieldShift source-data preparation'})
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read()
        inputs.append({'url': url, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                       'lastModified': response.headers.get('Last-Modified')})
    return data

admin = {}
for line in download('admin1CodesASCII.txt').decode('utf-8').splitlines():
    fields = line.split('\t')
    if len(fields) >= 4:
        admin[fields[0]] = fields[1]

archive = download('cities5000.zip')
with zipfile.ZipFile(io.BytesIO(archive)) as source:
    lines = source.read('cities5000.txt').decode('utf-8').splitlines()
countries = {}
for line in lines:
    fields = line.split('\t')
    if len(fields) != 19:
        raise ValueError('GeoNames column schema changed')
    country, region = fields[8], fields[10]
    if len(country) != 2 or not country.isalpha():
        continue
    latitude, longitude = float(fields[4]), float(fields[5])
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        raise ValueError('Invalid source coordinate')
    countries.setdefault(country, []).append([int(fields[0]), fields[1], region, latitude, longitude, fields[18]])

manifest = {'schemaVersion': 1, 'source': {
    'id': 'geonames-places', 'title': 'GeoNames cities5000 and administrative-region names',
    'url': 'https://download.geonames.org/export/dump/readme.txt',
    'attributionUrl': 'https://www.geonames.org/', 'license': 'CC BY 4.0',
    'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
    'retrievedAt': datetime.now(timezone.utc).isoformat(),
    'coverage': 'Place-name extract: cities over 5,000 population or first-order administrative seats. Not every town, village or farm is included.',
    'inputs': inputs}, 'countries': {}}
for country, places in sorted(countries.items()):
    places.sort(key=lambda place: (place[1].casefold(), place[0]))
    regions = [{'id': code, 'name': admin.get(country + '.' + code)} for code in sorted({place[2] for place in places})]
    payload = {'schemaVersion': 1, 'country': country, 'regions': regions, 'places': places}
    data = (json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')
    (out / (country + '.json')).write_bytes(data)
    manifest['countries'][country] = {'places': len(places), 'regions': len(regions), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
print(f'PASS: {sum(len(places) for places in countries.values()):,} real place records across {len(countries)} countries/areas; source hashes and attribution retained.')

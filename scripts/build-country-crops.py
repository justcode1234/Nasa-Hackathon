"""Extract country crop records from public FAOSTAT QCL + UN M49 snapshots.

Development-only Python stdlib script. No runtime Python or FAO API is needed.
Download the two fixed source URLs into artifacts/ before running this script.
"""
import csv
import hashlib
import io
import json
import re
import zipfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BULK = 'https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_(Normalized).zip'
UN = 'https://unstats.un.org/unsd/methodology/m49/overview/'


class CountryTable(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.cells, self.cell = [], [], None

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.cells = []
        elif tag == 'td':
            self.cell = ''

    def handle_data(self, data):
        if self.cell is not None:
            self.cell += data

    def handle_endtag(self, tag):
        if tag == 'td' and self.cell is not None:
            self.cells.append(self.cell.strip())
            self.cell = None
        elif tag == 'tr' and len(self.cells) >= 12:
            if re.fullmatch(r'\d{3}', self.cells[9]) and re.fullmatch(r'[A-Z]{2}', self.cells[10]):
                self.rows.append((self.cells[9], self.cells[10]))


def main():
    archive_path = ROOT / 'artifacts/faostat-qcl.zip'
    un_path = ROOT / 'artifacts/un-m49.html'
    parser = CountryTable()
    parser.feed(un_path.read_text(encoding='utf-8'))
    iso = dict(parser.rows)
    assert iso['036'] == 'AU' and iso['826'] == 'GB'
    items, countries, latest = {}, {}, {}
    with zipfile.ZipFile(archive_path) as archive:
        filename = next(n for n in archive.namelist() if n.endswith('(Normalized).csv'))
        flags_file = next(n for n in archive.namelist() if n.endswith('_Flags.csv'))
        flags = {r['Flag']: r[' Description'] for r in csv.DictReader(io.TextIOWrapper(archive.open(flags_file), encoding='utf-8-sig'))}
        for row in csv.DictReader(io.TextIOWrapper(archive.open(filename), encoding='utf-8-sig')):
            year = int(row['Year'])
            if not 2020 <= year <= 2024 or row['Element Code'] != '5510':
                continue
            # CPC 01 = agriculture/horticulture primary products; excludes animals,
            # processed products and FAO aggregate items. Do not infer crops from trade.
            cpc = row['Item Code (CPC)'].lstrip("'")
            code = iso.get(row['Area Code (M49)'].lstrip("'"))
            if not code or not cpc.startswith('01') or row['Unit'] != 't':
                continue
            key = (code, row['Item Code'])
            if key not in latest or year > latest[key][1]:
                latest[key] = [row['Item Code'], year, float(row['Value']) if row['Value'] else None, row['Flag'], row['Note']]
                items[row['Item Code']] = {'name': row['Item'], 'cpc': cpc}
                countries.setdefault(code, {'name': row['Area'], 'm49': row['Area Code (M49)'].lstrip("'"), 'records': []})
    for (code, _), record in latest.items():
        if record[2] is not None and record[2] > 0:
            countries[code]['records'].append(record)
    for country in countries.values():
        country['records'].sort(key=lambda record: items[record[0]]['name'])
    used = {r[0] for c in countries.values() for r in c['records']}
    output = {
        'schemaVersion': 1,
        'source': {'id': 'faostat-qcl', 'title': 'FAOSTAT: Crops and livestock products (QCL)', 'url': 'https://www.fao.org/faostat/en/#data/QCL', 'bulkUrl': BULK,
                   'license': 'CC BY 4.0 + FAO Statistical Database Terms of Use', 'termsUrl': 'https://www.fao.org/contact-us/terms/db-terms-of-use/en/',
                   'citation': 'FAO. 2025. FAOSTAT: Crops and livestock products. Accessed 14 November 2026. https://www.fao.org/faostat/en/#data/QCL. Licence: CC-BY-4.0.',
                   'manifestUpdatedAt': '2025-12-31T00:00:00', 'retrievedAt': datetime.fromtimestamp(archive_path.stat().st_mtime, timezone.utc).isoformat(),
                   'archiveSha256': hashlib.sha256(archive_path.read_bytes()).hexdigest()},
        'countryCodes': {'sourceUrl': UN, 'sha256': hashlib.sha256(un_path.read_bytes()).hexdigest()},
        'selection': 'Latest production record per country/item in 2020–2024; retain positive tonnes only. CPC 01 primary crops only. Record tuple: item code, year, tonnes, flag, note.',
        'flags': flags, 'items': {k: items[k] for k in sorted(used)}, 'countries': dict(sorted(countries.items()))
    }
    target = ROOT / 'server/context/country-crops.json'
    target.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'Extracted {sum(len(c["records"]) for c in countries.values())} crop records across {len(countries)} countries/areas; {target.stat().st_size} bytes.')


if __name__ == '__main__':
    main()

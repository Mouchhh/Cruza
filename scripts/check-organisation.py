#!/usr/bin/env python3
"""Check organization records and SQL bundle provenance without network access."""
from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[1]
registry=json.loads((ROOT/'pilotage/environnements.json').read_text())
ids=[x['id'] for x in registry['instances']]
assert len(ids)==len(set(ids)) and {'smfc-production','demo','preproduction','club-pilote','vitrine'}<=set(ids)
plan=json.loads((ROOT/'pilotage/03-technique/depots-prepares.json').read_text())
assert plan['apply'] is False and len(plan['repositories'])==3
assert all(x['private'] is True for x in plan['repositories'])
manifest=json.loads((ROOT/'supabase/installations/sources.json').read_text())
for item in manifest['migrations']:
 assert hashlib.sha256((ROOT/'supabase'/item['file']).read_bytes()).hexdigest()==item['sha256'],item['file']
for f in (ROOT/'pilotage').rglob('*.md'):
 for link in re.findall(r'\]\(([^)]+)\)',f.read_text()):
  if '://' in link or link.startswith('#'):continue
  assert (f.parent/link.split('#')[0]).exists(),(str(f),link)
assert not list((ROOT/'pilotage').rglob('*.dump'))
print('PASS: environment registry, private-repository plan, migration hashes and documentation links.')

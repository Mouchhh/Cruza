#!/usr/bin/env python3
"""Build the new-project SQL bundle from canonical migrations; never contacts a database."""
from pathlib import Path
import hashlib,json,re
ROOT=Path(__file__).resolve().parents[1]
MIGRATIONS=['club.sql','club-accounts.sql','club-presence.sql','club-references.sql','club-management.sql','club-management-statistics.sql']
PREAMBLE='''-- CRUZA — initialisation d’un projet Supabase NEUF uniquement.
-- Généré depuis les migrations du dépôt. Aucun compte ni droit nominatif créé.
-- Refuse les projets déjà utilisés. Ne pas exécuter sur le SMFC existant.
begin;
do $preflight$
begin
 if to_regclass('auth.users') is null then
  raise exception 'Projet Supabase attendu : schéma Auth absent';
 end if;
 if to_regclass('public.club_members') is not null or to_regclass('public.club_documents') is not null then
  raise exception 'Initialisation refusée : une installation applicative existe déjà. Ne supprimez aucune table.';
 end if;
 if exists(select 1 from auth.users) then
  raise exception 'Initialisation refusée : ce projet contient déjà des comptes Auth.';
 end if;
end;
$preflight$;
'''
def build():
 text=PREAMBLE;manifest=[]
 for name in MIGRATIONS:
  raw=(ROOT/'supabase'/name).read_text()
  manifest.append({'file':name,'sha256':hashlib.sha256(raw.encode()).hexdigest()})
  body=re.sub(r'(?im)^\s*(?:begin|commit);\s*$','',raw)
  text+='\n-- SOURCE : '+name+'\n'+body+'\n'
 text+='\ncommit;\n'
 dest=ROOT/'supabase/installations';dest.mkdir(exist_ok=True)
 (dest/'club-pilote-initialisation.sql').write_text(text)
 (dest/'sources.json').write_text(json.dumps({'scope':'projet neuf seulement','migrations':manifest},ensure_ascii=False,indent=2)+'\n')
 return text
if __name__=='__main__':build();print('Lot SQL neuf généré. Aucun projet distant modifié.')

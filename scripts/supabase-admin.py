#!/usr/bin/env python3
"""Explicit admin inventory or guarded fresh-project SQL install. Never creates paid projects."""
import argparse,json,os,re,urllib.request,urllib.error
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--install-new-project',metavar='REF');p.add_argument('--confirm-ref');p.add_argument('--output',type=Path);a=p.parse_args()
if a.install_new_project and (not re.fullmatch('[a-z0-9]{20}',a.install_new_project) or a.confirm_ref!=a.install_new_project):p.error('Confirmer exactement la référence du projet neuf avec --confirm-ref.')
if a.install_new_project=='uesbqljrcaugwcbzijcj':p.error('Le projet SMFC est protégé : le lot neuf ne peut pas lui être appliqué.')
token=os.environ.get('SUPABASE_ACCESS_TOKEN')
if not token:raise SystemExit('Accès administrateur Supabase non connecté. Renseigner SUPABASE_ACCESS_TOKEN dans un environnement privé, jamais dans le chat ou le dépôt.')
def api(path,body=None):
 req=urllib.request.Request('https://api.supabase.com/v1'+path,data=json.dumps(body).encode() if body else None,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json','User-Agent':'CRUZA-admin'})
 try:
  with urllib.request.urlopen(req,timeout=45) as r:return json.load(r)
 except urllib.error.HTTPError as e:raise SystemExit('Supabase : requête refusée (HTTP '+str(e.code)+'). Aucun secret affiché.') from None
 except urllib.error.URLError:raise SystemExit('Supabase : API inaccessible. Vérifier le réseau et la connexion administrateur.') from None
projects=api('/projects');public=[{k:x.get(k) for k in ['id','name','region','status','created_at']} for x in projects]
if a.install_new_project:
 if not any(x['id']==a.install_new_project for x in public):raise SystemExit('Projet absent du compte connecté.')
 query=(Path(__file__).resolve().parents[1]/'supabase/installations/club-pilote-initialisation.sql').read_text()
 api('/projects/'+a.install_new_project+'/database/query',{'query':query})
 print('Lot exécuté sur le projet neuf confirmé. Réaliser la recette Auth et droits avant ouverture.')
else:
 result=json.dumps({'projects':public,'database_schema_verified':False},ensure_ascii=False,indent=2)
 if a.output:
  a.output.parent.mkdir(parents=True,exist_ok=True);fd=os.open(a.output,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
  with os.fdopen(fd,'w') as f:f.write(result+'\n')
  print('Inventaire enregistré dans le fichier privé demandé.')
 else:print(result)

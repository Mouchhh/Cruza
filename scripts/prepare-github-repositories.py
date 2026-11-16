#!/usr/bin/env python3
"""Create the three PRIVATE repositories only with an authenticated GitHub admin.
Default is a plan. Does not create an organization, transfer, delete, or migrate SMFC.
"""
import argparse,json,os,urllib.request,urllib.error
REPOS={'cruza-app':'Application CRUZA, configurations et tests', 'cruza-vitrine':'Présentation publique de CRUZA', 'cruza-organisation':'Pilotage et procédures CRUZA'}
p=argparse.ArgumentParser();p.add_argument('--owner',required=True);p.add_argument('--apply',action='store_true');a=p.parse_args()
if not a.owner.replace('-','').isalnum():p.error('Nom de propriétaire GitHub invalide.')
plan={'owner':a.owner,'repositories':[{'name':n,'private':True,'description':d} for n,d in REPOS.items()],'apply':a.apply}
if not a.apply:print(json.dumps(plan,ensure_ascii=False,indent=2));raise SystemExit(0)
token=os.environ.get('GH_TOKEN') or os.environ.get('GITHUB_TOKEN')
if not token:raise SystemExit('Connexion GitHub administrateur absente. Ne pas envoyer le jeton dans une conversation.')
def api(path,method='GET',body=None):
 req=urllib.request.Request('https://api.github.com'+path,method=method,data=json.dumps(body).encode() if body else None,headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'CRUZA-admin'})
 try:
  with urllib.request.urlopen(req,timeout=30) as r:return json.load(r)
 except urllib.error.HTTPError as e:
  if e.code==404 and method=='GET':return None
  raise SystemExit('GitHub : requête refusée (HTTP '+str(e.code)+'). Aucun secret affiché.') from None
 except urllib.error.URLError:raise SystemExit('GitHub : connexion API impossible. Vérifier le réseau et la connexion administrateur.') from None
me=api('/user');owner=api('/users/'+a.owner)
if not owner:raise SystemExit('Propriétaire inexistant. Une organisation doit être créée dans GitHub avant ce script.')
if owner['type']!='Organization' and owner['login'].lower()!=me['login'].lower():raise SystemExit('Le propriétaire doit être votre compte ou une organisation administrée.')
for name,desc in REPOS.items():
 existing=api('/repos/'+a.owner+'/'+name)
 if existing:
  if not existing['private']:raise SystemExit(name+' existe en public : changement de visibilité non effectué automatiquement.')
  print(name+' : dépôt privé déjà existant, conservé.');continue
 path='/orgs/'+a.owner+'/repos' if owner['type']=='Organization' else '/user/repos'
 result=api(path,'POST',{'name':name,'description':desc,'private':True,'auto_init':False})
 print('Créé : '+result['html_url']+' (privé, vide).')
print('Aucun fichier du SMFC déplacé. Importer les sources, puis configurer main et les protections.')

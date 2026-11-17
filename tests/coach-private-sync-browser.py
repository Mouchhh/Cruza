from playwright.sync_api import sync_playwright
import json,copy
from urllib.parse import urlparse,parse_qs
A='00000000-0000-4000-8000-000000000001';B='00000000-0000-4000-8000-000000000002'
records={};offline=False
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 def device(owner):
  page=browser.new_page(service_workers='block')
  page.add_init_script("localStorage.setItem('vestiaire-coach-profiles',JSON.stringify([{id:'account-"+owner+"',name:'Coach Test'}]));localStorage.setItem('vestiaire-active-coach','account-"+owner+"');")
  def api(route):
   global offline
   req=route.request;user=req.headers.get('authorization','').replace('Bearer fake-','')
   if 'coach_private' not in req.url:route.fulfill(json=[]);return
   if offline:route.fulfill(status=503,json={'message':'offline'});return
   if req.method=='GET':
    q=parse_qs(urlparse(req.url).query);kind=q.get('kind',[''])[0].removeprefix('eq.');record_key=q.get('record_key',[''])[0].removeprefix('eq.')
    route.fulfill(json=[copy.deepcopy(r) for (o,k,key),r in records.items() if o==user and (not kind or k==kind) and (not record_key or key==record_key)]);return
   body=req.post_data_json
   if body['p_owner_id']!=user:route.fulfill(status=403,json={'code':'42501'});return
   key=(user,body['p_kind'],body['p_key']);old=records.get(key)
   if (old['revision'] if old else 0)!=body['p_expected_revision']:route.fulfill(status=409,json={'code':'40001'});return
   row={'owner_id':user,'kind':key[1],'record_key':key[2],'payload':body['p_payload'],'revision':(old['revision'] if old else 0)+1,'deleted':body['p_deleted']};records[key]=row;route.fulfill(json=row)
  page.route('**/rest/v1/**',api)
  page.goto('http://127.0.0.1:3113/index.html?mode=local')
  page.wait_for_function('window.coachPrivateSync && window.clubPhotoLibrary')
  page.evaluate("owner=>{clubNetworkSession={user:{id:owner},access_token:'fake-'+owner,expires_at:9999999999};clubNetworkMember={user_id:owner,display_name:'Coach Test',active:true};}",owner)
  return page
 one=device(A)
 one.evaluate("()=>{coachAccountSaveSection('profile',{...coachAccountDefaults().profile,firstName:'Alice',lastName:'Coach',phone:'0102030405'});coachStorageSet(coachClubDetailsKey,JSON.stringify({...coachClubDetailsDefaults(),name:'Club privé test'}));}")
 one.evaluate("async()=>{const c=document.createElement('canvas');c.width=c.height=12;const blob=await new Promise(r=>c.toBlob(r,'image/jpeg'));await clubPhotoLibrary.add([new File([blob],'Terrain.jpg',{type:'image/jpeg'})]);coachPrivateSync.sync();}")
 one.wait_for_function("coachPrivateSync.getState().phase==='saved'")
 assert len(records)==3,records
 photo=next(r for r in records.values() if r['kind']=='photo');photo_id=photo['record_key']
 two=device(A);two.evaluate('coachPrivateSync.sync()');two.wait_for_function("coachPrivateSync.getState().phase==='saved'")
 assert two.evaluate('coachAccountRead().profile.firstName')=='Alice'
 assert two.evaluate('coachClubDetailsRead().name')=='Club privé test'
 assert two.evaluate('clubPhotoLibrary.cached().length')==1
 assert two.evaluate('clubPhotoLibrary.cached()[0].name')=='Terrain'
 other=device(B);other.evaluate('coachPrivateSync.sync()');other.wait_for_function("coachPrivateSync.getState().phase==='saved'")
 assert other.evaluate('coachAccountRead().profile.firstName')==''
 assert other.evaluate('clubPhotoLibrary.cached().length')==0
 # Offline changes survive, and two devices cannot silently overwrite each other.
 offline=True
 one.evaluate("coachAccountSaveSection('profile',{...coachAccountRead().profile,phone:'LOCAL-OFFLINE'})")
 one.wait_for_function("coachPrivateSync.getState().phase==='error'")
 assert one.evaluate('coachAccountRead().profile.phone')=='LOCAL-OFFLINE'
 offline=False
 two.evaluate("coachAccountSaveSection('profile',{...coachAccountRead().profile,phone:'REMOTE'})")
 two.wait_for_function("coachPrivateSync.getState().phase==='saved'")
 one.evaluate('coachPrivateSync.sync()');one.wait_for_function("coachPrivateSync.getState().phase==='conflict'")
 assert one.evaluate('coachAccountRead().profile.phone')=='LOCAL-OFFLINE'
 assert records[(A,'settings','profile')]['payload']['phone']=='REMOTE'
 one.evaluate('coachPrivateSync.openConflicts()');one.get_by_role('button',name='Récupérer les données du compte',exact=True).click()
 one.wait_for_function("coachAccountRead().profile.phone==='REMOTE'")
 # Deletion propagates to another device without deleting the source's unrelated files.
 one.evaluate('(id)=>clubPhotoLibrary.remove(id)',photo_id);one.wait_for_function("coachPrivateSync.getState().phase==='saved'")
 two.evaluate('coachPrivateSync.sync()');two.wait_for_function("clubPhotoLibrary.cached().length===0")
 assert records[(A,'photo',photo_id)]['deleted'] is True
 # A database not yet activated must preserve local data and show a clear setup state.
 other.route('**/rest/v1/coach_private_records?*',lambda r:r.fulfill(status=404,json={'code':'PGRST205','message':'not installed'}))
 other.evaluate("coachAccountSaveSection('profile',{...coachAccountRead().profile,firstName:'Bob local'})")
 other.wait_for_function("coachPrivateSync.getState().phase==='setup'")
 assert other.evaluate('coachAccountRead().profile.firstName')=='Bob local'
 other.unroute('**/rest/v1/coach_private_records?*');other.evaluate('coachPrivateSync.sync()');other.wait_for_function("coachPrivateSync.getState().phase==='saved'")
 assert records[(B,'settings','profile')]['payload']['firstName']=='Bob local'
 browser.close()
print('PASS: two devices restore profile/club/photos; account isolation; offline preservation; conflict protection/resolution; photo deletion sync')

// Personal account records. These never enter the club's shared document library.
(() => {
 const KEY='vestiaire-private-sync',conflicts=new Map();
 let running=null,timer=null,rerun=false,status='Données personnelles conservées sur cet appareil.',phase='local';
 const context=()=>typeof clubNetworkBound==='function'&&clubNetworkBound()&&clubNetworkSession?.user?.id?{owner:clubNetworkSession.user.id,generation:clubNetworkGeneration}:null;
 const current=c=>{const n=context();return !!n&&n.owner===c.owner&&n.generation===c.generation;};
 const validKey=(kind,key)=>kind==='settings'?['profile','club'].includes(key):kind==='photo'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(key);
 function journal(){const raw=coachStorageGet(KEY);if(!raw)return {};const v=JSON.parse(raw);if(v?.version!==1||!v.entries||typeof v.entries!=='object'||Array.isArray(v.entries))throw Error('État de synchronisation personnelle illisible.');return v.entries;}
 function saveJournal(entries){coachStorageSet(KEY,JSON.stringify({version:1,entries}));}
 function canonical(v){return Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;}
 async function hash(payload,deleted=false){const bytes=new TextEncoder().encode(JSON.stringify(canonical({payload,deleted})));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
 function notify(next,text){phase=next;status=text;document.dispatchEvent(new CustomEvent('coach-private-sync-state'));paintStatus();}
 function localSettings(key){
  if(key==='profile'){const raw=coachStorageGet(coachAccountKey);if(!raw)return null;const v=JSON.parse(raw);if(!coachAccountValid(v))throw Error('Profil local invalide.');return v.profile;}
  const raw=coachStorageGet(coachClubDetailsKey);if(!raw)return null;const v=JSON.parse(raw);if(!coachClubDetailsValid(v))throw Error('Fiche club locale invalide.');return v;
 }
 async function localPayload(kind,key){if(kind==='settings')return localSettings(key);const rows=await clubPhotoLibrary.list(),r=rows.find(p=>p.id===key);return r?{name:r.name,data:r.data,createdAt:r.createdAt}:null;}
 function validPayload(kind,key,payload){
  if(kind==='photo')return payload&&typeof payload.name==='string'&&payload.name.length>0&&payload.name.length<=60&&typeof payload.data==='string'&&payload.data.length<=1950000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(payload.data)&&Number.isFinite(Date.parse(payload.createdAt));
  return key==='profile'?coachAccountValid({...coachAccountDefaults(),profile:payload}):coachClubDetailsValid(payload);
 }
 async function apply(kind,key,payload,deleted,c){
  if(!current(c))return;
  if(!deleted&&!validPayload(kind,key,payload))throw Error('Données personnelles du compte invalides.');
  if(kind==='photo'){await clubPhotoLibrary.applyRemote(key,payload,deleted);return;}
  if(deleted)return; // Settings are never erased implicitly.
  if(key==='profile'){const value={...coachAccountRead(),profile:payload};coachStorageSet(coachAccountKey,JSON.stringify(value));coachAccountApply();renderClubHomeStats();}
  else{coachStorageSet(coachClubDetailsKey,JSON.stringify(payload));window.clubTheme?.apply(payload);window.clubNameRefresh?.();}
 }
 function checkRow(row,c,kind,key){return row&&row.owner_id===c.owner&&row.kind===kind&&row.record_key===key&&Number.isInteger(row.revision)&&row.revision>0&&typeof row.deleted==='boolean';}
 async function remoteRow(c,kind,key){const query=new URLSearchParams({select:'*',owner_id:'eq.'+c.owner,kind:'eq.'+kind,record_key:'eq.'+key,limit:'1'});const rows=await clubNetworkRequest('/rest/v1/coach_private_records?'+query);if(!current(c))throw Error('Session terminée.');const r=rows?.[0];if(!checkRow(r,c,kind,key))throw Error('Données personnelles incompatibles.');return r;}
 function remember(kind,key,row,digest,stillPending=false){const entries=journal(),old=entries[kind+':'+key]||{};entries[kind+':'+key]={revision:row.revision,hash:digest,deleted:stillPending?!!old.deleted:row.deleted,pending:stillPending};saveJournal(entries);}
 async function write(c,kind,key,payload,deleted,expected){
  if(!current(c))throw Error('Session terminée.');if(!deleted&&!validPayload(kind,key,payload))throw Error(kind==='photo'?'Une photo locale dépasse la taille synchronisable. Elle reste sur cet appareil.':'Réglages invalides.');
  const result=await clubNetworkRequest('/rest/v1/rpc/coach_private_write',{method:'POST',body:{p_owner_id:c.owner,p_kind:kind,p_key:key,p_payload:deleted?{}:payload,p_deleted:deleted,p_expected_revision:expected}});
  if(!current(c))throw Error('Session terminée.');const row=Array.isArray(result)?result[0]:result;if(!checkRow(row,c,kind,key))throw Error('Enregistrement personnel non confirmé.');return row;
 }
 async function syncRecord(c,kind,key,meta){
  const id=kind+':'+key,base=journal()[id],local=await localPayload(kind,key),deleted=!!base?.pending&&!!base.deleted;
  if(!current(c))return;
  const digest=await hash(local,deleted),changed=!!base?.pending||!!local&&(!base||base.hash!==digest);
  if(!meta){
   if(!local||deleted)return;
   const row=await write(c,kind,key,local,false,0);
   const now=await localPayload(kind,key);if(current(c)){const changedAgain=JSON.stringify(now)!==JSON.stringify(local);remember(kind,key,row,await hash(local),changedAgain);if(changedAgain)rerun=true;}
   return;
  }
  if(base?.revision===meta.revision&&!changed)return;
  if(!changed&&base?.revision===meta.revision)return;
  if(changed&&base?.revision===meta.revision){
   const row=await write(c,kind,key,local,deleted,meta.revision),now=await localPayload(kind,key);
   if(current(c)){const changedAgain=JSON.stringify(now)!==JSON.stringify(local);remember(kind,key,row,await hash(local,deleted),changedAgain);if(changedAgain)rerun=true;}
   return;
  }
  const remote=await remoteRow(c,kind,key),remoteHash=await hash(remote.deleted?null:remote.payload,remote.deleted),latest=await localPayload(kind,key);
  if(!current(c)||JSON.stringify(latest)!==JSON.stringify(local)){rerun=true;return;}
  if(digest===remoteHash){remember(kind,key,remote,remoteHash);conflicts.delete(id);return;}
  if((changed&&local)||deleted){conflicts.set(id,{kind,key,remote});return;}
  if(kind==='settings'&&document.getElementById('coach-account-dialog')?.open)return; // Never replace an open, unsaved settings form.
  await apply(kind,key,remote.payload,remote.deleted,c);if(current(c))remember(kind,key,remote,remoteHash);
 }
 async function run(){
  const c=context();if(!c){notify('local','Connectez-vous au club pour synchroniser vos informations personnelles.');return;}
  notify('pending','Synchronisation privée du profil et des photos…');
  try{
   const metadata=[];
   for(let offset=0;offset<10000;offset+=100){const q=new URLSearchParams({select:'owner_id,kind,record_key,revision,deleted',owner_id:'eq.'+c.owner,order:'kind.asc,record_key.asc',limit:'100',offset:String(offset)});const rows=await clubNetworkRequest('/rest/v1/coach_private_records?'+q);if(!current(c))return;if(!Array.isArray(rows)||rows.some(r=>!validKey(r.kind,r.record_key)||!checkRow(r,c,r.kind,r.record_key)))throw Error('Liste personnelle incompatible.');metadata.push(...rows);if(rows.length<100)break;if(offset===9900)throw Error('Historique personnel trop volumineux.');}
   const all=new Map(metadata.map(r=>[r.kind+':'+r.record_key,r]));
   for(const key of ['profile','club'])if(localSettings(key)&&!all.has('settings:'+key))all.set('settings:'+key,null);
   for(const row of await clubPhotoLibrary.list())if(validKey('photo',row.id)&&!all.has('photo:'+row.id))all.set('photo:'+row.id,null);
   for(const id of Object.keys(journal())){const split=id.indexOf(':'),kind=id.slice(0,split),key=id.slice(split+1);if(validKey(kind,key)&&!all.has(id))all.set(id,null);}
   for(const [id,meta] of all){if(!current(c))return;const split=id.indexOf(':'),kind=id.slice(0,split),key=id.slice(split+1);await syncRecord(c,kind,key,meta);}
   if(current(c))notify(conflicts.size?'conflict':'saved',conflicts.size?'Des informations diffèrent sur deux appareils. Vos données locales sont conservées.':'Profil et photos synchronisés avec votre compte privé.');
  }catch(error){
   if(!current(c))return;
   const missing=['42P01','PGRST202','PGRST205'].includes(error.code)||error.status===404;
   notify(missing?'setup':'error',missing?'Synchronisation personnelle à activer dans Supabase. Vos données restent sur cet appareil.':'Synchronisation personnelle non terminée. Vos données locales sont conservées. Réessayez.');
  }
 }
 function schedule(force=false){clearTimeout(timer);if(running){rerun=true;return running;}timer=setTimeout(()=>{running=run().finally(()=>{running=null;if(rerun){rerun=false;schedule();}});},force?0:1000);}
 async function resolveConflict(id,useRemote){
  const conflict=conflicts.get(id),c=context();if(!c||!conflict)return;
  const {kind,key}=conflict,remote=await remoteRow(c,kind,key),local=await localPayload(kind,key);
  if(!current(c))return;
  if(useRemote){
   // IndexedDB backup is independent of the quota-sensitive document localStorage.
   await backup(c,id,local);
   await apply(kind,key,remote.payload,remote.deleted,c);remember(kind,key,remote,await hash(remote.deleted?null:remote.payload,remote.deleted));
  }else{
   const deleted=local===null,row=await write(c,kind,key,local,deleted,remote.revision);remember(kind,key,row,await hash(local,deleted));
  }
  conflicts.delete(id);notify(conflicts.size?'conflict':'saved',conflicts.size?'Il reste des différences à résoudre.':'Données personnelles synchronisées.');
 }
 async function backup(c,id,payload){
  const request=indexedDB.open('cruza-private-sync-backups',1);
  await new Promise((resolve,reject)=>{request.onupgradeneeded=()=>request.result.createObjectStore('copies',{keyPath:'id'});request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,t=db.transaction('copies','readwrite');t.objectStore('copies').put({id:c.owner+':'+id+':'+crypto.randomUUID(),owner:c.owner,record:id,payload,at:new Date().toISOString()});t.oncomplete=()=>{db.close();resolve();};t.onerror=()=>{db.close();reject(t.error);};};});
 }
 function openConflicts(){
  if(!context())return;
  document.querySelector('.coach-private-conflicts')?.remove();const d=el('dialog','coach-account-dialog coach-private-conflicts');d.append(el('h2','','Informations personnelles à rapprocher'),el('p','','Choisissez pour chaque différence. Une copie locale est conservée avant de récupérer la version du compte.'));
  for(const [id,item] of conflicts){const row=el('section','report-panel'),title=item.kind==='photo'?'Photo · '+(item.remote.payload.name||'photo'):item.key==='profile'?'Votre profil':'Votre fiche club';row.append(el('h3','',title));
   const exportLocal=el('button','export','Télécharger ma copie locale');exportLocal.type='button';exportLocal.onclick=async()=>{const c=context();if(!c)return;const payload=await localPayload(item.kind,item.key);if(!current(c))return;const url=URL.createObjectURL(new Blob([JSON.stringify({kind:item.kind,key:item.key,payload},null,2)],{type:'application/json'})),link=el('a');link.href=url;link.download='CRUZA-copie-personnelle.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};row.append(exportLocal);

   for(const [label,remote] of [['Garder les données de cet appareil',false],['Récupérer les données du compte',true]]){const button=el('button','export',label);button.type='button';button.onclick=async()=>{button.disabled=true;try{await resolveConflict(id,remote);d.close();openConflicts();}catch{notify('error','Différence non résolue. Vos données sont conservées.');button.disabled=false;}};row.append(button);}d.append(row);}
  const close=el('button','export','Fermer');close.onclick=()=>d.close();d.append(close);d.addEventListener('close',()=>d.remove());document.body.append(d);d.showModal();
 }
 function paintStatus(){
  const dialog=document.getElementById('coach-account-dialog');if(!dialog)return;
  let box=dialog.querySelector('.coach-private-sync-status');if(!box){box=el('section','report-panel coach-private-sync-status');const text=el('p','hint'),retry=el('button','export','Synchroniser mon profil et mes photos'),compare=el('button','export','Voir les différences');text.setAttribute('role','status');retry.type=compare.type='button';retry.onclick=()=>schedule(true);compare.onclick=openConflicts;box.append(text,retry,compare);dialog.querySelector('.account-heading')?.after(box);}
  box.querySelector('p').textContent=status;box.querySelectorAll('button')[0].disabled=phase==='pending';box.querySelectorAll('button')[1].hidden=!conflicts.size;
 }
 document.addEventListener('coach-private-changed',event=>{if(!context())return;const {kind,key,deleted=false}=event.detail||{};if(!validKey(kind,key))return;try{const entries=journal();entries[kind+':'+key]={...entries[kind+':'+key],pending:true,deleted};saveJournal(entries);notify('pending','Modifications personnelles conservées, synchronisation en attente…');schedule();}catch{notify('error','Sauvegarde personnelle en attente : stockage local indisponible.');}});
 document.addEventListener('club-session-ready',()=>schedule(true));window.addEventListener('online',()=>schedule(true));window.addEventListener('focus',()=>{if(phase!=='setup')schedule();});
 document.addEventListener('close',event=>{if(event.target?.id==='coach-account-dialog')schedule();},true);
 document.addEventListener('DOMContentLoaded',()=>{new MutationObserver(paintStatus).observe(document.body,{childList:true});if(context())schedule(true);setInterval(()=>{if(!document.hidden&&phase!=='setup'&&!document.getElementById('coach-account-dialog')?.open)schedule();},60000);});
 window.coachPrivateSync={sync:()=>schedule(true),getState:()=>({phase,status,conflicts:conflicts.size}),openConflicts};
})();

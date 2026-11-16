// Visual preview only. Every app storage operation is namespaced, including enumeration/clear.
(() => {
 'use strict';
 const prefix='smfc-style-preview-v1:';
 function scoped(storage){
  const keys=()=>{const result=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k?.startsWith(prefix))result.push(k.slice(prefix.length));}return result;};
  const methods={getItem:key=>storage.getItem(prefix+String(key)),setItem:(key,value)=>storage.setItem(prefix+String(key),String(value)),removeItem:key=>storage.removeItem(prefix+String(key)),clear:()=>{for(const k of keys())storage.removeItem(prefix+k);},key:i=>keys()[Number(i)]??null};
  return new Proxy(Object.create(null),{get:(_,key)=>key==='length'?keys().length:typeof key==='string'&&key in methods?methods[key]:typeof key==='string'?methods.getItem(key):undefined,set:(_,key,value)=>{methods.setItem(key,value);return true;},ownKeys:()=>keys(),getOwnPropertyDescriptor:(_,key)=>keys().includes(key)?{configurable:true,enumerable:true,writable:true,value:methods.getItem(key)}:undefined,deleteProperty:(_,key)=>{methods.removeItem(key);return true;}});
 }
 window.cruzaDemoLocalStorage=scoped(window.localStorage);
 window.cruzaDemoSessionStorage=scoped(window.sessionStorage);
 const u=new URL(location.href);
 if(u.pathname.endsWith('/index.html')||u.pathname.endsWith('/')){
  if(u.searchParams.get('mode')!=='local'){u.searchParams.set('mode','local');location.replace(u.href);}
 }
 try{
  if(!cruzaDemoLocalStorage.getItem('vestiaire-coach-profiles'))cruzaDemoLocalStorage.setItem('vestiaire-coach-profiles',JSON.stringify([{id:'legacy',name:'Coach Démo'}]));
 }catch{/* Existing app storage warnings remain visible if persistence is unavailable. */}
 document.addEventListener('DOMContentLoaded',()=>{
  const note=document.createElement('aside');note.id='visual-preview-banner';note.setAttribute('aria-label','Commandes de l’aperçu');
  const text=document.createElement('div');text.innerHTML='<strong>Aperçu du nouveau style</strong><small>Données d’exemple · essais locaux</small>';
  const reset=document.createElement('button');reset.type='button';reset.textContent='Repartir du début';
  reset.onclick=()=>{if(!confirm('Réinitialiser uniquement les essais de cet aperçu ? Le vrai site et vos documents du club restent conservés.'))return;try{cruzaDemoLocalStorage.clear();cruzaDemoSessionStorage.clear();location.href='./index.html?mode=local';}catch{alert('Réinitialisation impossible : vérifiez le stockage du navigateur.');}};
  note.append(text,reset);document.body.append(note);
 });
})();

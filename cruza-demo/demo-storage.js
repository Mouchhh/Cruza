// Demo-only logical storage namespace; no access to the existing club's stored values.
(() => {
 'use strict';
 const prefix='cruza-public-demo-v1:';
 function scoped(storage){
  const keys=()=>{const result=[];for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k?.startsWith(prefix))result.push(k.slice(prefix.length));}return result;};
  const methods={getItem:key=>storage.getItem(prefix+String(key)),setItem:(key,value)=>storage.setItem(prefix+String(key),String(value)),removeItem:key=>storage.removeItem(prefix+String(key)),clear:()=>{for(const k of keys())storage.removeItem(prefix+k);},key:i=>keys()[Number(i)]??null};
  return new Proxy(Object.create(null),{get:(_,key)=>key==='length'?keys().length:typeof key==='string'&&key in methods?methods[key]:typeof key==='string'?methods.getItem(key):undefined,set:(_,key,value)=>{methods.setItem(key,value);return true;},ownKeys:()=>keys(),getOwnPropertyDescriptor:(_,key)=>keys().includes(key)?{configurable:true,enumerable:true,writable:true,value:methods.getItem(key)}:undefined,deleteProperty:(_,key)=>{methods.removeItem(key);return true;}});
 }
 window.cruzaDemoLocalStorage=scoped(window.localStorage);
 window.cruzaDemoSessionStorage=scoped(window.sessionStorage);
 // The demonstration always opens without a private club account.
 if(location.pathname.endsWith('/index.html')||location.pathname.endsWith('/')){
  const u=new URL(location.href);if(u.searchParams.get('mode')!=='local'){u.searchParams.set('mode','local');location.replace(u.href);}
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const note=document.createElement('div');note.textContent='CRUZA · Démonstration vierge · Vos essais restent dans ce navigateur';note.style.cssText='position:fixed;bottom:6px;left:50%;transform:translateX(-50%);max-width:90vw;padding:6px 12px;border-radius:8px;background:#071c55;color:#fff;font:10px system-ui;z-index:9999;pointer-events:none;text-align:center';document.body.append(note);
 });
})();

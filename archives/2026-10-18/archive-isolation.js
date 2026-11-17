/* Historical UI, deliberately disconnected from current accounts and documents. */
(() => {
  'use strict';
  const prefix = 'cruza-archive-2026-10-18:';
  function scopedStorage(storage) {
    const keys = () => Array.from({length:storage.length}, (_,i)=>storage.key(i)).filter(key=>key?.startsWith(prefix));
    return Object.freeze({
      getItem: key => storage.getItem(prefix+String(key)),
      setItem: (key,value) => storage.setItem(prefix+String(key),String(value)),
      removeItem: key => storage.removeItem(prefix+String(key)),
      clear: () => keys().forEach(key=>storage.removeItem(key)),
      key: index => keys()[index]?.slice(prefix.length) ?? null,
      get length() { return keys().length; }
    });
  }
  for (const name of ['localStorage','sessionStorage']) {
    try { Object.defineProperty(window,name,{value:scopedStorage(window[name]),configurable:false}); }
    catch {
      const memory = new Map();
      Object.defineProperty(window,name,{value:{getItem:key=>memory.get(String(key))??null,setItem:(key,value)=>memory.set(String(key),String(value)),removeItem:key=>memory.delete(String(key)),clear:()=>memory.clear(),key:index=>[...memory.keys()][index]??null,get length(){return memory.size;}}});
    }
  }
  const url = new URL(location.href);
  if (url.searchParams.get('mode') !== 'local') {
    url.searchParams.set('mode','local');
    history.replaceState(null,'',url);
  }
  window.addEventListener('DOMContentLoaded',()=>{
    // Open the original home view for an immediate comparison; tabs remain original.
    document.getElementById('view-home')?.click();
    document.title = '18 octobre 2026 · Archive Stade Mayennais';
  });
})();

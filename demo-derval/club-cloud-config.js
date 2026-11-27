// Keep the public demo's browser state independent of the live site.
for(const area of ['localStorage','sessionStorage']){
 const store=window[area],prefix='cruza-demo-derval:';
 const keys=()=>Array.from({length:store.length},(_,i)=>store.key(i)).filter(key=>key?.startsWith(prefix));
 Object.defineProperty(window,area,{value:{
  get length(){return keys().length},
  key(index){return keys()[index]?.slice(prefix.length)??null},
  getItem(key){return store.getItem(prefix+key)},
  setItem(key,value){store.setItem(prefix+key,value)},
  removeItem(key){store.removeItem(prefix+key)},
  clear(){keys().forEach(key=>store.removeItem(key))}
 }});
}
window.CLUB_CLOUD_CONFIG=Object.freeze({});
window.CRUZA_TERMS=Object.freeze({url:'conditions-utilisation.html',version:'v0.1-bêta'});
if(location.pathname.endsWith('/')||location.pathname.endsWith('/index.html')){
 const demoUrl=new URL(location.href);
 demoUrl.searchParams.set('mode','local');
 try{history.replaceState(history.state,'',demoUrl)}catch{}
}

window.CRUZA_DERVAL_DEMO=true;

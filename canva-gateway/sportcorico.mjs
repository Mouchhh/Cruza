// Public team pages only. No arbitrary hosts, redirects, cookies or credentials.
export function sportcoricoSource(value){
 try{const u=new URL(value);if(u.protocol!=='https:'||!['sportcorico.com','www.sportcorico.com'].includes(u.hostname)||u.port||u.username||u.password||!/^\/clubs\/[a-z0-9-]+\/[a-z0-9-]+\/?$/.test(u.pathname))throw Error();return 'https://www.sportcorico.com'+u.pathname.replace(/\/$/,'');}catch{throw Object.assign(Error('Lien Sportcorico invalide.'),{status:400});}
}
export function sportcoricoLogo(value){
 try{const u=new URL(value);return typeof value==='string'&&value.length<=1000&&u.protocol==='https:'&&['s3.pub2.infomaniak.cloud','www.sportcorico.com','sportcorico.com'].includes(u.hostname)&&!u.username&&!u.password&&!u.port?u.href:'';}catch{return '';}
}

// Matchs de l'équipe (calendrier et résultats) : champs minimaux, jamais de HTML.
export function parseGames(list,teamId){
 if(!Array.isArray(list))return [];
 const text=(v,max)=>typeof v==='string'&&v.trim()&&v.length<=max?v.trim():'',score=v=>Number.isInteger(v)&&v>=0&&v<=99?v:null;
 return list.slice(0,120).flatMap(g=>{
  if(!g||!Number.isInteger(g.id)||![g.home_team_id,g.outside_team_id].includes(teamId))return [];
  const date=/^(\d{4}-\d{2}-\d{2})/.exec(String(g.event_date||''))?.[1],time=/^([01]\d|2[0-3]):[0-5]\d$/.test(g.planned_time||'')?g.planned_time:'',home=text(g.home_team_name,150),away=text(g.outside_team_name,150);
  if(!date||!home||!away||g.exempt)return [];
  const played=g.status==='Terminé'&&score(g.home_score)!==null&&score(g.outside_score)!==null;
  return [{id:g.id,date,time,home,away,homeId:g.home_team_id,awayId:g.outside_team_id,competition:text(g.championship_name,150),status:played?'played':'planned',...(played?{homeScore:g.home_score,awayScore:g.outside_score}:{})}];
 }).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}
export function parseSportcorico(html,sourceURL){
 sourceURL=sportcoricoSource(sourceURL);
 const match=html.match(/<script\b[^>]*\bid="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
 if(!match)throw Error('Classement Sportcorico non reconnu.');
 const nodes=JSON.parse(match[1]);
 if(!Array.isArray(nodes)||nodes.length>100000||JSON.stringify(nodes[0])!=='["ShallowReactive",1]')throw Error('Données Sportcorico invalides.');
 function decode(i,depth=0){
  if(!Number.isInteger(i)||depth>40)throw Error('Référence invalide.');if(i<0)return null;const v=nodes[i];
  if(Array.isArray(v)){if(typeof v[0]==='string'){if(!['Reactive','ShallowReactive','Ref','ShallowRef','Set'].includes(v[0]))throw Error('Format inconnu.');return v.length>1?decode(v[1],depth+1):[];}return v.map(j=>decode(j,depth+1));}
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,j])=>[k,decode(j,depth+1)]));return v;
 }
 const slug=new URL(sourceURL).pathname.split('/').at(-1),entry=decode(nodes[1].data)['team-'+slug],team=entry?.team;
 if(!team||team.slug!==slug||!Number.isInteger(team.id))throw Error('Équipe Sportcorico introuvable.');
 const tables=entry.rankings?.filter(t=>t.lines?.some(r=>r.team_id===team.id));
 if(tables?.length!==1)throw Error('Aucun championnat unique trouvé pour cette équipe.');
 const t=tables[0],rows=t.lines.map(r=>Object.fromEntries(['rank','points','games_played','difference','team','team_id'].map(k=>[k,r[k]])));
 if(rows.length<2||rows.length>80||new Set(rows.map(r=>r.rank)).size!==rows.length||new Set(rows.map(r=>r.team_id)).size!==rows.length||rows.some(r=>typeof r.team!=='string'||!r.team||r.team.length>200||!['rank','points','games_played','difference','team_id'].every(k=>Number.isInteger(r[k])&&Math.abs(r[k])<1000000)||r.rank<1||r.rank>100||r.games_played<0||r.games_played>200))throw Error('Tableau Sportcorico invalide.');
 for(let i=0;i<rows.length;i++){rows[i].logo=sportcoricoLogo(t.lines[i].logo);rows[i].form=Array.isArray(t.lines[i].shape_of_the_moment)?t.lines[i].shape_of_the_moment.slice(0,5).map(v=>['V','N','D'].includes(v)?v:'?'):[];}
 const meta=[entry.current_season?.label,t.championship_name,t.pool_name,team.category?.name];if(meta.some(v=>typeof v!=='string'||v.length>200))throw Error('Championnat non reconnu.');
 return {version:1,sourceURL,teamSlug:slug,teamId:team.id,teamName:team.club_name+' '+team.name_generated,category:meta[3],season:meta[0],competition:meta[1],pool:meta[2],rows:rows.sort((a,b)=>a.rank-b.rank),games:parseGames(entry.games,team.id)};
}
export function sportcoricoReader(fetcher=fetch,now=Date.now){
 const cache=new Map(),pending=new Map();
 return async value=>{
  const source=sportcoricoSource(value),cached=cache.get(source);if(cached&&now()-cached.time<15*60000)return cached.data;
  if(pending.has(source))return pending.get(source);if(pending.size>=4)throw Object.assign(Error('Réessayez dans un instant.'),{status:429});
  const task=(async()=>{
   const response=await fetcher(source,{redirect:'error',headers:{Accept:'text/html','User-Agent':'CRUZA-ranking/1.0'},signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Object.assign(Error('Sportcorico est indisponible.'),{status:502});
   const reader=response.body?.getReader();if(!reader)throw Error('Page vide.');const chunks=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4000000){await reader.cancel();throw Error('Page trop volumineuse.');}chunks.push(value);}}finally{reader.releaseLock();}
   const data=parseSportcorico(Buffer.concat(chunks).toString('utf8'),source);data.fetchedAt=new Date(now()).toISOString();
   if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(source,{time:now(),data});return data;
  })().finally(()=>pending.delete(source));pending.set(source,task);return task;
 };
}

// Recherche d'un club par son nom (page publique « Recherche club »), football uniquement.
const decodeEntities=t=>t.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&nbsp;/g,' ').trim();
export function parseClubSearch(html){
 const clubs=[],seen=new Set(),pattern=/<a href="\/clubs\/([a-z0-9-]+)" class="rs-row[^"]*"[^>]*>([\s\S]*?)<\/a>/g;
 for(let m;(m=pattern.exec(html))&&clubs.length<12;){
  const body=m[2],text=name=>{const r=body.match(new RegExp('rs-row__'+name+'[^>]*>([^<]*)<'));return r?decodeEntities(r[1]).slice(0,120):'';};
  const sport=text('sport-name'),name=text('name');
  if(!name||seen.has(m[1])||(sport&&sport!=='Football'))continue;
  seen.add(m[1]);const img=body.match(/<img src="([^"]+)"/);
  clubs.push({slug:m[1],name,city:text('meta'),logo:sportcoricoLogo(img?decodeEntities(img[1]):'')});
 }
 return clubs;
}
export function sportcoricoSearcher(fetcher=fetch,now=Date.now){
 const cache=new Map();
 return async value=>{
  const query=String(value||'').normalize('NFC').replace(/\s+/g,' ').trim();
  if(query.length<2||query.length>60)throw Object.assign(Error('Tapez au moins 2 lettres.'),{status:400});
  const key=query.toLowerCase(),cached=cache.get(key);if(cached&&now()-cached.time<15*60000)return cached.data;
  const response=await fetcher('https://www.sportcorico.com/recherche?q='+encodeURIComponent(query),{redirect:'error',headers:{Accept:'text/html','User-Agent':'CRUZA-ranking/1.0'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Object.assign(Error('Sportcorico est indisponible.'),{status:502});
  const reader=response.body?.getReader();if(!reader)throw Error('Page vide.');const chunks=[];let size=0;
  try{while(true){const {done,value:part}=await reader.read();if(done)break;size+=part.byteLength;if(size>2000000){await reader.cancel();throw Error('Page trop volumineuse.');}chunks.push(part);}}finally{reader.releaseLock();}
  const data={version:1,query,clubs:parseClubSearch(Buffer.concat(chunks).toString('utf8'))};
  if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(key,{time:now(),data});return data;
 };
}

// Équipes d'un club (page club publique), pour choisir la sienne.
export function parseClubTeams(html,clubSlug){
 const teams=[],seen=new Set(),pattern=new RegExp('<a [^>]*href="/clubs/'+clubSlug+'/([a-z0-9-]+)"[^>]*>([\\s\\S]*?)</a>','g');
 for(let m;(m=pattern.exec(html))&&teams.length<60;){
  if(seen.has(m[1]))continue;
  const parts=m[2].replace(/<[^>]+>/g,'\n').split('\n').map(decodeEntities).filter(Boolean);
  if(!parts[0]||parts[0].length>80)continue;
  seen.add(m[1]);teams.push({slug:m[1],name:parts[0],competition:(parts[1]||'').slice(0,120),url:'https://www.sportcorico.com/clubs/'+clubSlug+'/'+m[1]});
 }
 return teams;
}
export function sportcoricoTeamLister(fetcher=fetch,now=Date.now){
 const cache=new Map();
 return async value=>{
  const slug=String(value||'');
  if(!/^[a-z0-9-]{2,100}$/.test(slug))throw Object.assign(Error('Club inconnu.'),{status:400});
  const cached=cache.get(slug);if(cached&&now()-cached.time<15*60000)return cached.data;
  const response=await fetcher('https://www.sportcorico.com/clubs/'+slug,{redirect:'error',headers:{Accept:'text/html','User-Agent':'CRUZA-ranking/1.0'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Object.assign(Error('Sportcorico est indisponible.'),{status:502});
  const reader=response.body?.getReader();if(!reader)throw Error('Page vide.');const chunks=[];let size=0;
  try{while(true){const {done,value:part}=await reader.read();if(done)break;size+=part.byteLength;if(size>3000000){await reader.cancel();throw Error('Page trop volumineuse.');}chunks.push(part);}}finally{reader.releaseLock();}
  const data={version:1,slug,teams:parseClubTeams(Buffer.concat(chunks).toString('utf8'),slug)};
  if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(slug,{time:now(),data});return data;
 };
}

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
  // Un match avec un score est joué, même si Sportcorico le laisse marqué « À venir » (statut parfois en retard sur le score).
  const played=score(g.home_score)!==null&&score(g.outside_score)!==null;
  return [{id:g.id,date,time,home,away,homeId:g.home_team_id,awayId:g.outside_team_id,competition:text(g.championship_name,150),status:played?'played':'planned',...(played?{homeScore:g.home_score,awayScore:g.outside_score}:{})}];
 }).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}
// Une équipe peut jouer plusieurs championnats (ex. U15 1 joue aussi « U14 Division 1 ») : on les sépare par catégorie d'âge.
const normName=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
export function competitionAge(value){const m=/\bU\s?(\d{2})\b/i.exec(String(value||''));return m?Number(m[1]):null;}
export function sameCompetition(a,b){a=normName(a);b=normName(b);return !!a&&!!b&&(a===b||a.startsWith(b)||b.startsWith(a));}
// Famille d'un championnat : vétérans, une catégorie d'âge (U17…), ou seniors. Les matchs « Vétérans » ne sont jamais ceux d'une équipe seniors.
export function competitionKind(value){
 if(/v[eé]t[eé]ran/i.test(String(value||'')))return 'vet';
 const age=competitionAge(value);return age!==null?'U'+age:'senior';
}
const NOT_A_LEAGUE=/coupe|amic|challenge|tournoi|plateau/i;
export function parseSportcorico(html,sourceURL,competition=''){
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
 const mine=entry.rankings?.filter(t=>t.lines?.some(r=>r.team_id===team.id))||[];
 const mainName=Array.isArray(team.competitions)?team.competitions[0]?.fullName:'';
 const t=competition?mine.find(x=>sameCompetition(x.championship_name,competition)):mine.length===1?mine[0]:mine.find(x=>sameCompetition(x.championship_name,mainName))||mine[0];
 if(!t)throw Error('Aucun championnat trouvé pour cette équipe.');
 const others=mine.filter(x=>x!==t),differs=x=>{const a=competitionAge(t.championship_name),b=competitionAge(x.championship_name);return a!==null&&b!==null&&a!==b;};
 const mainKind=competitionKind(t.championship_name);
 const belongs=g=>competition?sameCompetition(g.championship_name,t.championship_name):!(competitionKind(g.championship_name)==='vet'&&mainKind!=='vet')&&!others.some(x=>differs(x)&&sameCompetition(g.championship_name,x.championship_name));
 const rows=t.lines.map(r=>Object.fromEntries(['rank','points','games_played','difference','team','team_id'].map(k=>[k,r[k]])));
 if(rows.length<2||rows.length>80||new Set(rows.map(r=>r.rank)).size!==rows.length||new Set(rows.map(r=>r.team_id)).size!==rows.length||rows.some(r=>typeof r.team!=='string'||!r.team||r.team.length>200||!['rank','points','games_played','difference','team_id'].every(k=>Number.isInteger(r[k])&&Math.abs(r[k])<1000000)||r.rank<1||r.rank>100||r.games_played<0||r.games_played>200))throw Error('Tableau Sportcorico invalide.');
 for(let i=0;i<rows.length;i++){rows[i].logo=sportcoricoLogo(t.lines[i].logo);rows[i].form=Array.isArray(t.lines[i].shape_of_the_moment)?t.lines[i].shape_of_the_moment.slice(0,5).map(v=>['V','N','D'].includes(v)?v:'?'):[];}
 const meta=[entry.current_season?.label,t.championship_name,t.pool_name,team.category?.name];if(meta.some(v=>typeof v!=='string'||v.length>200))throw Error('Championnat non reconnu.');
 return {version:1,sourceURL,teamSlug:slug,teamId:team.id,teamName:team.club_name+' '+team.name_generated,category:meta[3],season:meta[0],competition:meta[1],pool:meta[2],rows:rows.sort((a,b)=>a.rank-b.rank),games:parseGames((Array.isArray(entry.games)?entry.games:[]).filter(belongs),team.id)};
}
export function sportcoricoReader(fetcher=fetch,now=Date.now){
 const cache=new Map(),pending=new Map();
 return async (value,competition='')=>{
  const source=sportcoricoSource(value);
  if(typeof competition!=='string'||competition.length>120||/[\u0000-\u001f]/.test(competition))throw Object.assign(Error('Championnat invalide.'),{status:400});
  const key=source+'|'+competition.trim(),cached=cache.get(key);if(cached&&now()-cached.time<15*60000)return cached.data;
  if(pending.has(key))return pending.get(key);if(pending.size>=4)throw Object.assign(Error('Réessayez dans un instant.'),{status:429});
  const task=(async()=>{
   const response=await fetcher(source,{redirect:'error',headers:{Accept:'text/html','User-Agent':'CRUZA-ranking/1.0'},signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Object.assign(Error('Sportcorico est indisponible.'),{status:502});
   const reader=response.body?.getReader();if(!reader)throw Error('Page vide.');const chunks=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4000000){await reader.cancel();throw Error('Page trop volumineuse.');}chunks.push(value);}}finally{reader.releaseLock();}
   const data=parseSportcorico(Buffer.concat(chunks).toString('utf8'),source,competition.trim());data.fetchedAt=new Date(now()).toISOString();
   if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,{time:now(),data});return data;
  })().finally(()=>pending.delete(key));pending.set(key,task);return task;
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
function nuxtTeams(html,clubSlug){
 const match=html.match(/<script\b[^>]*\bid="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);if(!match)return null;
 const nodes=JSON.parse(match[1]);if(!Array.isArray(nodes)||nodes.length>200000||JSON.stringify(nodes[0])!=='["ShallowReactive",1]')return null;
 const found=new Map(),seen=new Set();let budget=400000;
 function walk(i,depth){
  if(!Number.isInteger(i)||i<0||depth>40||seen.has(i)||--budget<0)return;seen.add(i);const v=nodes[i];
  if(Array.isArray(v)){if(typeof v[0]==='string'){if(v.length>1)walk(v[1],depth+1);return;}for(const j of v)walk(j,depth+1);return;}
  if(v&&typeof v==='object'){
   const slug=nodes[v.slug],club=nodes[v.club_slug],name=nodes[v.name_generated];
   if(typeof slug==='string'&&club===clubSlug&&typeof name==='string'&&v.competitions!==undefined){
    const list=nodes[v.competitions],competitions=Array.isArray(list)?list.map(j=>{const c=nodes[j];return c&&typeof c==='object'&&typeof nodes[c.fullName]==='string'?nodes[c.fullName]:'';}).filter(Boolean):[];
    if(!found.has(slug))found.set(slug,{slug,name:decodeEntities(name).slice(0,80),competitions});
    return;
   }
   for(const j of Object.values(v))walk(j,depth+1);
  }
 }
 walk(1,0);return [...found.values()];
}
// Un championnat d'une autre catégorie d'âge que le principal (hors coupes et amicaux) devient une équipe à part.
export function splitTeams(teams,clubSlug){
 const out=[];
 for(const team of teams){
  const url='https://www.sportcorico.com/clubs/'+clubSlug+'/'+team.slug,mainAge=competitionAge(team.competitions[0]);
  // Le championnat fait foi pour l'âge : « U19 1 » qui joue en poule U18 devient « U18 1 ».
  out.push({slug:team.slug,name:mainAge!==null&&competitionAge(team.name)!==null&&competitionAge(team.name)!==mainAge?team.name.replace(/\bU\s?\d{2}\b/i,'U'+mainAge):team.name,competition:(team.competitions[0]||'').slice(0,120),url});
  const added=new Set();
  for(const name of team.competitions.slice(1)){
   const age=competitionAge(name);
   if(mainAge===null||age===null||age===mainAge||NOT_A_LEAGUE.test(name)||added.has(age))continue;
   added.add(age);out.push({slug:team.slug,name:'U'+age,competition:name.slice(0,120),split:name.slice(0,120),url});
  }
 }
 return out.slice(0,80);
}
export function parseClubTeams(html,clubSlug){
 try{const teams=nuxtTeams(html,clubSlug);if(teams?.length)return splitTeams(teams,clubSlug);}catch{}
 return parseClubTeamsFromLinks(html,clubSlug);
}
export function parseClubTeamsFromLinks(html,clubSlug){
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

// Logo d'un club renvoyé par le relais (image publique Sportcorico) : fonctionne même si le navigateur bloque le site d'images
// (bloqueur de pubs ou de traceurs). Jamais de SVG, taille limitée.
export function sportcoricoLogoLoader(fetcher=fetch,now=Date.now){
 const cache=new Map();
 return async value=>{
  const url=sportcoricoLogo(String(value||''));
  if(!url)throw Object.assign(Error('Logo invalide.'),{status:400});
  const cached=cache.get(url);if(cached&&now()-cached.time<60*60000)return cached.data;
  const response=await fetcher(url,{redirect:'error',headers:{Accept:'image/*','User-Agent':'CRUZA-ranking/1.0'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Object.assign(Error('Logo indisponible.'),{status:502});
  const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(!/^image\/(png|jpeg|webp|gif)$/.test(type))throw Object.assign(Error('Format de logo non pris en charge.'),{status:502});
  const reader=response.body?.getReader();if(!reader)throw Error('Logo vide.');const chunks=[];let size=0;
  try{while(true){const {done,value:part}=await reader.read();if(done)break;size+=part.byteLength;if(size>600000){await reader.cancel();throw Object.assign(Error('Logo trop volumineux.'),{status:502});}chunks.push(part);}}finally{reader.releaseLock();}
  const data={version:1,type,base64:Buffer.concat(chunks).toString('base64')};
  if(cache.size>=200)cache.delete(cache.keys().next().value);cache.set(url,{time:now(),data});return data;
 };
}

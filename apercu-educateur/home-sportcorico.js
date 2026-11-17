// Public Sportcorico snapshot; no club credentials, browser storage or FFF requests.
let homeSportcoricoData=null,homeSportcoricoLoading=false,homeSportcoricoChecked=0,homeSportcoricoError=false;
const homeSportcoricoSource='https://www.sportcorico.com/clubs/st-mayennais-fc/mayenne-stade-fc-17';
function homeSportcoricoValid(data){
 return data?.version===1&&data.sourceURL===homeSportcoricoSource&&data.teamSlug==='mayenne-stade-fc-17'&&data.teamId===606690&&data.category==='U17'&&Number.isFinite(Date.parse(data.fetchedAt))&&['season','competition','pool'].every(k=>typeof data[k]==='string'&&data[k].length<=200)&&Array.isArray(data.rows)&&data.rows.length>=2&&data.rows.length<=80&&new Set(data.rows.map(r=>r.rank)).size===data.rows.length&&new Set(data.rows.map(r=>r.team_id)).size===data.rows.length&&data.rows.some(r=>r.team_id===data.teamId)&&data.rows.every(r=>r&&typeof r.team==='string'&&r.team.length>0&&r.team.length<=200&&['rank','points','games_played','difference','team_id'].every(k=>Number.isInteger(r[k])&&Math.abs(r[k])<1000000)&&r.rank>0&&r.rank<=100&&r.games_played>=0&&r.games_played<=200);
}
function homeSportcoricoConfigured(){return /^U17$/i.test(String(activeCoachTeam.category||'').trim());}
function renderHomeSportcorico(card){
 const data=homeSportcoricoData;
 if(!homeSportcoricoConfigured()){card.append(el('strong','home-live-value','Classement de l’équipe'),el('p','','Le lien Sportcorico de cette catégorie reste à configurer.'));return;}
 if(data){
  const own=data.rows.find(r=>r.team_id===data.teamId);
  card.append(el('strong','home-live-value',own.rank+(own.rank===1?'er':'e')+' · '+own.points+' pts'));
  card.append(el('p','home-live-caption',data.competition+' · '+data.pool+' · '+data.season));
  const wrap=el('div','home-sportcorico-table'),table=el('table');table.setAttribute('aria-label','Classement '+data.competition);
  const head=el('thead'),hr=el('tr');for(const label of ['Pl.','Équipe','J','Pts','Diff.']){const th=el('th','',label);th.scope='col';hr.append(th);}head.append(hr);table.append(head);
  const body=el('tbody');for(const r of data.rows){const row=el('tr');if(r.team_id===data.teamId){row.className='home-sportcorico-own';row.setAttribute('aria-current','true');}for(const value of [r.rank,r.team,r.games_played,r.points,r.difference>0?'+'+r.difference:r.difference])row.append(el('td','',String(value)));body.append(row);}table.append(body);wrap.append(table);card.append(wrap);
  const age=Date.now()-Date.parse(data.fetchedAt),stamp=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(data.fetchedAt));
  card.append(el('p','home-live-caption','Source : Sportcorico · récupéré le '+stamp+(age>2*60*60*1000?' · mise à jour en retard.':'.')));
  if(homeSportcoricoError)card.append(el('p','home-live-caption','Actualisation indisponible · dernier classement conservé.'));
 }else card.append(el('p','',homeSportcoricoError?'Classement momentanément indisponible. Consultez la source.':'Chargement du classement…'));
 const link=el('a','home-live-open','Voir sur Sportcorico ↗');link.href=homeSportcoricoSource;link.target='_blank';link.rel='noopener noreferrer';card.append(link);
}
async function refreshHomeSportcorico(){
 if(!homeSportcoricoConfigured()||homeSportcoricoLoading||Date.now()-homeSportcoricoChecked<60000)return;
 homeSportcoricoLoading=true;homeSportcoricoChecked=Date.now();
 try{const response=await fetch('../data/sportcorico-u17.json',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Snapshot unavailable');const data=await response.json();if(!homeSportcoricoValid(data))throw Error('Invalid snapshot');homeSportcoricoData=data;homeSportcoricoError=false;}
 catch{homeSportcoricoError=true;}
 finally{homeSportcoricoLoading=false;if(document.body.classList.contains('home-mode'))renderHomeWidgets();}
}
document.addEventListener('DOMContentLoaded',()=>{refreshHomeSportcorico();setInterval(()=>{if(!document.hidden&&document.body.classList.contains('home-mode'))refreshHomeSportcorico();},300000);window.addEventListener('focus',refreshHomeSportcorico);});

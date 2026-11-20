// Public Sportcorico snapshot; no club credentials, browser storage or FFF requests.
let homeSportcoricoData=null,homeSportcoricoLoading=false,homeSportcoricoChecked=0,homeSportcoricoError=false;
const homeSportcoricoDefaultSource='https://www.sportcorico.com/clubs/st-mayennais-fc/mayenne-stade-fc-17';
function homeSportcoricoSourceURL(){
 if(activeCoachTeam.sportcoricoURL!==undefined)return activeCoachTeam.sportcoricoURL;
 return true&&/^U17$/i.test(String(activeCoachTeam.category||'').trim())&&/mayennais|mayenne/i.test(activeCoachTeam.team||'')?homeSportcoricoDefaultSource:'';
}
function homeSportcoricoSettings(card){const configure=el('button','home-sportcorico-configure','Configurer le classement');configure.type='button';configure.onclick=()=>coachTeamAddDialog(true);card.append(configure);}
function homeSportcoricoLogo(value){
 try{const u=new URL(value);return typeof value==='string'&&value.length<=1000&&u.protocol==='https:'&&['s3.pub2.infomaniak.cloud','www.sportcorico.com','sportcorico.com'].includes(u.hostname)&&!u.username&&!u.password&&!u.port?u.href:'';}catch{return '';}
}
function homeSportcoricoTeamCell(row){
 const cell=el('td','home-sportcorico-club'),identity=el('span','home-sportcorico-identity'),badge=el('span','home-sportcorico-badge');badge.setAttribute('aria-hidden','true');badge.append(el('span','',row.team.replace(/[^A-Za-zÀ-ÿ0-9 ]/g,'').split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('')));
 const logo=homeSportcoricoLogo(row.logo);if(logo){const img=el('img','home-sportcorico-logo');img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';img.width=26;img.height=26;img.src=logo;badge.append(img);}
 identity.append(badge,el('span','home-sportcorico-name',row.team));cell.append(identity);
 const form=el('span','home-sportcorico-form');const results=Array.isArray(row.form)?row.form.slice(0,5):[],labels={V:'Victoire',N:'Match nul',D:'Défaite','?':'Résultat non renseigné'};
 form.setAttribute('aria-label',results.length?'Derniers résultats : '+results.map(v=>labels[v]||labels['?']).join(', '):'Derniers résultats non disponibles');
 if(results.length)for(const value of results){const v=['V','N','D'].includes(value)?value:'?',dot=el('span','home-sportcorico-result result-'+v,v==='?'?'–':v);dot.title=labels[v];dot.setAttribute('aria-hidden','true');form.append(dot);}else form.append(el('span','home-sportcorico-empty','Forme non disponible'));
 cell.append(form);return cell;
}
document.addEventListener('error',event=>{if(event.target?.matches?.('img.home-sportcorico-logo'))event.target.remove();},true);
function homeSportcoricoValid(data,source=homeSportcoricoSourceURL()){
 return data?.version===1&&data.sourceURL===source&&data.teamSlug===source.split('/').at(-1)&&Number.isInteger(data.teamId)&&typeof data.category==='string'&&Number.isFinite(Date.parse(data.fetchedAt))&&['season','competition','pool'].every(k=>typeof data[k]==='string'&&data[k].length<=200)&&Array.isArray(data.rows)&&data.rows.length>=2&&data.rows.length<=80&&new Set(data.rows.map(r=>r.rank)).size===data.rows.length&&new Set(data.rows.map(r=>r.team_id)).size===data.rows.length&&data.rows.some(r=>r.team_id===data.teamId)&&data.rows.every(r=>r&&typeof r.team==='string'&&r.team.length>0&&r.team.length<=200&&['rank','points','games_played','difference','team_id'].every(k=>Number.isInteger(r[k])&&Math.abs(r[k])<1000000)&&r.rank>0&&r.rank<=100&&r.games_played>=0&&r.games_played<=200);
}
function homeSportcoricoConfigured(){return !!homeSportcoricoSourceURL();}
function renderHomeSportcorico(card){
 const data=homeSportcoricoData?.sourceURL===homeSportcoricoSourceURL()?homeSportcoricoData:null;
 if(!homeSportcoricoConfigured()){card.append(el('strong','home-live-value','Classement de l’équipe'),el('p','','Ajoutez le lien Sportcorico de votre équipe.'));homeSportcoricoSettings(card);return;}
 if(data){
  const own=data.rows.find(r=>r.team_id===data.teamId);
  const summary = el('strong', 'home-live-value', own.rank + (own.rank === 1 ? 'er' : 'e') + ' · ');
  summary.append(el('span', 'home-ranking-points', own.points + ' pts'));
  card.append(summary);
  card.append(el('p','home-live-caption',data.competition+' · '+data.pool+' · '+data.season));
  const wrap=el('div','home-sportcorico-table'),table=el('table');table.setAttribute('aria-label','Classement '+data.competition);
  const head=el('thead'),hr=el('tr');for(const label of ['Pl.','Équipe','J','Pts','Diff.']){const th=el('th','',label);th.scope='col';hr.append(th);}head.append(hr);table.append(head);
  const body=el('tbody');for(const r of data.rows){const row=el('tr');if(r.team_id===data.teamId){row.className='home-sportcorico-own';row.setAttribute('aria-current','true');}const rank=el('td','home-sportcorico-rank',String(r.rank));if(r.rank<=3)rank.classList.add('home-sportcorico-top');row.append(rank,homeSportcoricoTeamCell(r));const pointsCell=el('td');pointsCell.append(el('span','home-ranking-points',String(r.points)));row.append(el('td','',String(r.games_played)),pointsCell,el('td','',String(r.difference>0?'+'+r.difference:r.difference)));body.append(row);}table.append(body);wrap.append(table);card.append(wrap,el('small','home-sportcorico-legend','Forme : V victoire · N nul · D défaite · ordre Sportcorico'));
  const expand=el('button','home-sportcorico-expand home-live-open','Voir le tableau');expand.type='button';expand.onclick=()=>{
   document.querySelector('.home-sportcorico-dialog')?.remove();const dialog=el('dialog','home-sportcorico-dialog'),close=el('button','home-live-open','Fermer');close.type='button';close.onclick=()=>dialog.close();
   dialog.append(el('h2','',data.competition+' · '+data.season),wrap.cloneNode(true),el('small','home-sportcorico-legend','V victoire · N nul · D défaite · ordre Sportcorico'),el('p','','Sportcorico · '+new Date(data.fetchedAt).toLocaleString('fr-FR',{timeZone:'Europe/Paris'})),close);const source=el('a','','Source Sportcorico ↗');source.href=homeSportcoricoSourceURL();source.target='_blank';source.rel='noopener noreferrer';dialog.append(source);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  };card.append(expand);
  const age=Date.now()-Date.parse(data.fetchedAt),stamp=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(data.fetchedAt));
  card.append(el('small','home-sportcorico-stamp','Sportcorico · '+stamp+(age>2*60*60*1000?' · mise à jour en retard.':'.')));
  if(homeSportcoricoError)card.append(el('small','home-sportcorico-stamp','Actualisation indisponible · dernier classement conservé.'));
 }else card.append(el('p','',homeSportcoricoError?'Classement indisponible ici pour le moment. Le lien Sportcorico reste accessible.':'Chargement du classement…'));
 const link=el('a','home-live-open','Voir sur Sportcorico ↗');link.href=homeSportcoricoSourceURL();link.target='_blank';link.rel='noopener noreferrer';card.append(link);homeSportcoricoSettings(card);
}
async function refreshHomeSportcorico(){
 if(!homeSportcoricoConfigured()||homeSportcoricoLoading||Date.now()-homeSportcoricoChecked<60000)return;
 homeSportcoricoLoading=true;homeSportcoricoChecked=Date.now();
 try{
  const source=homeSportcoricoSourceURL(),gateway=window.CLUB_RANKING_GATEWAY||window.CLUB_CANVA_GATEWAY;
  const url=source===homeSportcoricoDefaultSource?'data/sportcorico-u17.json':gateway?gateway.replace(/\/$/,'')+'/api/sportcorico?url='+encodeURIComponent(source)+(activeCoachTeam.sportcoricoCompetition?'&competition='+encodeURIComponent(activeCoachTeam.sportcoricoCompetition):''):'';
  if(!url)throw Error('Service not configured');const response=await fetch(url,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Snapshot unavailable');const data=await response.json();if(source!==homeSportcoricoSourceURL()||!homeSportcoricoValid(data,source))throw Error('Invalid snapshot');homeSportcoricoData=data;homeSportcoricoError=false;window.sportcoricoSync?.store(data);
 }
 catch{homeSportcoricoError=true;}
 finally{homeSportcoricoLoading=false;if(document.body.classList.contains('home-mode'))renderHomeWidgets();}
}
document.addEventListener('DOMContentLoaded',()=>{refreshHomeSportcorico();setInterval(()=>{if(!document.hidden&&document.body.classList.contains('home-mode'))refreshHomeSportcorico();},300000);window.addEventListener('focus',refreshHomeSportcorico);});

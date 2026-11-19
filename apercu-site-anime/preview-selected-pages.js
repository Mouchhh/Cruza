/* Only Home and Agenda overview change presentation. All editor actions use
   the original application controllers and its isolated preview storage. */
(() => {
  'use strict';
  if(new URL(location.href).searchParams.get('layout')==='original')return;
  const $=id=>document.getElementById(id);
  const E=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arrow='<svg class="evo-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16 16 4M5 4h11v11"/></svg>';
  const turn='<svg class="evo-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3v9h12m-5-5 5 5-5 5"/></svg>';
  let home,agenda,week='',filter='all',timer=0,lastView='',homeKey='',agendaKey='';
  const weekStart=day=>{const d=new Date(day+'T12:00:00Z');return agendaCalendarAdd(day,-((d.getUTCDay()+6)%7));};
  const label=(day,options={weekday:'short',day:'numeric',month:'short'})=>new Intl.DateTimeFormat('fr-FR',{timeZone:'UTC',...options}).format(new Date(day+'T12:00:00Z'));
  const time=value=>value?String(value).replace(':',' h '):'Horaire à préciser';
  const pill=(text,kind='')=>`<span class="evo-pill ${kind?'evo-pill-'+kind:''}">${E(text)}</span>`;
  const button=(text,action,kind='',extra='')=>`<button type="button" class="evo-button ${kind?'evo-button-'+kind:''}" data-evo-action="${action}" ${extra}>${text}</button>`;
  const link=(text,action,extra='')=>`<button type="button" class="evo-link" data-evo-action="${action}" ${extra}>${text}</button>`;
  const eventAttribute=event=>event?`data-evo-event="${E(event.id)}"`:'';
  function events(){
    const today=agendaCalendarToday(),from=agendaCalendarAdd(today,-90),to=agendaCalendarAdd(today,180),seen=new Set();
    return agendaCalendarAllEvents({from,to}).filter(e=>{
      if(!['match','training','report'].includes(e.kind)||e.otherTeam||!e.date||e.date<from||e.date>to)return false;
      const key=e.id+'|'+e.date+'|'+(e.time||'');if(seen.has(key))return false;seen.add(key);return true;
    }).sort((a,b)=>(a.date+'T'+(a.time||'23:59')).localeCompare(b.date+'T'+(b.time||'23:59')));
  }
  const findEvent=id=>events().find(e=>e.id===id);
  function info(event){
    if(!event)return null;
    const board=typeof agendaEventBoard==='function'?agendaEventBoard(event):null;
    const opponent=event.fff?.opponent||board?.matchPreparation?.opponent||event.title;
    const report=reportLibrary.find(r=>reportValid(r)&&window.matchContinuity?.reportMatches(r,event));
    const ready=!!board&&documentCompletionIsCompleted('causerie',board);
    const started=!!board&&typeof matchPreparationFilled==='function'&&matchPreparationFilled(board.matchPreparation);
    const reportDone=!!report&&documentCompletionIsCompleted('report',report);
    return {event,opponent,board,report,ready,started,reportDone,played:!!event.fff?.score||reportDone,location:event.fff?.location||event.location||'Lieu à préciser'};
  }
  function snapshot(){
    const list=events(),today=agendaCalendarToday(),s=homeWidgetsSnapshot();
    const upcoming=list.find(e=>e.kind==='match'&&(e.date>today||e.date===today&&(!e.time||e.time>=s.now.time)));
    const past=list.filter(e=>e.kind==='match'&&e.date<today).at(-1);
    const next=info(upcoming),previous=info(past);
    const name=(typeof coachAccountDisplayName==='function'&&coachAccountDisplayName())||activeCoach.name;
    const club=coachClubDetailsRead();
    const publicForm=!s.form.length&&window.sportcoricoSync?window.sportcoricoSync.form(typeof homeSportcoricoData==='object'?homeSportcoricoData:null):null;
    const form=s.form.length?s.form:publicForm?.form||[],points=s.form.length?s.points:publicForm?.points??0;
    return {list,today,s,next,previous,name,club,form,points};
  }
  function prepFlow(match){
    return `<div class="evo-flow"><div class="evo-flow-step ${match?'done':'current'}">${match?'✓ ':''}Match renseigné<small>${match?'Depuis l’agenda':'À planifier'}</small></div><div class="evo-flow-step ${match?.ready?'done':match?'current':''}">Causerie<small>${match?.ready?'Prête à présenter':match?.started?'En préparation':'À préparer'}</small></div><div class="evo-flow-step ${match?.played?'done':''}">Match joué<small>${match?.played?'Résultat disponible':match?label(match.event.date):'À venir'}</small></div><div class="evo-flow-step ${match?.reportDone?'done':match?.played?'current':''}">Bilan<small>${match?.reportDone?'Renseigné':match?.played?'À compléter':'Après le match'}</small></div></div>`;
  }
  function matchSummary(data){
    if(!data.next)return '<div class="evo-empty"><strong>Votre prochain rendez-vous n’est pas encore renseigné.</strong><br>Ajoutez-le depuis l’agenda pour retrouver son contexte dans la préparation.</div>';
    const {next,club}=data,initials=next.opponent.split(/\s+/).filter(Boolean).map(w=>w[0]).slice(0,2).join('');
    return `<div class="evo-match"><div class="evo-team"><img src="${E(club.logo||'assets/club-logo.jpg')}" alt=""><div>${E(club.name)}<small>${E(activeCoachTeam.category||'Mon équipe')}</small></div></div><div class="evo-match-date">${E(label(next.event.date))}<strong>${E(next.event.time||'À préciser')}</strong>${E(next.event.fff?.roundLabel||'Prochain match')}</div><div class="evo-team"><div>${E(next.opponent)}<small>${E(next.location)}</small></div><span class="evo-opponent">${E(initials)}</span></div></div>`;
  }
  function eventRow(event){return `<div class="evo-event-row"><div class="evo-date">${E(label(event.date,{weekday:'short'}).replace('.','').toUpperCase())}<b>${Number(event.date.slice(-2))}</b></div><div class="evo-event-copy"><strong>${E(event.title)}</strong><small>${E(event.label||({training:'Entraînement',match:'Match',report:'Bilan'})[event.kind])} · ${E(time(event.time))}</small></div><button class="evo-icon-button" type="button" data-evo-action="open-event" ${eventAttribute(event)} aria-label="Ouvrir ${E(event.title)}">${arrow}</button></div>`;}
  function homeMarkup(data){
    const {today,next,previous,s,club,form,points}=data;
    const nextEvents=data.list.filter(e=>e.date>=today&&['training','match'].includes(e.kind)).slice(0,3);
    const weekly=nextEvents.filter(e=>e.date<=agendaCalendarAdd(weekStart(today),6));
    const shown=weekly.length?weekly:nextEvents;
    const recent=previous&&previous.played&&!previous.reportDone&&previous.event.date>=agendaCalendarAdd(today,-3);
    const action=recent?'open-report':next?'open-causerie':'open-training';
    const target=recent?previous.event:next?.event;
    const heroTitle=recent?'Le match est terminé.<br>Place au bilan.':next?'Le prochain match<br>se prépare ici.':'Votre semaine<br>commence ici.';
    const heroCopy=recent?`Retrouvez vos intentions contre ${E(previous.opponent)} et donnez une suite au travail du groupe.`:next?`${E(next.opponent)} est déjà renseigné dans votre agenda. Retrouvez votre préparation, sans repartir de zéro.`:'Retrouvez vos séances, vos matchs et les bilans à reprendre au même endroit.';
    const prep=next?1+Number(next.started||next.ready)+Number(next.ready):0;
    const ranking=typeof homeSportcoricoData==='object'&&homeSportcoricoData?.rows?.find(r=>r.team_id===homeSportcoricoData.teamId);
    const key=JSON.stringify([today,data.name,next?.event.id,next?.started,next?.ready,next?.reportDone,previous?.event.id,previous?.reportDone,s.rate,s.sessions,shown.map(e=>[e.id,e.title,e.date,e.time]),form,points,s.recommendation,ranking?.points,ranking?.rank,club.name]);
    if(homeKey===key)return null;homeKey=key;
    return `<div class="evo-heading"><div><div class="evo-eyebrow">Le vestiaire · ${E(label(today,{weekday:'long',day:'numeric',month:'long',year:'numeric'}))}</div><h1>Chaque semaine, un cap commun.</h1><p>Votre équipe, vos préparations et la suite à donner — au même endroit.</p></div>${link(ranking?`Classement · ${ranking.rank}${ranking.rank===1?'er':'e'} · ${ranking.points} pts`:'Voir le classement','ranking')}</div>
      <section class="evo-hero"><div class="evo-hero-top"><div class="evo-eyebrow">${E(club.name)} · ${E(activeCoachTeam.category||'Mon équipe')}</div><span class="evo-hero-badge">DU BUREAU AU TERRAIN</span></div><img class="evo-hero-logo" src="${E(club.logo||'assets/club-logo.jpg')}" alt=""><div><h2>Bonjour ${E(data.name.split(' ')[0])}.<br>${heroTitle}</h2><p>${heroCopy}</p></div><div class="evo-hero-foot"><div class="evo-actions">${button((recent?'Compléter le bilan':next?.started?'Reprendre ma causerie':next?'Préparer ma causerie':'Préparer ma séance')+' '+arrow,action,'light',eventAttribute(target))}${button('Voir ma semaine','open-week','outline')}</div><span class="evo-hero-status"><i></i>${recent?'Bilan à compléter':next?.ready?'Causerie prête':next?.started?'Préparation en cours':'Un rendez-vous, un fil conducteur'}</span></div></section>
      <div class="evo-dashboard"><section class="evo-card"><div class="evo-card-head"><div><h2>Votre fil du match</h2><p>Un seul match, de la préparation au bilan.</p></div>${pill(next?'Relié à l’agenda':'À planifier',next?'green':'gold')}</div>${matchSummary(data)}${prepFlow(next)}<div class="evo-actions">${button(next?.started?'Reprendre la préparation':'Ouvrir la préparation',next?'open-causerie':'open-match','primary',eventAttribute(next?.event))}${button(previous&&!previous.reportDone?'Bilan du dernier match':'Ouvrir les bilans','open-report','',eventAttribute(previous?.event))}</div><div class="evo-note">L’adversaire, la date et l’équipe vous accompagnent de la préparation au bilan.</div></section>
      <section class="evo-card"><div class="evo-card-head"><div><h2>${weekly.length?'Cette semaine':'Vos prochains rendez-vous'}</h2><p>${E(activeCoachTeam.label||activeCoachTeam.category||'Mon équipe')}</p></div>${link('Tout voir '+arrow,'open-week')}</div>${shown.length?shown.map(eventRow).join(''):'<div class="evo-empty">Aucun rendez-vous disponible dans cette copie.<br>Les événements que vous préparez ici apparaîtront dans cette vue.</div>'}</section></div>
      <div class="evo-stats"><section class="evo-stat"><div class="evo-stat-label">Présence aux entraînements</div><div class="evo-stat-value">${s.rate===null?'—':s.rate}<small>${s.rate===null?'À pointer':' %'}</small></div><div class="evo-stat-detail">${s.sessions?`${s.sessions} dernières séances · présences renseignées`:'Aucune présence pointée dans cet aperçu'}</div><div class="evo-progress"><i style="width:${s.rate??0}%"></i></div></section>
      <section class="evo-stat"><div class="evo-stat-label">Forme · derniers matchs renseignés</div><div class="evo-stat-value">${form.length?points:'—'} <small>${form.length?'pts / '+form.length*3:'À renseigner'}</small></div><div class="evo-stat-detail">${form.length?'Résultats disponibles pour votre équipe':'Les résultats s’affichent quand ils sont disponibles'}</div><div class="evo-results">${form.slice(-5).map(v=>`<span class="evo-result ${['V','N','D'].includes(v)?v:''}">${E(v)}</span>`).join('')}</div></section>
      <section class="evo-stat"><div class="evo-stat-label">Préparation du prochain match</div><div class="evo-stat-value">${prep} <small>/ 3</small></div><div class="evo-stat-detail">Agenda · préparation commencée · causerie prête</div><div class="evo-progress"><i style="width:${Math.round(prep/3*100)}%"></i></div></section></div>
      <section class="evo-insight">${turn}<div><strong>Du dernier bilan à la prochaine séance.</strong><p>${E(s.recommendation||'Un point à travailler dans le bilan, une situation pour le préparer sur le terrain.')}</p></div>${link(s.recommendation?'Préparer la séance '+arrow:previous?'Compléter le bilan '+arrow:'Ouvrir les séances '+arrow,s.recommendation?'open-training':previous?'open-report':'open-training',eventAttribute(previous?.event))}</section>
      <p class="evo-public-note">Aperçu séparé du site actuel. Les documents privés de votre compte ne sont pas chargés ; aucune statistique n’est inventée pour les remplacer.</p>`;
  }
  function agendaMarkup(data){
    if(!week)week=weekStart(data.next?.event.date||data.today);
    const end=agendaCalendarAdd(week,6),visible=data.list.filter(e=>e.date>=week&&e.date<=end&&(filter==='all'||e.kind===filter));
    const matches=data.list.filter(e=>e.kind==='match'&&e.date>=agendaCalendarAdd(data.today,-7)).slice(0,5);
    const key=JSON.stringify([week,filter,data.today,visible.map(e=>[e.id,e.title,e.date,e.time]),matches.map(e=>[e.id,e.title,e.date,e.time])]);
    if(agendaKey===key)return null;agendaKey=key;
    const sameMonth=week.slice(0,7)===end.slice(0,7),range=(sameMonth?Number(week.slice(-2)):label(week,{day:'numeric',month:'short'}))+' — '+label(end,{day:'numeric',month:'long',year:'numeric'});
    return `<div class="evo-heading"><div><div class="evo-eyebrow">Les rendez-vous du groupe</div><h1>Une semaine lisible.</h1><p>Tout reste accessible depuis son onglet ; l’agenda fait le lien.</p></div>${button('Ajouter un rendez-vous','create-event')}</div>
      <div class="evo-week-toolbar"><div class="evo-actions"><button class="evo-icon-button" type="button" data-evo-action="previous-week" aria-label="Semaine précédente">‹</button><h2 class="evo-week-label">${E(range)}</h2><button class="evo-icon-button" type="button" data-evo-action="next-week" aria-label="Semaine suivante">›</button></div><div class="evo-actions">${button('Aujourd’hui','today-week','small')}<input class="evo-week-picker" id="evo-week-picker" type="date" value="${week}" aria-label="Choisir une semaine"></div></div>
      <div class="evo-filters" role="group" aria-label="Types de rendez-vous">${[['all','Tous'],['training','Séances'],['match','Matchs'],['report','Bilans']].map(([kind,text])=>`<button type="button" class="evo-chip ${filter===kind?'active':''}" aria-pressed="${filter===kind}" data-evo-action="filter" data-evo-filter="${kind}">${text}</button>`).join('')}<span style="margin-left:auto">${link('Calendrier complet '+arrow,'full-calendar')}</span></div>
      <div class="evo-calendar-scroll" tabindex="0" aria-label="Semaine, défilement horizontal sur téléphone"><div class="evo-week">${Array.from({length:7},(_,i)=>{const date=agendaCalendarAdd(week,i),rows=visible.filter(e=>e.date===date);return `<section class="evo-day ${date===data.today?'today':''}"><div class="evo-day-head">${E(label(date,{weekday:'short'}))}<b>${Number(date.slice(-2))}</b></div>${rows.map(e=>`<button type="button" class="evo-calendar-event is-${e.kind}" data-evo-action="open-event" ${eventAttribute(e)}><small>${E(e.time||'Horaire à préciser')}</small><strong>${E(e.kind==='match'?e.fff?.opponent||e.title:e.title)}</strong>${E(e.kind==='training'?'Entraînement':e.kind==='report'?'Bilan':'Match')}<small>${e.kind==='match'?'Ouvrir la préparation':e.kind==='training'?'Ouvrir / préparer la séance':'Reprendre le bilan'}</small></button>`).join('')}<button type="button" class="evo-add-day" data-evo-action="create-event" data-evo-date="${date}" aria-label="Préparer un rendez-vous le ${E(label(date))}">+ Préparer</button></section>`;}).join('')}</div></div>
      <div class="evo-agenda-bottom"><section class="evo-card"><div class="evo-card-head"><div><h2>Les matchs du groupe</h2><p>Les repères déjà disponibles dans l’agenda</p></div>${pill(activeCoachTeam.category||'Mon équipe')}</div>${matches.length?matches.map((e,i)=>`<div class="evo-match-row"><span class="evo-round">${e.fff?.round?'J'+e.fff.round:i+1}</span><div><strong>${E(e.fff?.opponent||e.title)}</strong><small>${E(label(e.date,{weekday:'long',day:'numeric',month:'long'}))} · ${E(time(e.time))}</small></div>${button('Ouvrir','open-causerie',e.id===data.next?.event.id?'primary small':'small',eventAttribute(e))}</div>`).join(''):'<div class="evo-empty">Ajoutez un match depuis les outils existants pour le retrouver ici.</div>'}</section>
      <section class="evo-card"><div class="evo-card-head"><h2>Plus besoin de tout ressaisir.</h2></div><p class="evo-empty">Ouvrez un match : son adversaire, sa date et son équipe sont repris dans la préparation. Retrouvez ensuite le même contexte dans le bilan.</p><div class="evo-context-box"><strong>Le même rendez-vous, du début à la fin.</strong><br>Retrouvez le même adversaire et la même date dans votre causerie et votre bilan.</div><div class="evo-actions" style="margin-top:18px">${button('Pointer les présences','open-presence','small')}${button('Régler les créneaux','recurrence','small')}</div></section></div>
      <p class="evo-public-note">${visible.length?`${visible.length} rendez-vous disponible(s) sur cette semaine.`:'Aucun rendez-vous disponible sur cette semaine dans cet aperçu.'} Les événements privés du vrai site ne sont pas copiés.</p>`;
  }
  function mount(id,childId){const host=$(id);if(!host)return null;let panel=$(childId);if(!panel){panel=document.createElement('section');panel.id=childId;panel.className='evo-view';host.append(panel);}for(const child of host.children)if(child!==panel)child.classList.add('evo-original-content');return panel;}
  function render(force=false){
    if(!window.workspaceFraming)return;
    const view=workspaceFraming.current(),showHome=view.view==='home',showAgenda=view.view==='agenda'&&view.panelId==='agenda-page-0';
    document.body.classList.toggle('evo-agenda-overview',showAgenda);
    const overviewTab=$('task-agenda-overview');if(view.view==='agenda'&&overviewTab)overviewTab.textContent='Semaine';
    if(!showHome&&!showAgenda)return;
    home=mount('home-page-0','evo-home');agenda=mount('agenda-page-0','evo-agenda');
    if(!home||!agenda)return;
    let data;try{data=snapshot();}catch(error){console.warn('Lecture de présentation indisponible.',error);return;}
    if(showHome){if(force)homeKey='';const markup=homeMarkup(data);if(markup!==null)home.innerHTML=markup;}
    if(showAgenda){if(force)agendaKey='';const markup=agendaMarkup(data);if(markup!==null)agenda.innerHTML=markup;}
    window.selectedPagesPreviewReady=true;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(()=>render(),70);}
  function openEditor(event,kind){
    if(event?.otherTeam)return event.open?.();
    if(kind==='report')return event?agendaEventReport(event,event.date):workspaceNavigation.run('view-reports');
    if(kind==='causerie')return event?agendaEventCauserie(event,event.date):workspaceNavigation.run('view-pitch',()=>workspaceFlows.terrain.go(1));
    if(event?.kind==='training'&&typeof trainingAgendaOpen==='function')return trainingAgendaOpen(event);
    if(event?.open)return event.open();
    return workspaceNavigation.run('view-training',()=>trainingWizard.openLibrary());
  }
  function openWeek(){if(!week){const data=snapshot();week=weekStart(data.next?.event.date||data.today);}return workspaceNavigation.run('view-coach-agenda',()=>workspaceFlows.agenda.go(0));}
  function createDialog(date=agendaCalendarToday()){
    let modal=$('evo-create-dialog');if(!modal){modal=document.createElement('dialog');modal.id='evo-create-dialog';modal.setAttribute('aria-labelledby','evo-create-title');document.body.append(modal);}
    modal.innerHTML='<div class="evo-dialog-heading"><h2 id="evo-create-title">Préparer un rendez-vous</h2><button type="button" data-evo-action="close-dialog" aria-label="Fermer">×</button></div><label class="evo-dialog-date">Date du rendez-vous<input type="date" id="evo-create-date" value="'+E(date)+'" required></label><div class="evo-dialog-actions"><button type="button" data-evo-action="create-training">Préparer une séance</button><button type="button" data-evo-action="create-match">Préparer un match</button></div><p class="evo-dialog-note">Vous retrouvez ensuite les formulaires habituels du site. Le rendez-vous apparaîtra dans l’agenda après son enregistrement.</p>';
    modal.showModal();
  }
  function ranking(){let modal=$('evo-ranking-dialog');if(!modal){modal=document.createElement('dialog');modal.id='evo-ranking-dialog';modal.setAttribute('aria-labelledby','evo-ranking-title');document.body.append(modal);}modal.innerHTML='<div class="evo-dialog-heading"><h2 id="evo-ranking-title">Le classement de votre équipe</h2><button type="button" data-evo-action="close-dialog" aria-label="Fermer">×</button></div>';const card=document.createElement('div');card.className='home-live-card home-live-ranking';renderHomeSportcorico(card);modal.append(card);modal.showModal();}
  document.addEventListener('click',event=>{
    const control=event.target.closest('[data-evo-action]');if(!control)return;
    const action=control.dataset.evoAction,id=control.dataset.evoEvent,eventData=id?findEvent(id):null;
    if(action==='open-week')openWeek();
    else if(action==='open-causerie')openEditor(eventData,'causerie');
    else if(action==='open-report')openEditor(eventData,'report');
    else if(action==='open-match')workspaceNavigation.run('view-pitch');
    else if(action==='open-training')openEditor(eventData?.kind==='training'?eventData:null,'training');
    else if(action==='open-event')openEditor(eventData,eventData?.kind==='match'?'causerie':eventData?.kind==='report'?'report':'training');
    else if(action==='open-presence')workspaceNavigation.run('workspace-squad-entry');
    else if(action==='full-calendar')workspaceNavigation.run('view-coach-agenda',()=>workspaceFlows.agenda.go(1));
    else if(action==='recurrence')agendaRecurringConfigure();
    else if(action==='ranking')ranking();
    else if(action==='previous-week'){week=agendaCalendarAdd(week,-7);render(true);}
    else if(action==='next-week'){week=agendaCalendarAdd(week,7);render(true);}
    else if(action==='today-week'){week=weekStart(agendaCalendarToday());render(true);}
    else if(action==='filter'){filter=control.dataset.evoFilter;render(true);}
    else if(action==='create-event')createDialog(control.dataset.evoDate||agendaCalendarToday());
    else if(action==='close-dialog')control.closest('dialog').close();
    else if(action==='create-training'||action==='create-match'){
      const input=$('evo-create-date');if(!input.reportValidity()||!trainingDateValid(input.value))return;
      const date=input.value;control.closest('dialog').close();
      if(action==='create-training')agendaCalendarPrepare(date);else agendaEventCauserie(null,date);
    }
  });
  window.addEventListener('click',event=>{if(event.isTrusted&&event.target.closest?.('#view-coach-agenda'))setTimeout(()=>{if(workspaceFraming.current().view==='agenda'){workspaceFlows.agenda.go(0);render(true);}},0);},true);
  document.addEventListener('change',event=>{if(event.target.id==='evo-week-picker'&&trainingDateValid(event.target.value)){week=weekStart(event.target.value);render(true);}});
  function initialize(){
    document.body.classList.add('evo-selected-layout');
    home=mount('home-page-0','evo-home');agenda=mount('agenda-page-0','evo-agenda');
    // No core renderer or application state is overridden.
    for(const name of ['click','change','workspace-draft-changed','training-library-updated','agenda-recurrence-updated','club-session-ready'])document.addEventListener(name,schedule);
    window.addEventListener('focus',schedule);window.addEventListener('storage',schedule);
    new MutationObserver(()=>{const view=workspaceFraming.current(),key=view.view+':'+view.panelId;if(key!==lastView){lastView=key;render(true);}}).observe(document.body,{attributes:true,attributeFilter:['class']});
    setTimeout(()=>render(true),180);
    setInterval(schedule,60000);
    window.selectedPagesPreview={render:()=>render(true),events,week:()=>week,openWeek,afterMainNavigation:id=>id==='view-coach-agenda'?()=>{workspaceFlows.agenda.go(0);render(true);}:undefined};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initialize,0));else initialize();
})();

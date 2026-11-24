// Match narrative is separate from the canonical player statistics and attendance.
const reportMomentFields = {strongMoments:'Temps forts',weakMoments:'Temps faibles',keyOpponentEvents:'Faits de jeu majeurs et événements clés de l’adversaire'};
const reportMomentValid = reportValid;
reportValid = function(report) {
  return reportMomentValid(report) && Object.keys(reportMomentFields).every(key => report.analysis[key] === undefined || reportText(report.analysis[key]));
};
renderReportPlayers = function(root) {
  const section = el('section', 'report-moments-events');
  section.id = 'report-moments-panel';
  renderReportEvents(section);
  const tools = section.querySelector('.report-actions');
  tools.replaceChildren();
  for (const [label, type, card] of [['+ Fait de jeu de notre équipe','But pour',''],['+ Fait de jeu de l’adversaire','But contre',''],['+ Carton jaune','Carton','yellow'],['+ Carton rouge','Carton','red']]) {
    const button=el('button','export',label);button.type='button';
    button.onclick=()=>{
      if(currentReport.events.length>=100)return notify('100 faits maximum.');
      reportEventsCommit(()=>currentReport.events.push({minute:'',type,card,detail:''}));
    };
    tools.append(button);
  }
  for (const select of section.querySelectorAll('[aria-label="Événement"]')) {
    const selected=select.value;
    for (const option of [...select.options]) {
      if(!['But pour','But contre','Carton','Carton adverse',selected].includes(option.value))option.remove();
      else if(option.value==='But pour')option.textContent='But marqué';
      else if(option.value==='But contre')option.textContent='But encaissé';
    }
  }
  root.append(section);
};
const reportMomentsDocument = buildReportDocument;
buildReportDocument = function(...args) {
  const document = reportMomentsDocument.apply(this,args);
  const section = el('section');
  for (const [key,label] of Object.entries(reportMomentFields)) if(currentReport.analysis[key]?.trim()) reportPrintText(section,label,currentReport.analysis[key]);
  if(section.children.length) {section.prepend(el('h2','','Moments marquants'));document.append(section);}
  return document;
};
document.addEventListener('DOMContentLoaded', () => {
  const navigation = el('div','squad-followup-tabs');
  navigation.setAttribute('role','group');navigation.setAttribute('aria-label','Vues de l’effectif');
  const roster = el('button','export','Effectif'), follow = el('button','export','Suivi des joueurs');
  roster.type=follow.type='button';navigation.append(roster,follow);squadHeading.after(navigation);
  const panel = el('section','squad-followup');panel.id='squad-followup';panel.hidden=true;
  const content = el('div','squad-followup-content');content.setAttribute('aria-live','polite');panel.append(content);squadList.before(panel);
  let active=false, selected=null; // selected : joueur ouvert, null = vue d'ensemble
  // Suivi des joueurs : une partie générale (postes, présences de l'équipe), puis la liste des joueurs ;
  // un clic sur un joueur ouvre ses statistiques, ses bilans et ses présences.
  function primaryPosition(player) {
    const first = squadPlayerPositions(player)[0];
    return squadPositions.includes(first) ? first : 'Poste à préciser';
  }
  function bars(rows, total) {
    const list = el('div','squad-followup-bars');
    for (const [name, value, detail] of rows) {
      const row = el('div','squad-followup-bar'), track = el('span','squad-followup-track'), fill = el('span');
      fill.style.width = (total ? Math.round(value / total * 100) : 0) + '%';
      track.append(fill);
      row.append(el('span','squad-followup-bar-label',name), track, el('strong','',detail ?? String(value)));
      list.append(row);
    }
    return list;
  }
  function paintOverview(snapshot, players) {
    const general = el('section','squad-followup-general');
    general.append(el('h3','','Vue d’ensemble'));
    const positions = el('div','squad-followup-card');
    positions.append(el('h4','','Postes principaux'));
    positions.append(bars([...squadPositions,'Poste à préciser'].map(name => [name, players.filter(p => primaryPosition(p) === name).length]), players.length));
    const presence = el('div','squad-followup-card');
    presence.append(el('h4','','Présences aux séances'));
    // Une ligne par séance pointée : présents sur joueurs pointés.
    const sessions = new Map();
    let present = 0, known = 0;
    for (const stats of snapshot.players.values()) {
      present += stats.attendance.present;
      known += stats.attendance.present + stats.attendance.absent;
      for (const entry of stats.attendance.entries) {
        const key = entry.date + ' ' + (entry.time || '') + ' ' + entry.title;
        const item = sessions.get(key) || {...entry, present: 0, total: 0};
        item.total++;
        if (entry.status === 'present') item.present++;
        sessions.set(key, item);
      }
    }
    if (!sessions.size) presence.append(el('p','hint','Aucun pointage cette saison. Pointez les séances dans l’onglet Présences.'));
    else {
      presence.append(el('p','squad-followup-rate', 'Taux de présence de l’équipe : ' + (known ? Math.round(present / known * 100) + ' %' : '—')));
      const recent = [...sessions.values()].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)).slice(0, 6);
      const day = date => new Intl.DateTimeFormat('fr-FR',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short'}).format(new Date(date + 'T12:00:00Z'));
      presence.append(bars(recent.map(s => [day(s.date) + (s.time ? ' · ' + s.time.replace(':','h') : '') + ' · ' + s.title, s.present, s.present + '/' + s.total]), Math.max(...recent.map(s => s.total))));
    }
    const grid = el('div','squad-followup-grid');
    grid.append(positions, presence);
    general.append(grid);
    const individual = el('section','squad-followup-individual');
    individual.append(el('h3','','Joueur par joueur'), el('p','hint','Touchez un joueur pour voir ses statistiques, ses présences et ses bilans.'));
    const list = el('div','squad-followup-players');
    for (const player of [...players].sort((a, b) => a.name.localeCompare(b.name, 'fr'))) {
      const stats = snapshot.players.get(player.id), button = el('button','squad-followup-player'), info = el('span','squad-followup-player-info');
      button.type = 'button';
      info.append(el('strong','',player.name), el('small','',[primaryPosition(player), player.primaryCategory].filter(Boolean).join(' · ')));
      const figures = el('span','squad-followup-player-figures',
        'Présence ' + (stats?.attendance.rate === null || !stats ? '—' : stats.attendance.rate + ' %') + ' · ' + (stats ? playerStatsDisplay(stats,'minutes') : '—') + ' min');
      button.append(squadCardAvatar(player), info, figures);
      button.onclick = () => { selected = player.id; paint(); panel.scrollIntoView({block:'start'}); };
      list.append(button);
    }
    individual.append(list);
    content.append(general, individual);
  }
  function paint() {
    const players=squadPlayers(), snapshot=playerStatsSeasonSnapshot(playerStatsCurrentSeason());
    content.replaceChildren();
    if(!players.length){content.append(el('p','hint','Aucun joueur dans cette équipe : ajoutez vos joueurs depuis « Ajouter mes joueurs ».'));return;}
    const stats=selected&&snapshot.players.get(selected);
    if(!stats){selected=null;paintOverview(snapshot,players);return;}
    const back=el('button','squad-followup-back','‹ Tous les joueurs');back.type='button';
    back.onclick=()=>{selected=null;paint();};
    const head=el('div','squad-followup-head');head.append(squadCardAvatar(stats.player),el('h3','',stats.player.name));
    content.append(back,head);
    const metrics=el('p','squad-followup-metrics');metrics.textContent=playerStatsDisplay(stats,'minutes')+' min · Présence '+(stats.attendance.rate===null?'—':stats.attendance.rate+' %')+' · '+playerStatsDisplay(stats,'goals')+' buts · '+playerStatsDisplay(stats,'assists')+' passes · Jaunes '+playerStatsDisplay(stats,'yellowCards')+' / Rouges '+playerStatsDisplay(stats,'redCards');content.append(metrics);
    content.append(el('h4','','Historique des bilans'));
    for(const report of [...stats.reports].reverse())content.append(el('p','squad-followup-history',report.date+' · '+report.title+' · '+(report.minutes||'—')+' min · Buts '+(report.goals||'—')+' / Passes '+(report.assists||'—')+' · Jaunes '+(report.yellowCards||'—')+' / Rouges '+(report.redCards||'—')));
    if(!stats.reports.length)content.append(el('p','hint','Aucun bilan enregistré pour cette saison.'));
    content.append(el('h4','','Présences aux séances'));
    for(const entry of [...stats.attendance.entries].reverse())content.append(el('p','squad-followup-history',entry.date+' · '+entry.time+' · '+entry.title+' · '+({present:'Présent',absent:'Absent',uncertain:'À confirmer'}[entry.status]||'À confirmer')));
    if(!stats.attendance.entries.length)content.append(el('p','hint','Aucun pointage enregistré pour cette saison.'));
  }
  function show(on) {active=on;squadDialog.classList.toggle('squad-followup-mode',on);panel.hidden=!on;roster.setAttribute('aria-pressed',String(!on));follow.setAttribute('aria-pressed',String(on));if(on)paint();}
  roster.onclick=()=>show(false);follow.onclick=()=>{selected=null;show(true);};
  const before=squadRender;squadRender=function(...args){const result=before.apply(this,args);if(active)paint();return result;};
  if (window.monthlyPlayerReview) {
    const openMonth = monthlyPlayerReview.open;
    monthlyPlayerReview.open = function(...args) { show(false); return openMonth.apply(this,args); };
  }
  show(false);
});

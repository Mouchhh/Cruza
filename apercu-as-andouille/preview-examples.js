// Fictional editable examples, initialized once. No network/service/account writes.
(() => {
 'use strict';
 document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
  const marker='andouille-preview-examples-v1';
  try{
   if(cruzaDemoLocalStorage.getItem(marker)==='ready')return;
   const today=homeClubNow().day,day=n=>agendaCalendarAdd(today,n);
   const positions=['Gardien','Défenseur','Défenseur','Défenseur','Défenseur','Milieu','Milieu','Milieu','Attaquant','Attaquant','Attaquant','Milieu','Défenseur','Attaquant','Milieu','Gardien'];
   const roster=Array.from({length:16},(_,i)=>({id:'preview-player-'+(i+1),name:'Joueur '+String(i+1).padStart(2,'0'),firstName:'Joueur',lastName:String(i+1).padStart(2,'0'),nickname:'J'+String(i+1).padStart(2,'0'),photo:'',position:positions[i]}));
   squadSave(roster);
   const titles=['Sortir du pressing','Conserver et progresser','Relancer sous pression'];
   trainingLibrary=titles.map((title,i)=>{
    const s=trainingAssistantGenerate({objectives:['ball-build'],level:'U17 Régional',players:'14 + 2',space:'half'});
    s.title=title;s.date=day([3,1,-3][i]);s.time='18:30';s.libraryOnly=false;delete s.agendaLink;s.updatedAt=new Date().toISOString();
    if(i===2)s.attendance={version:1,source:'manual',date:s.date,time:s.time,validatedAt:s.date+'T21:00:00Z',rows:roster.map((p,j)=>({id:p.id,name:p.name,status:j===4?'absent':j===12?'uncertain':'present',keeper:p.position==='Gardien',included:true}))};
    if(!trainingValid(s))throw Error('Exemple de séance invalide');return s;
   });
   coachStorageSet('vestiaire-training-library',JSON.stringify(trainingLibrary));
   const fixture=agendaClubFixtures().find(f=>f.id==='match-precedent');
   if(fixture){
    const source=newBlankMatch({key:fixture.key,date:fixture.date,opponent:fixture.opponent,match:fixture.title,title:'Causerie · Match de démonstration'});
    source.notes='Préparation fictive pour explorer le nouveau style.';
    source.players=roster.map((p,i)=>({id:'preview-pion-'+(i+1),squadPlayerId:p.id,name:p.name,number:i+1,photo:'',role:i<11?'starter':'sub',x:i<11?layouts['4-3-3'][i][0]:92,y:i<11?layouts['4-3-3'][i][1]:20+(i-11)*14,...(i<11?{formationSlot:i}:{benchX:92,benchY:20+(i-11)*14,subSlot:i-11})}));
    source.matchPreparation.context='Confirmer nos progrès collectifs et rester patients avec le ballon.';
    source.matchPreparation.objectives=['Réagir ensemble à la perte','Trouver le joueur libre','',''];
    source.matchPreparation.defensive='Fermer l’axe et accompagner le pressing.';
    source.matchPreparation.offensive='Garder de la largeur pour progresser ensemble.';
    source.documentCompletion={version:1,kind:'causerie',at:new Date().toISOString(),fingerprint:documentCompletionFingerprint(source)};
    saves.push({date:new Date().toISOString(),state:source});coachStorageSet('vestiaire-saves',JSON.stringify(saves));
    const event=matchContinuity.events().find(e=>e.fff?.key===fixture.key);
    if(event){
     const report=matchContinuity.reportPayload(event);
     if(report){report.info.goalsFor='2';report.info.goalsAgainst='1';report.analysis.topAttack='Bonne utilisation de la largeur. Réaction à la perte à renforcer.';report.plan.priority='Réagir ensemble à la perte du ballon.';report.updatedAt=new Date().toISOString();report.documentCompletion={version:1,kind:'report',at:new Date().toISOString(),fingerprint:documentCompletionFingerprint(report)};reportLibrary=[report];coachStorageSet('vestiaire-reports',JSON.stringify(reportLibrary));currentReport=structuredClone(report);coachStorageSet('vestiaire-report-draft',JSON.stringify(currentReport));}
    }
    if(!matchWorkspaceInstall(source))throw Error('Préparation locale non installée');
   }
   currentTraining=structuredClone(trainingLibrary[0]);coachStorageSet('vestiaire-training-draft',JSON.stringify(currentTraining));
   renderTrainingLibrary();syncTrainingForm();renderReportLibrary();renderReportContent();renderSaves();renderClubHomeStats();renderHomeWidgets();
   cruzaDemoLocalStorage.setItem(marker,'ready');
   workspaceNavigation.run('view-home');
   window.visualPreviewReady=true;
  }catch(error){
   window.visualPreviewReady=false;
   const note=document.querySelector('#visual-preview-banner small');if(note)note.textContent='Exemples partiels : stockage local à vérifier.';
   console.warn('Aperçu : initialisation locale non confirmée.');
  }
 })));
})();

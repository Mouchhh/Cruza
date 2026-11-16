// Fictional demonstration appointments; no SMFC calendar data.
const clubFixtureSchedules=[{id:'smfc-style-demo',ownerCoachName:'Coach Démo',team:'Stade Mayennais U17',category:'U17',season:'2026–2027',competition:'Match de démonstration',source:'Données fictives de l’aperçu',fixtures:(()=>{
 const parts=Object.fromEntries(new Intl.DateTimeFormat('fr-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 const today=parts.year+'-'+parts.month+'-'+parts.day,day=new Date(today+'T12:00:00Z').getUTCDay(),add=n=>new Date(Date.parse(today+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
 return [{id:'match-precedent',round:1,date:add(-(day||7)),time:'15:00',home:'Stade Mayennais U17',away:'Équipe démo A'},
 {id:'match-a-venir',round:2,date:add((7-day)%7||7),time:'15:00',home:'Stade Mayennais U17',away:'Équipe démo B'}];
})()}];

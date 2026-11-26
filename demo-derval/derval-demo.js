document.addEventListener('DOMContentLoaded', () => {
  const date = '2026-11-29';
  const match = 'SC Nord Atlantique Derval – Stade Mayennais';
  const id = 'demo-derval-seniors-r2-20261129';
  const labels = ['AG','9','AD','8G','6','8D','DG','DCG','DCD','DD','GB'];
  const description = {
    date, match, title: 'Régional 2 · Groupe A · Journée 8',
    round: 'Régional 2 · Journée 8',
    venue: 'Stade de la Croix Marchand 2, Derval · Synthétique',
    context: "Dimanche 29 novembre · 15 h · À l’extérieur, sur synthétique. Dernier match de R2 : 5–0 contre Blain. On adapte nos appuis et nos prises de balle dès l’échauffement. On joue 90 minutes. Garder la même exigence quel que soit le score.",
    contextDynamics: 'Derniers matchs de R2 : 5–3 contre Beaupréau, 2–0 à Orée, 5–0 contre Blain.',
    opponent: "SC Nord Atlantique Derval. Le staff confirme les repères après l’échauffement. Dès les premières relances, identifier le premier relais adverse, le côté de sortie et la profondeur à couvrir.",
    opponentStrengths: 'À observer : jeu direct, deuxièmes ballons, présence sur CPA.',
    opponentWeaknesses: 'À tester : renversement après avoir fixé un côté, courses dans le dos du latéral.',
    objectives: ['Victoire · jouer 90 minutes','Contenu · être solidaires','Qualité technique et connexion','Jouer avec ambition et plaisir'],
    defensive: "1–4–1–4–1. Bloc compact : ne rien prendre à l’intérieur ! Le 9 ferme le relais axial et oriente côté. L’ailier sort à la passe, le milieu proche couvre, le bloc avance ensemble. Le 6 garde l’axe. Un patron annonce la profondeur. Gagner les duels, rester debout dans nos 30 m.",
    offensive: "1–4–3–3. Exigence en zone basse : offrir deux solutions au porteur et jouer juste. Si l’axe ferme, prendre le temps et ressortir par l’autre côté. Occuper les cinq couloirs, étirer largeur et profondeur. Course sacrifice pour libérer le partenaire. Liberté et percussion en zone haute !",
    transitionOffDef: "Réaction dans les 7 secondes ! Le plus proche attaque le porteur, le deuxième ferme la passe intérieure. Chasser ensemble. Si leur première passe casse le pressing, tout le monde se replace côté ballon-but et le 6 protège l’axe. Pas de faute dans nos 30 mètres.",
    transitionDefOff: "À la récup haute : prendre le temps d’avance, lancer la course profonde, finir l’action. À la récup basse : trouver un relais court en 1–2 touches. Si le ballon est sous pression, sécuriser puis ressortir à l’opposé. Soyons adroits et ambitieux.",
    setPiecesAgainst: "Marquage individuel. Le gardien désigne un patron qui annonce avant le départ. Regarder ballon et joueur. Premier duel, deuxième ballon. Dès que la zone est sécurisée, le bloc ressort ensemble.",
    setPiecesFor: "Variante 1 : attaque du premier poteau, un joueur attaque la retombée. Variante 2 : corner court pour changer l’angle. Deux joueurs couvrent la transition. Tireurs, premier appel et reste défensif à valider avec le staff.",
    specific: "Efficacité dans les deux surfaces. Déclencheur du pressing, couverture de profondeur et rôles CPA à attribuer avant le coup d’envoi.",
    closingMessage: "Jouez et surtout prenez du plaisir ! On défend ensemble, on respecte le ballon et on finit nos actions. 90 minutes avec la même envie."
  };
  const plays = [
    ['defensive','Fermer l’axe et enfermer côté', [[['9',49,32],['AD',67,33],['6',51,59],['ball',75,25,'pass']],[['AD',74,28],['8D',70,47],['DD',78,61],['9',62,35]]]],
    ['offensive','Attirer, ressortir et renverser', [[['ball',35,69,'pass'],['6',45,56],['DG',12,54]],[['ball',45,56,'pass'],['AD',88,25],['DD',87,53]],[['ball',87,53,'pass'],['8D',67,35],['AD',91,18]]]],
    ['offDef','7 secondes après la perte', [[['AD',75,34],['8D',64,37],['9',61,27],['ball',75,35,'move']],[['AD',77,35],['8D',67,37],['6',52,53],['DD',78,47]]]],
    ['defOff','Récupérer et attaquer la profondeur', [[['ball',50,48,'pass'],['6',50,48],['9',53,22],['AG',20,19]],[['ball',53,22,'pass'],['AD',85,18],['8G',38,34]],[['ball',52,12,'move'],['9',52,12],['AG',29,14]]]]
  ];
  const entries = plays.map(([phase,title,steps],i) => {
    const sequenceId = id+'-'+phase;
    const tokens = labels.map((label,n) => ({id:label,label,side:'own',x:layouts['4-3-3'][n][0],y:layouts['4-3-3'][n][1]}));
    tokens.push({id:'a1',label:'4',side:'away',x:55,y:22},{id:'a2',label:'8',side:'away',x:72,y:37},{id:'a3',label:'6',side:'away',x:45,y:43});
    const ball = [{x:55,y:22},{x:50,y:87},{x:72,y:37},{x:53,y:54}][i];
    const state = {sequenceId,sequenceTitle:title,scenario:'custom',step:0,showOpponents:true,tokens,ball,customBase:{tokens:structuredClone(tokens),ball:{...ball}},customSteps:steps.map(step=>step.map(([id,x,y,type='move'])=>({id,x,y,type:id==='ball'?'pass':type})))};
    return {id:sequenceId,title,updatedAt:'2026-11-26T15:00:00+01:00',speed:'1',choice:'forward',state};
  });
  function openEditor() {
    workspaceNavigation.run('view-pitch', () => {
      if (!activateTerrainBoard('composition')) return;
      workspaceFlows.terrain.go(1);
      renderMatchPreparation();
    });
  }
  try {
    if (!entries.every(simpleSequenceValid)) throw Error('Séquences invalides');
    if (!coachStorageGet('cruza-demo-derval-seeded')) {
      const board = newBlankMatch({date,match});
      board.documentId = id;
      board.title = 'Causerie · J8 · Derval – Stade Mayennais';
      board.category = 'Seniors';
      board.squad = 'Seniors R2';
      board.matchDuration = '90';
      board.players = labels.map((name,i) => ({id:'derval-poste-'+i,name,number:[11,9,7,8,6,10,3,4,5,2,1][i],x:layouts['4-3-3'][i][0],y:layouts['4-3-3'][i][1],role:'starter',photo:''}));
      board.matchPreparation = {...board.matchPreparation,...description};
      board.causerieSlideAnimations = Object.fromEntries(plays.map(([phase],i)=>[phase,[entries[i]]]));
      if (!matchWorkspaceInstall(board)) throw Error('Causerie invalide');
      simpleCommitLibrary([...entries,...simpleLibrary.filter(e=>!entries.some(x=>x.id===e.id))]);
      coachStorageSet('cruza-demo-derval-seeded','true');
    }
    const shortcuts = el('div','demo-derval-shortcuts');
    shortcuts.append(el('strong','','Démo Seniors R2 · Derval'));
    const button = (label, action) => {
      const item=el('button','export',label);
      item.type='button';
      item.onclick=action;
      shortcuts.append(item);
    };
    button('Ouvrir la causerie',openEditor);
    entries.forEach((entry,i) => button(['Défense','Attaque','À la perte','À la récupération'][i],() => {
      if ($('task-causerie').getBoundingClientRect().width) {
        const close=[...document.querySelectorAll('.causerie-clean-actions button')].find(b=>b.textContent==='Fermer la causerie');
        close?.click();
      }
      if (simpleExplanationOpen(entry)) startAnimation(true);
    }));
    $('task-causerie').prepend(shortcuts);
    const back=el('button','export','Retour à la causerie Derval');
    back.type='button';
    back.onclick=openEditor;
    $('simple-board').prepend(back);
    openEditor();
  } catch(error) {
    console.error(error);
    notify('La démo Derval n’a pas pu s’ouvrir dans ce navigateur.');
  }
});

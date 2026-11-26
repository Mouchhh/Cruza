function trainingCoachLanguage(value) {
  return String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/[’'\p{Pd}]/gu, " ").replace(/\s+/g, " ");
}

const trainingCoachIntentions = [
  { objective: "ball-build", request: /ressortir (?:proprement|sous pression|court)|repartir de derriere|sortir (?:du|sous le) pressing|relance courte/,
    cue: "Ressortir proprement sous pression en proposant des solutions courtes au porteur.",
    exercise: /relance|sortie de balle|jeu au pied|sortir du pressing/ },
  { objective: "ball-control", request: /fixer.{0,45}(?:renverser|liberer|decaler|autre cote|oppose)|renvers\w*|cote oppose|chang\w* de cote/,
    cue: "Attirer le bloc d’un côté, puis jouer vite vers le côté opposé quand il se libère.",
    exercise: /fixer.{0,25}liberer|renversement|renverser|cote oppose|changement de cote/ },
  { objective: "ball-control", request: /casser les lignes|entre les lignes|troisieme (?:joueur|homme)|jouer dans le dos du milieu/,
    cue: "Se rendre disponible entre les lignes, s’orienter avant de recevoir et jouer vers l’avant si la passe est ouverte.",
    exercise: /entre les lignes|casser.{0,15}lignes|troisieme (?:joueur|homme)|franchir.{0,15}lignes/ },
  { objective: "loss-press", request: /(?:des|a) la perte.{0,40}(?:recuper\w*|press\w*|reagi\w*|bond\w*)|(?:recuper\w*|press\w*|reagi\w*).{0,45}(?:a|apres) la perte|contre pressing/,
    cue: "À la perte, le plus proche presse le porteur et les partenaires ferment les solutions courtes.",
    exercise: /contre pressing|perte|reaction a la perte|transition defensive/ },
  { objective: "off-high", request: /passe en retrait|mauvais controle|declencheur.{0,25}pressing/,
    cue: "Déclencher le pressing ensemble sur le signal demandé par le coach.",
    exercise: /pressing|piege|declenche|presser/ },
  { objective: "off-control", request: /rester compact|bloc compact|resserrer les lignes|fermer l axe|proteger l axe/,
    cue: "Rester serrés entre les lignes et protéger l’axe pendant le déplacement du ballon.",
    exercise: /bloc compact|bloc equipe|fermer l axe|couliss|deux lignes|proteger l axe/ },
  { objective: "win-score", request: /(?:recuperation|recupere).{0,60}(?:jouer vite|se projeter|attaquer vite|vers l avant)|(?:jouer vite|se projeter).{0,45}recuperation/,
    cue: "Dès la récupération, repérer une passe vers l’avant et déclencher des courses de soutien.",
    exercise: /recuperation|contre attaque|transition offensive|se projeter/ },
  { objective: "ball-finish", request: /centre en retrait|attaquer (?:le premier|le second|le deuxieme) poteau|arriver lance.{0,25}surface/,
    cue: "Coordonner les courses dans la surface avec le départ du centreur et attaquer des zones différentes.",
    exercise: /centre en retrait|premier poteau|second poteau|deuxieme poteau|finition sur centre/ },
];

function trainingCoachApproach(phrase) {
  const cues = [];
  const discovery = /(?:laiss\w*|je veux qu ils).{0,40}(?:chercher|trouver.{0,20}(?:seuls|eux memes)|essayer|se debrouiller)|qu ils trouvent.{0,20}eux memes|autonomie/.test(phrase);
  const questions = /guid\w*.{0,25}questions?|pos\w*.{0,25}questions?|faire verbaliser|qu ils expliquent leurs choix/.test(phrase);
  const fewStops = /(?:pas|evit\w*|moins|sans).{0,35}(?:arreter|couper|interrompre)|laiss\w*.{0,20}jouer|ne pas trop intervenir/.test(phrase);
  const demonstration = /(?:montr\w*|demonstration).{0,30}(?:debut|d abord|avant)|(?:debut|d abord|avant).{0,25}(?:montr\w*|demonstration)/.test(phrase);
  const lowWait = /pas de file|sans file|evit\w*.{0,25}(?:attente|files?)|tout le monde joue|beaucoup de repetitions/.test(phrase);
  const light = /(?:veille|lendemain) (?:de match|du match)|recuperation active|garder.{0,22}(?:frais|fraicheur)|pas.{0,22}charger physiquement|charge (?:legere|reduite)/.test(phrase);
  if (demonstration) cues.push("Avant de jouer, montrer brièvement un exemple et faire reformuler un seul point clé.");
  if (discovery) cues.push("Au premier passage, donner le but de l’exercice puis laisser les joueurs essayer plusieurs solutions avant d’intervenir.");
  if (questions) cues.push("Entre deux passages, demander « Qu’as-tu vu ? » puis « Que pourrais-tu essayer ensuite ? ». Rejouer pour vérifier leur réponse.");
  if (fewStops) cues.push("Pendant le jeu, observer et donner un retour individuel bref si nécessaire. Garder les corrections collectives pour les pauses.");
  if (lowWait) cues.push("Installer les espaces avant de lancer l’exercice et répartir les joueurs pour que plusieurs groupes jouent en même temps.");
  if (light) cues.push("Réduire la charge et garder des pauses. Chercher la qualité des décisions et des gestes plutôt que le volume.");
  return { cues, lowWait, light };
}

function trainingVoiceCriteria(request) {
  const units = ["zero", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
    "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix sept", "dix huit", "dix neuf"];
  const numbers = new Map(units.map((word, value) => [word, value]));
  for (const [word, value] of [["vingt", 20], ["trente", 30], ["quarante", 40], ["cinquante", 50], ["soixante", 60], ["quatre vingt", 80]]) {
    numbers.set(word, value);
    for (let offset = 1; offset <= (value === 60 || value === 80 ? 19 : 9); offset++) {
      const connector = value !== 80 && (offset === 1 || (value === 60 && offset === 11)) ? " et " : " ";
      numbers.set(word + connector + units[offset], value + offset);
    }
  }
  numbers.set("quatre vingts", 80);
  numbers.set("une", 1);
  const numberWords = [...numbers.keys()].sort((a, b) => b.length - a.length).join("|");
  const normalized = trainingCoachLanguage(request);
  const phrase = normalized.replace(new RegExp("\\b(?:" + numberWords + ")\\b", "g"), word => String(numbers.get(word)));
  const themes = [
    ["loss-press", /\b(?:contre pressing|pressing a la perte|reaction a la perte|transition defensive)\b/],
    ["loss-slow", /\b(?:repli|ralentir l attaque|freiner l attaque)\b/],
    ["off-high", /\b(?:pressing|defendre haut|presser haut|pression haute)\b/],
    ["off-low", /\b(?:defendre bas|bloc bas|proteger le but|defense basse)\b/],
    ["off-control", /\b(?:bloc median|bloc equipe|organisation defensive|coulisser|coulissement|defendre en bloc)\b/],
    ["win-score", /\b(?:contre attaque|contre attaques|transition offensive|attaquer rapidement)\b/],
    ["win-forward", /\b(?:sortir de la recuperation|jouer vers l avant|premiere passe apres recuperation)\b/],
    ["ball-build", /\b(?:relance|relancer|sortie de balle|sorties de balle|construire le jeu|jeu au pied)\b/],
    ["ball-control", /\b(?:conservation|conserver|possession|demarquage|progresser|jeu entre les lignes|rondo|surnombre)\b/],
    ["ball-finish", /\b(?:finition|finir|frappes?|tirs?|finalisation|marquer)\b/],
    ["ludic-game", /\b(?:ludique|jeux et defis)\b/],
  ];
  const intentions = trainingCoachIntentions.filter(intent => intent.request.test(normalized));
  const objectives = [...new Set([...intentions.map(intent => intent.objective), ...themes.flatMap(([key, pattern]) => {
    const match = pattern.exec(phrase);
    return match ? [{ key, index: match.index }] : [];
  }).sort((a, b) => a.index - b.index).map(({key}) => key)])];
  if (objectives.includes("loss-press") && !/\b(?:defendre haut|presser haut|pressing haut|pression haute)\b/.test(phrase)) {
    const index = objectives.indexOf("off-high");
    if (index >= 0) objectives.splice(index, 1);
  }

  const group = phrase.match(/\b(?:u\s*(\d{1,2})\s*(f\b)?|(seniors?|veterans?))\b/);
  const competition = phrase.match(/\b(?:regional(?:e)?|departemental(?:e)?|national(?:e)?|district|r[123]|d[1234])\b/);
  const level = group && [group[1] ? "U" + group[1] + (group[2] || "").toUpperCase() : group[3], competition?.[0]].filter(Boolean).join(" ");
  const counts = phrase.match(/\b(\d+)\s*(?:joueurs?(?: de champ)?\s*)?(dont|\+|et|avec|plus)\s*(\d+)\s*(?:gardiens?|gb)\b/) || phrase.match(/\b(\d+)\s*(\+)\s*(\d+)\b/);
  const field = phrase.match(/\b(\d+)\s+joueurs?(?: de champ)?\b/);
  const keepers = phrase.match(/\b(\d+)\s+(?:gardiens?|gb)\b/);
  const players = counts ? counts[1] + (counts[2] === "dont" ? " dont " : " + ") + counts[3]
    : field && (keepers && /joueurs? de champ/.test(phrase) ? field[1] + " + " + keepers[1] : field[1]);
  const space = /\b(?:quart|1\/4)\s*(?:de\s+)?terrain\b/.test(phrase) ? "quarter"
    : /\b(?:demi|moitie|1\/2)\s*(?:de\s+)?terrain\b/.test(phrase) ? "half"
    : /\b(?:terrain complet|terrain entier|grand terrain|tout le terrain)\b/.test(phrase) ? "full" : "";
  const hours = phrase.match(/\b(\d+)\s*(?:heures?\b|h(?=\s|\d|$))\s*(?:(\d+)(?!\d)(?!\s*(?:joueurs?|gardiens?))|(?:et\s+)?demie?)?/);
  const minutes = phrase.match(/\b(\d+)\s*(?:min\b|minutes?\b)/);
  const duration = hours ? Number(hours[1]) * 60 + Number(hours[2] || (/demie?/.test(hours[0]) ? 30 : 0))
    : minutes ? Number(minutes[1]) : null;
  const physical = /\b(?:sans (?:travail )?physique|pas de physique)\b/.test(phrase) ? "none"
    : /\b(?:pliometrie|renforcement|force)\b/.test(phrase) ? "plyo"
    : /\b(?:endurance|intermittent|cardio)\b/.test(phrase) ? "endurance"
    : /\b(?:vitesse|sprints?)\b/.test(phrase) ? "speed" : "";
  const organisation = /\b2\s+(?:ateliers|groupes)(?:\s+separes)?\b/.test(phrase) ? "two" : "";
  return { objectives, level, players, space, duration, physical, organisation, intentions, approach: trainingCoachApproach(normalized), request: request.trim(), numbered: phrase };
}

function trainingVoiceInput(form, apply, options = {}) {
  const box = el("section", "training-assistant-voice");
  const title = el("h3", "", options.title || "Décrivez votre séance");
  const label = el("label", "report-field", "Votre demande");
  const input = el("textarea");
  input.name = "coachRequest";
  input.rows = 3;
  input.maxLength = 1000;
  input.placeholder = options.placeholder || "Ex. Avec mes U17, je veux qu’on renverse vite. Je veux les laisser chercher et les guider avec des questions. 16 joueurs, 90 min sur demi-terrain.";
  label.append(input);
  const actions = el("div", "report-actions");
  const mic = el("button", "export", "🎙 Dicter");
  const fill = el("button", "export", options.button || "Analyser la demande");
  mic.type = fill.type = "button";
  const status = el("p", "hint");
  status.setAttribute("role", "status");
  const Recognition = window.cruzaDictationEnabled && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const hint = el("p", "hint", Recognition
    ? "La dictée utilise le service vocal de votre navigateur. Vérifiez le texte avant de continuer."
    : "La dictée est indisponible dans ce navigateur. Vous pouvez écrire votre demande ou utiliser la dictée de votre clavier.");
  mic.hidden = !Recognition;
  hint.hidden = !window.cruzaDictationEnabled;
  actions.append(mic, fill);
  box.append(title, label, actions, hint, status);
  form.prepend(box);

  let recognition, committed, feedback;
  function reset() {
    recognition = null;
    input.readOnly = false;
    fill.disabled = false;
    mic.disabled = false;
    mic.textContent = "🎙 Dicter";
  }
  mic.onclick = () => {
    if (recognition) {
      mic.disabled = true;
      recognition.stop();
      return;
    }
    const base = input.value.trimEnd();
    try {
      const current = new Recognition();
      recognition = current;
      committed = base;
      feedback = "";
      current.lang = "fr-FR";
      current.continuous = true;
      current.interimResults = true;
      current.onresult = event => {
        if (recognition !== current) return;
        const final = [], interim = [];
        for (const result of event.results) (result.isFinal ? final : interim).push(result[0].transcript.trim());
        committed = [base, ...final].filter(Boolean).join(" ").slice(0, input.maxLength);
        input.value = [committed, ...interim].filter(Boolean).join(" ").slice(0, input.maxLength);
      };
      current.onerror = event => {
        if (recognition !== current) return;
        feedback = ["not-allowed", "service-not-allowed"].includes(event.error)
          ? "Micro refusé. Autorisez-le dans le navigateur ou écrivez votre demande."
          : "La dictée a été interrompue. Réessayez ou écrivez votre demande.";
        status.textContent = feedback;
      };
      current.onend = () => {
        if (recognition !== current) return;
        input.value = committed;
        reset();
        status.textContent = feedback || (committed === base ? "Aucune parole reconnue. Réessayez." : "Dictée terminée. Vérifiez la transcription.");
      };
      current.start();
      input.readOnly = fill.disabled = true;
      mic.textContent = "Arrêter la dictée";
      status.textContent = "Écoute en cours…";
    } catch {
      reset();
      status.textContent = "Impossible d’activer le micro. Vous pouvez écrire votre demande.";
    }
  };
  fill.onclick = () => {
    if (!input.value.trim()) {
      status.textContent = "Décrivez d’abord votre demande.";
      input.focus();
      return;
    }
    status.textContent = apply(options.raw ? { request: input.value.trim() } : trainingVoiceCriteria(input.value));
  };
  function cancel() {
    if (!recognition) return;
    const current = recognition;
    input.value = committed;
    reset();
    current.abort();
    status.textContent = "";
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancel(); });
  window.addEventListener("pagehide", cancel);
  new MutationObserver(() => { if (!document.body.classList.contains("training-mode")) cancel(); })
    .observe(document.body, { attributes: true, attributeFilter: ["class"] });
  return cancel;
}

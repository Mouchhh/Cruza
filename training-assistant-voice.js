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
  const normalized = request.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
    .replace(/[’'\p{Pd}]/gu, " ").replace(/\s+/g, " ");
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
  const objectives = themes.flatMap(([key, pattern]) => {
    const match = pattern.exec(phrase);
    return match ? [{ key, index: match.index }] : [];
  }).sort((a, b) => a.index - b.index).map(({key}) => key);
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
  return { objectives, level, players, space, duration, physical, organisation };
}

function trainingVoiceInput(form, apply) {
  const box = el("section", "training-assistant-voice");
  const title = el("h3", "", "Décrivez votre séance");
  const label = el("label", "report-field", "Votre demande");
  const input = el("textarea");
  input.rows = 3;
  input.maxLength = 1000;
  input.placeholder = "Ex. Une séance U17 de 90 minutes sur demi-terrain, avec 16 joueurs dont 2 gardiens, pour travailler la relance et la finition.";
  label.append(input);
  const actions = el("div", "report-actions");
  const mic = el("button", "export", "🎙 Dicter");
  const fill = el("button", "export", "Remplir les critères");
  mic.type = fill.type = "button";
  const status = el("p", "hint");
  status.setAttribute("role", "status");
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hint = el("p", "hint", Recognition
    ? "La dictée utilise le service vocal de votre navigateur. Vérifiez le texte avant de remplir les critères."
    : "La dictée est indisponible dans ce navigateur. Vous pouvez écrire votre demande ou utiliser la dictée de votre clavier.");
  mic.hidden = !Recognition;
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
        status.textContent = feedback || (committed === base ? "Aucune parole reconnue. Réessayez." : "Dictée terminée. Vérifiez le texte puis remplissez les critères.");
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
      status.textContent = "Décrivez d’abord votre séance.";
      input.focus();
      return;
    }
    status.textContent = apply(trainingVoiceCriteria(input.value));
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

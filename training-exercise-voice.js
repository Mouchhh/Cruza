function trainingExerciseFromRequest(criteria, session) {
  const phrase = criteria.numbered;
  const format = phrase.match(/\b(\d{1,2})\s*(?:contre|[vc]|vs)\s*(\d{1,2})\b/);
  const explicit = phrase.match(/\b(\d{1,2})\s+joueurs?\b/);
  const totalPlayers = explicit ? Number(explicit[1]) : session.players;
  const rondo = /\b(?:toro|rondo)\b/.test(phrase);
  const finish = criteria.objectives.includes("ball-finish");
  const buildup = criteria.objectives.includes("ball-build");
  const press = criteria.objectives.includes("off-high") || criteria.objectives.includes("loss-press");
  const transition = criteria.objectives.includes("win-score");
  const switchPlay = criteria.intentions.some(intent => intent.exercise.test("renversement"));
  const possession = rondo || switchPlay || /\b(?:conservation|possession)\b/.test(phrase);
  const solo = !format && !possession && /\b(?:circuit|sans opposition|encha(?:i|î)nement de passes)\b/.test(phrase);
  if (!format && !possession && !solo && !criteria.objectives.length && !/\b(?:match|jeu reduit)\b/.test(phrase))
    throw Error("Précisez un format (ex. 4 contre 2) ou un objectif (ex. un toro, une relance, de la finition).");
  const numbers = format ? [Number(format[1]), Number(format[2])]
    : rondo ? [4, 2] : solo ? [Math.max(3, Math.min(8, totalPlayers)), 0]
    : [Math.max(2, Math.min(15, Math.ceil(totalPlayers / 2))), Math.max(2, Math.min(15, Math.floor(totalPlayers / 2)))];
  const [blue, red] = numbers;
  if (explicit && !format && !rondo && !solo && totalPlayers > 30)
    throw Error("Précisez le nombre de joueurs par atelier pour cet effectif.");

  const jokers = Number(phrase.match(/\b(\d{1,2})\s+jokers?\b/)?.[1] || 0);
  const keepers = Number(phrase.match(/\b(\d{1,2})\s+(?:gardiens?|gb)\b/)?.[1] || 0);
  if (!blue || (format && !red) || blue > 15 || red > 15 || jokers > 4 || keepers > 2)
    throw Error("Pour ce schéma, indiquez 1 à 15 joueurs par équipe, jusqu’à 4 jokers et 2 gardiens.");
  const requestedSize = phrase.match(/\b(\d{1,3})\s*(?:x|×|par|sur)\s*(\d{1,3})\s*(?:m\b|metres?\b)/);
  const bounds = bibleAvailable(session);
  const width = requestedSize ? Number(requestedSize[1]) : Math.min(bounds.width, solo || rondo ? 15 : 30);
  const length = requestedSize ? Number(requestedSize[2]) : Math.min(bounds.length, solo || rondo ? 18 : 42);
  if (width < 6 || width > Math.min(68, bounds.width) || length < 6 || length > Math.min(105, bounds.length))
    throw Error("Les dimensions doivent tenir dans le terrain de la séance (" + bounds.width + " × " + bounds.length + " m).");
  const duration = criteria.duration ?? 12;
  if (duration < 1 || duration > 120) throw Error("Choisissez une durée d’exercice entre 1 et 120 minutes.");
  const touches = phrase.match(/\b(\d{1,2})\s+touches?\b/)?.[1];
  const toGoals = !rondo && !solo && (finish || keepers || /\b(?:buts?|match)\b/.test(phrase));
  const title = (rondo ? "Toro" : solo ? "Circuit de passes" : finish ? "Finition sous opposition" : switchPlay ? "Fixer et renverser" : buildup ? "Sortie de balle sous pression" : press ? "Déclencher le pressing" : transition ? "Se projeter après récupération" : possession ? "Jeu de conservation" : "Jeu réduit") +
    (red ? " · " + blue + " contre " + red : " · " + blue + " joueurs");
  const aim = criteria.intentions[0]?.cue || (rondo || possession ? "Créer un angle de passe et conserver sous pression."
    : solo ? "Enchaîner contrôle orienté, passe et déplacement." : finish ? "Se créer un angle de frappe avant que la défense se replace."
    : buildup ? "Créer deux solutions proches du porteur pour sortir de la première pression."
    : press ? "Presser ensemble en fermant la solution de passe intérieure."
    : transition ? "Jouer vers l’avant dès la récupération si une passe est ouverte."
    : "Progresser ensemble et exploiter les espaces libres.");
  const action = rondo ? "Les bleus conservent à l’extérieur. Les rouges ferment les lignes de passe. À l’interception, changer le défenseur."
    : solo ? "Jouer sur l’appui suivant puis suivre sa passe. Au premier tour, annoncer le sens de rotation."
    : switchPlay ? "Fixer les défenseurs d’un côté, passer par un appui intérieur, puis ressortir vers le côté libre."
    : buildup ? "Les bleus démarrent bas. Les rouges pressent au départ du ballon. Trouver un appui intérieur ou ressortir côté libre pour franchir la première ligne."
    : press ? "Les bleus repartent court. Au signal du pressing, le rouge le plus proche sort sur le porteur et ses partenaires couvrent les passes intérieures."
    : transition ? "Démarrer par une récupération. Chercher vite un partenaire vers l’avant, puis accompagner la passe avec des courses de soutien."
    : toGoals ? "Attaquer le but adverse en utilisant un appui. À la récupération, repartir dans l’autre sens."
    : "Conserver sous pression et changer de côté dès qu’un espace se libère. Repartir de l’autre équipe si le ballon sort.";
  const custom = {
    title, width, length, kind: possession ? "possession" : solo ? "circuit" : blue === 1 && red === 1 ? "duel" : "game",
    goal: aim,
    organisation: [red ? blue + " bleus contre " + red + " rouges" : blue + " joueurs", jokers ? jokers + " joker(s) en appui" : "", keepers ? keepers + " gardien(s)" : "", width + " × " + length + " m"].filter(Boolean).join(" · "),
    instructions: [action, touches ? touches + " touche(s) maximum par réception." : "", ...criteria.approach.cues,
      "Demande du coach : " + criteria.request].filter(Boolean).join("\n\n"),
    material: ["Ballons", "4 coupelles", red ? "Chasubles" : "", toGoals ? (keepers ? "Buts" : "Mini-buts") : ""].filter(Boolean).join(" · "),
    success: rondo ? "Réaliser une série de passes sans interception." : solo ? "Conserver la précision en accélérant l’enchaînement."
      : toGoals ? "Créer un tir après avoir trouvé un partenaire disponible." : "Sortir de la pression vers un appui libre.",
    board: trainingDictatedBoard({ blue, red, jokers, keepers, ring: rondo || solo, switchPlay, toGoals }),
  };
  if (!trainingCustomValid(custom)) throw Error("Vérifiez le format et les dimensions de l’exercice.");
  return { custom, duration };
}

function trainingDictatedBoard({ blue, red, jokers, keepers, ring, switchPlay, toGoals }) {
  const colors = { blue: "#2373d7", red: "#e44242", keeper: "#edc641", ball: "#ffffff", disc: "#ffb23e", goal: "#ffffff", mini: "#ffffff" };
  const objects = [];
  function add(type, x, y, label = "", color = colors[type], rotation = 0) {
    const id = type + "-" + objects.length;
    objects.push({ id, type, x, y, label, color, rotation, scale: 1 });
    return id;
  }
  const attackers = Array.from({ length: blue }, (_, index) => {
    const angle = index * Math.PI * 2 / blue - Math.PI / 2;
    return add("blue", ring ? 50 + Math.cos(angle) * 32 : 18 + Math.floor(index / 5) * 12,
      ring ? 50 + Math.sin(angle) * 35 : 12 + (index % 5) * 17, String(index + 1));
  });
  const defenders = Array.from({ length: red }, (_, index) =>
    add("red", ring ? 45 + Math.floor(index / 5) * 6 : 65 + Math.floor(index / 5) * 7,
      (ring ? 27 : 12) + (index % 5) * (ring ? 11 : 17), String(index + 1)));
  Array.from({ length: jokers }, (_, index) => add("blue", 51, 14 + index * 23, "J" + (index + 1), "#7f51b5"));
  Array.from({ length: keepers }, (_, index) => add("keeper", index ? 13 : 87, 50, "G" + (index + 1)));
  if (toGoals) {
    add(keepers ? "goal" : "mini", 5, 50, "", undefined, 90);
    add(keepers ? "goal" : "mini", 95, 50, "", undefined, 270);
  }
  for (const [x, y] of [[10, 9], [90, 9], [10, 91], [90, 91]]) add("disc", x, y);
  const find = id => objects.find(object => object.id === id);
  const holder = find(attackers[0]);
  const receiver = find(attackers[Math.min(1, blue - 1)]);
  const third = find(attackers[switchPlay ? Math.min(4, blue - 1) : Math.min(2, blue - 1)]);
  const ball = add("ball", holder.x + 3, holder.y + 2);
  const pressed = find(defenders[0]);
  const pressure = pressed && { x: Math.max(9, Math.min(91, holder.x + 9)), y: Math.max(10, Math.min(90, holder.y + 7)) };
  const frames = [{ objects }];
  function frame(moves) {
    frames.push({ objects: frames.at(-1).objects.map(object => ({ ...object, ...moves[object.id] })) });
  }
  if (pressed) frame({ [pressed.id]: pressure });
  const dribble = blue === 1 ? { x: holder.x + 12, y: holder.y + 5 } : null;
  frame({ [ball]: { x: (dribble || receiver).x + 3, y: (dribble || receiver).y + 2 },
    ...(ring ? {} : { [holder.id]: dribble || { x: holder.x + 10, y: holder.y + 5 } }) });
  frame({ [ball]: toGoals ? { x: 94, y: 50 } : { x: (dribble || third).x + 3, y: (dribble || third).y + 2 } });
  return { version: 1, lines: toGoals, seconds: 1.5, frames };
}

document.addEventListener("DOMContentLoaded", () => {
  const dialog = $("custom-training-dialog");
  const sheet = $("exercise-studio-sheet");
  if (!sheet) return;
  const voice = el("div", "exercise-studio-voice");
  const toggle = el("details");
  const preview = el("div", "exercise-voice-preview");
  toggle.append(el("summary", "", "Créer un exercice à la voix"), voice, preview);
  sheet.prepend(toggle);
  const cancel = trainingVoiceInput(voice, criteria => {
    try {
      const { custom, duration } = trainingExerciseFromRequest(criteria, currentTraining);
      if (($("custom-training-title").value.trim() || exerciseEnabled) &&
        !confirm("Remplacer le texte et le terrain affichés par cet exercice ? Vos changements seront appliqués à la validation.")) return "Exercice actuel conservé.";
      for (const key of [...Object.keys(customTrainingLabels), "kind", "width", "length"]) $("custom-training-" + key).value = custom[key];
      $("custom-training-duration").value = String(duration);
      exercisePlayback++;
      exerciseDraft = custom.board;
      exerciseFrame = 0;
      exerciseSelected = null;
      exerciseEnabled = true;
      $("exercise-lines").checked = exerciseDraft.lines;
      $("exercise-seconds").value = exerciseDraft.seconds;
      exerciseEditorRefresh();
      const adjust = el("button", "export", "Retoucher le terrain");
      adjust.type = "button";
      adjust.onclick = () => $("studio-tab-board").click();
      preview.replaceChildren(exerciseBoardPreview(exerciseDraft, custom.title), adjust);
      return "Exercice préparé. Lancez l’animation ci-dessous, puis enregistrez l’exercice.";
    } catch (error) {
      return error.message;
    }
  }, {
    title: "Décrivez votre exercice",
    button: "Créer l’exercice",
    placeholder: "Ex. Un toro 4 contre 2 sur 12 × 15 m, deux touches, 10 minutes. Laissez-les chercher avant d’intervenir.",
  });
  const shortcut = el("button", "export", "Créer un exercice à la voix");
  shortcut.type = "button";
  function showVoice() {
    $("studio-tab-sheet").click();
    toggle.open = true;
    voice.querySelector("textarea").focus();
  }
  shortcut.onclick = () => {
    openCustomTrainingExercise();
    if (dialog.open) showVoice();
  };
  $("training-custom-add").after(shortcut);
  const studioShortcut = el("button", "export", "Décrire à la voix");
  studioShortcut.type = "button";
  studioShortcut.onclick = showVoice;
  $("custom-training-close").before(studioShortcut);
  dialog.addEventListener("close", () => {
    cancel();
    voice.querySelector("textarea").value = "";
    voice.querySelector("[role=status]").textContent = "";
    preview.replaceChildren();
    toggle.open = false;
  });
});

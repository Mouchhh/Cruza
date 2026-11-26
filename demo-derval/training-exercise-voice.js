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

  const jokers = Number(phrase.match(/\b(\d{1,2})\s+(?:jokers?|appuis?)\b/)?.[1] || 0);
  const outside = jokers > 0 && /\b(?:jokers?|appuis?)\b.{0,35}\b(?:exterieurs?|sur les cotes|sur les lignes|couloirs?)\b/.test(phrase);
  const miniGoals = Number(phrase.match(/\b(\d{1,2})\s+(?:mini buts?|petits buts?|petites cages)\b/)?.[1] || 0);
  if (miniGoals > 4) throw Error("Le schéma peut représenter jusqu’à quatre mini-buts.");
  const lanes = /\b(?:2|3)\s+(?:zones?|couloirs?)\b/.exec(phrase);
  const laneCount = lanes ? Number(lanes[0][0]) : 0;
  const backPass = press && /\b(?:passe en retrait|ballon en retrait|joue en arriere)\b/.test(phrase);
  const reverseSide = /\b(?:de droite a gauche|(?:fix\w*|attir\w*).{0,25}a droite)\b/.test(phrase);
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
  const toGoals = !/\b(?:sans buts?|sans cages?)\b/.test(phrase) &&
    (miniGoals > 0 || !rondo && !solo && (finish || keepers || /\b(?:buts?|match)\b/.test(phrase)));
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
    : backPass ? "La passe en retrait déclenche le pressing. Le rouge le plus proche sort sur le receveur pendant que les autres ferment l’axe."
    : press ? "Les bleus repartent court. Au signal du pressing, le rouge le plus proche sort sur le porteur et ses partenaires couvrent les passes intérieures."
    : transition ? "Démarrer par une récupération. Chercher vite un partenaire vers l’avant, puis accompagner la passe avec des courses de soutien."
    : toGoals ? "Attaquer le but adverse en utilisant un appui. À la récupération, repartir dans l’autre sens."
    : "Conserver sous pression et changer de côté dès qu’un espace se libère. Repartir de l’autre équipe si le ballon sort.";
  const custom = {
    title, width, length, kind: possession ? "possession" : solo ? "circuit" : blue === 1 && red === 1 ? "duel" : "game",
    goal: aim,
    organisation: [red ? blue + " bleus contre " + red + " rouges" : blue + " joueurs", jokers ? jokers + (outside ? " appui(s) extérieur(s)" : " joker(s) en appui") : "", laneCount ? laneCount + " couloirs matérialisés" : "", keepers ? keepers + " gardien(s)" : "", width + " × " + length + " m"].filter(Boolean).join(" · "),
    instructions: [action, outside ? "Les appuis restent sur les côtés et jouent avec l’équipe qui a le ballon." : "",
      miniGoals && toGoals ? "Les équipes peuvent marquer dans les mini-buts du camp adverse." : "", touches ? touches + " touche(s) maximum par réception." : "", ...criteria.approach.cues,
      "Demande du coach : " + criteria.request].filter(Boolean).join("\n\n"),
    material: ["Ballons", laneCount ? "Coupelles pour les couloirs et les limites" : "4 coupelles", red ? "Chasubles" : "", toGoals ? (miniGoals ? miniGoals + " mini-but(s)" : keepers ? "Buts" : "Mini-buts") : ""].filter(Boolean).join(" · "),
    success: rondo ? "Réaliser une série de passes sans interception." : solo ? "Conserver la précision en accélérant l’enchaînement."
      : toGoals ? "Créer un tir après avoir trouvé un partenaire disponible." : "Sortir de la pression vers un appui libre.",
    board: trainingDictatedBoard({ blue, red, jokers, keepers, ring: rondo || solo, switchPlay, toGoals, miniGoals, outside, laneCount, backPass, reverseSide }),
  };
  if (!trainingCustomValid(custom)) throw Error("Vérifiez le format et les dimensions de l’exercice.");
  return { custom, duration };
}

function trainingDictatedBoard({ blue, red, jokers, keepers, ring, switchPlay, toGoals, miniGoals, outside, laneCount, backPass, reverseSide }) {
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
  const supports = Array.from({ length: jokers }, (_, index) =>
    add("blue", outside ? (index < 2 ? 52 : 72) : 51,
      outside ? (index % 2 ? 94 : 6) : 14 + index * 23, "J" + (index + 1), "#7f51b5"));
  Array.from({ length: keepers }, (_, index) => add("keeper", index ? 13 : 87, 50, "G" + (index + 1)));
  const goals = [];
  if (toGoals) {
    const count = miniGoals || 2;
    for (let index = 0; index < count; index++) {
      const left = index % 2 === 1;
      const y = count <= 2 || count === 3 && left ? 50 : index < 2 ? 25 : 75;
      goals.push(add(miniGoals || !keepers ? "mini" : "goal", left ? 5 : 95, y, "", undefined, left ? 90 : 270));
    }
  }
  for (const [x, y] of [[10, 9], [90, 9], [10, 91], [90, 91]]) add("disc", x, y);
  for (let lane = 1; lane < laneCount; lane++) {
    const y = 9 + 82 * lane / laneCount;
    for (const x of [10, 30, 50, 70, 90]) add("disc", x, y);
  }
  const find = id => objects.find(object => object.id === id);
  const wide = attackers.map(find).sort((a, b) => a.y - b.y);
  const holder = backPass ? find(attackers.at(-1))
    : switchPlay && reverseSide ? wide.at(-1) : find(attackers[0]);
  const receiver = backPass ? find(attackers[0])
    : switchPlay && outside ? find(supports[reverseSide && supports.length > 1 ? 1 : 0])
    : find(attackers[Math.min(1, blue - 1)]);
  const third = switchPlay ? (reverseSide ? wide[0] : wide.at(-1)) : find(attackers[Math.min(2, blue - 1)]);
  const ball = add("ball", holder.x + 3, holder.y + 2);
  const pressed = find(defenders[0]);
  const target = backPass ? receiver : holder;
  const pressure = pressed && { x: Math.max(9, Math.min(91, target.x + 9)), y: Math.max(10, Math.min(90, target.y + 7)) };
  const frames = [{ objects }];
  const ballAt = object => ({ x: object.x + 3, y: object.y + 2 });
  function frame(moves) {
    frames.push({ objects: frames.at(-1).objects.map(object => ({ ...object, ...moves[object.id] })) });
  }
  if (backPass && pressed && holder.id !== receiver.id) {
    frame({ [ball]: ballAt(receiver) });
    frame({ [pressed.id]: pressure });
    frame({ [ball]: ballAt(pressure) });
  } else {
    if (pressed) frame({ [pressed.id]: pressure });
    const dribble = blue === 1 && !switchPlay ? { x: holder.x + 12, y: holder.y + 5 } : null;
    frame({ [ball]: ballAt(dribble || receiver),
      ...(ring ? {} : { [holder.id]: dribble || { x: holder.x + 10, y: holder.y + 5 } }) });
    const goal = find(goals[0]);
    frame({ [ball]: goal && !switchPlay ? { x: goal.x - 1, y: goal.y } : ballAt(dribble || third) });
  }
  return { version: 1, viewer: "bible", laneCount, lines: toGoals, seconds: 1.5, frames };
}

function trainingBibleExercisePreview(custom) {
  const { board, title, width, length } = custom;
  const types = { blue: "home", red: "away", keeper: "keeper", ball: "ball", disc: "disc", cone: "cone", goal: "goal", mini: "mini" };
  if (board.drawings?.length || board.frames[0].objects.some(object => !types[object.type] || object.scale !== 1))
    return exerciseBoardPreview(board, title);
  const height = Math.round(1000 * width / length) / 10;
  const tokens = board.frames[0].objects.map(object => ({
    id: object.id,
    type: object.type === "blue" && /^J\d+$/.test(object.label) ? "neutral" : types[object.type],
    label: object.label,
    color: object.color,
    rot: object.rotation,
  }));
  const ids = new Set(tokens.map(token => token.id));
  const model = {
    kind: "field", W: 100, H: height, len: length, wid: width, tokens,
    frames: board.frames.map(frame => Object.fromEntries(frame.objects.filter(object => ids.has(object.id))
      .map(object => [object.id, [object.x, object.y * height / 100]]))),
    arrows: [],
    zones: [2, 3].includes(board.laneCount)
      ? Array.from({ length: board.laneCount - 1 }, (_, i) => [0, height * (.09 + .82 * (i + 1) / board.laneCount), 100, 0]) : [],
  };
  const host = el("div", "training-bible-exercise-preview");
  const shadow = host.attachShadow({ mode: "open" });
  for (const href of ["supplied-exercise-base.css?v=cards-149", "imported-exercises-theme.css?v=coach-bundles-166"]) {
    const link = el("link");
    link.rel = "stylesheet";
    link.href = href;
    shadow.append(link);
  }
  const style = el("style", "", ":host{display:block;min-width:0;color:#203958;--blue:#2855a2;--navy:#142d50;--line:#dce5ef;--ink:#203958;--card:#fff;--muted:#536a83;--text:system-ui,sans-serif;--display:system-ui,sans-serif}.board-svg{display:block;width:100%;max-height:460px}");
  const viewer = suppliedExerciseEngine.createBoard(model, { editable: false, viewer: true, title });
  shadow.append(style, viewer.el);
  return host;
}

document.addEventListener("DOMContentLoaded", () => {
  // Dictée et assistant IA masqués en attendant l'assistant vocal : passer window.cruzaDictationEnabled à true pour les remettre.
  if (!window.cruzaDictationEnabled) return;
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
      preview.replaceChildren(trainingBibleExercisePreview(custom), adjust);
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

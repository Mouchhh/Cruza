function trainingAIBlock(spec, context) {
  const within = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
  const allowed = ["blue", "red", "keeper", "ball", "disc", "cone", "mini", "goal"];
  if (!spec || !Number.isInteger(spec.duration) || !within(spec.duration, 1, 120) ||
    spec.width > context.width || spec.length > context.length ||
    !Array.isArray(spec.tokens) || spec.tokens.length < 2 || spec.tokens.length > 40 ||
    !Array.isArray(spec.moves) || !spec.moves.length || spec.moves.length > 6)
    throw Error("Le modèle a proposé un terrain ou une durée incompatible. Demandez-lui de l’ajuster.");
  const objects = spec.tokens.map((token, index) => {
    if (!Array.isArray(token) || token.length !== 5) throw Error("Un pion est mal défini.");
    const [type, label, x, y, rotation] = token;
    if (!allowed.includes(type) || typeof label !== "string" || label.length > 20 ||
      !within(x, 0, 100) || !within(y, 0, 100) || !within(rotation, 0, 360))
      throw Error("Un pion ou sa position est invalide.");
    const color = type === "blue" ? (/^J\d+$/.test(label) ? "#7f51b5" : "#2373d7")
      : type === "red" ? "#e44242" : type === "keeper" ? "#edc641" : "#ffffff";
    return { id: "p" + index, type, label, x, y, rotation, color, scale: 1 };
  });
  if (objects.filter(object => object.type === "ball").length !== 1) throw Error("L’animation doit comporter un ballon.");
  let changed = false;
  const frames = [{ objects }];
  for (const moves of spec.moves) {
    if (!Array.isArray(moves) || moves.length > objects.length) throw Error("Une étape d’animation est invalide.");
    const next = frames.at(-1).objects.map(object => ({ ...object }));
    const seen = new Set();
    for (const move of moves) {
      if (!Array.isArray(move) || move.length !== 3) throw Error("Un déplacement est invalide.");
      const [index, x, y] = move;
      if (!Number.isInteger(index) || !next[index] || seen.has(index) || !within(x, 0, 100) || !within(y, 0, 100))
        throw Error("Un déplacement sort du terrain ou vise un pion inconnu.");
      seen.add(index);
      changed ||= next[index].x !== x || next[index].y !== y;
      Object.assign(next[index], { x, y });
    }
    frames.push({ objects: next });
  }
  if (!changed) throw Error("L’animation ne contient aucun déplacement.");
  const custom = {
    ...Object.fromEntries(Object.keys(customTrainingLabels).map(key => [key, spec[key]])),
    kind: spec.kind, width: spec.width, length: spec.length,
    board: { version: 1, viewer: "bible", laneCount: [2, 3].includes(spec.lanes) ? spec.lanes : 0, lines: true, seconds: 1.5, frames },
  };
  if (!trainingCustomValid(custom)) throw Error("La fiche proposée contient des champs ou des dimensions invalides.");
  return { id: crypto.randomUUID(), exerciseId: "custom", custom, duration: spec.duration, notes: "" };
}

function trainingAIDraft(reply, context) {
  if (reply.kind === "question") return null;
  if (!["exercise", "session"].includes(reply.kind) || !Array.isArray(reply.exercises) ||
    (reply.kind === "exercise" ? reply.exercises.length !== 1 : reply.exercises.length < 2 || reply.exercises.length > 6))
    throw Error("Le modèle n’a pas renvoyé un brouillon complet. Demandez-lui de le reprendre.");
  const [width, length] = reply.kind === "session" && Object.hasOwn(trainingSpaces, reply.space)
    ? trainingSpaces[reply.space] : [context.width, context.length];
  const blocks = reply.exercises.map(exercise => trainingAIBlock(exercise, { width, length }));
  if (reply.kind === "exercise") return { blocks };
  const duration = blocks.reduce((sum, block) => sum + block.duration, 0);
  if (!["quarter", "half", "full", "small"].includes(reply.space) ||
    blocks.some(({custom}) => custom.width > trainingSpaces[reply.space][0] || custom.length > trainingSpaces[reply.space][1]))
    throw Error("Les ateliers doivent tenir dans l’espace choisi pour la séance.");
  const session = { ...newTraining(), title: reply.title, players: reply.players, keepers: reply.keepers,
    space: reply.space, notes: reply.notes, duration, blocks, creationMode: "assisted" };
  if (!session.title?.trim?.() || !trainingValid(session))
    throw Error("L’effectif, la durée ou les paramètres de la séance doivent être ajustés.");
  return { session, blocks };
}

document.addEventListener("DOMContentLoaded", () => {
  // Dictée et assistant IA masqués en attendant l'assistant vocal : passer window.cruzaDictationEnabled à true pour les remettre.
  if (!window.cruzaDictationEnabled) return;
  const panel = $("training-assistant-az");
  if (!panel) return;
  const chat = el("details", "training-assistant-voice");
  const historyView = el("div", "training-assistant-brief");
  historyView.hidden = true;
  historyView.setAttribute("aria-live", "polite");
  const inputHost = el("div");
  const output = el("div");
  chat.append(el("summary", "", "Assistant conversationnel · séance ou exercice"), historyView, inputHost, output);
  panel.querySelector("form").before(chat);
  const history = [];
  let busy = false, previousDraft = "", scope = "";
  const identity = () => activeCoach.id + ":" + activeCoachTeam.id;
  function addTurn(role, text) {
    history.push({ role, content: text.slice(0, 1400) });
    if (history.length > 12) history.shift();
    historyView.append(el("strong", "", role === "user" ? "Coach" : "Cruza"), el("p", "", text));
    if (historyView.children.length > 24) {
      historyView.firstChild.remove();
      historyView.firstChild.remove();
    }
    historyView.hidden = false;
  }
  const cancel = trainingVoiceInput(inputHost, ({ request }) => {
    if (busy) return "Une réponse est en cours.";
    if (!clubNetworkBound() || !clubNetworkSession?.access_token) return "Connectez-vous avec votre compte éducateur.";
    if (scope && scope !== identity()) {
      history.length = 0;
      previousDraft = "";
      historyView.replaceChildren();
    }
    scope = identity();
    const requestScope = scope, source = currentTraining;
    const bounds = bibleAvailable(source);
    // Only group parameters and the coach's message are sent to the model.
    const context = { players: source.players, keepers: source.keepers,
      category: activeCoachTeam.category || source.category, width: bounds.width, length: bounds.length };
    busy = true;
    output.replaceChildren();
    const send = inputHost.querySelector("button:last-child");
    if (send) send.disabled = true;
    const prompt = inputHost.querySelector("textarea");
    prompt.value = "";
    addTurn("user", request);
    (async () => {
      const turns = history.slice(-10).map(turn => ({ ...turn }));
      if (previousDraft) {
        const recentReply = turns.findLast(turn => turn.role === "assistant");
        if (recentReply) recentReply.content += "\nBrouillon précédent (à modifier si demandé) : " + previousDraft;
      }
      const response = await fetch(window.CLUB_CANVA_GATEWAY + "/api/coach-ai", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + clubNetworkSession.access_token },
        body: JSON.stringify({ history: turns, context }), signal: AbortSignal.timeout(120000),
      });
      const result = await response.json().catch(() => null);
      if (identity() !== requestScope) return;
      if (!response.ok) throw Error(result?.error || "Le serveur de l’assistant est indisponible.");
      const draft = trainingAIDraft(result, context);
      addTurn("assistant", result.message);
      if (!draft) return;
      const serialized = JSON.stringify(result);
      previousDraft = serialized.length <= 15000 ? serialized : "";
      if (draft.session) output.append(el("h3", "", draft.session.title + " · " + draft.session.duration + " min"),
        el("p", "", draft.session.notes));
      for (const block of draft.blocks) {
        const details = el("details");
        details.open = draft.blocks.length === 1;
        details.append(el("summary", "", block.custom.title + " · " + block.duration + " min"),
          trainingCustomDetail(block.custom, draft.session || source));
        output.append(details);
      }
      const accept = el("button", "primary", draft.session ? "Ouvrir la séance dans l’éditeur" : "Ajouter l’exercice à la séance");
      accept.type = "button";
      accept.onclick = () => {
        if (identity() !== requestScope || (!draft.session && currentTraining.id !== source.id))
          return notify("La séance ou l’équipe a changé. Demandez une nouvelle proposition.");
        if (!draft.session) {
          if (currentTraining.blocks.length >= 20) return notify("20 blocs maximum.");
          const available = bibleAvailable(currentTraining);
          const { width, length } = draft.blocks[0].custom;
          if (width > available.width || length > available.length) return notify("Le terrain disponible a changé. Demandez un nouvel exercice.");
        }
        const applied = draft.session ? workspaceReplaceDraft("training", draft.session)
          : trainingCommitBlocks(blocks => blocks.push(...draft.blocks), true);
        if (!applied) return;
        accept.disabled = true;
        panel.hidden = true;
        $("training-space").classList.remove("training-assistant-open");
        $("training-assistant-open").setAttribute("aria-pressed", "false");
        trainingWizard.go(3);
      };
      output.append(accept);
    })().catch(error => {
      if (identity() === requestScope) output.append(el("p", "hint", error.message));
    }).finally(() => { busy = false; if (send) send.disabled = false; });
    return "Demande envoyée. Cruza prépare sa réponse…";
  }, {
    title: "Parlez de votre idée",
    button: "Envoyer à Cruza",
    placeholder: "Expliquez ce que vous voulez travailler. Vous pouvez ensuite préciser ou corriger votre demande.",
    raw: true,
  });
  inputHost.append(el("p", "hint", "La transcription est envoyée au service IA. Évitez les noms et les informations personnelles des joueurs."));
  chat.addEventListener("toggle", () => { if (!chat.open) cancel(); });
});

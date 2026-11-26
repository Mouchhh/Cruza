// Accueil : « Votre fil du match » — le prochain match, de la préparation au bilan, à côté du classement et de la forme.
// Les données viennent de l'agenda (matchs importés de Sportcorico ou saisis) ; rien n'est inventé.
(() => {
  const SC = "http://www.w3.org/2000/svg";
  const clean = (name) =>
    String(name || "")
      .replace(/\s+U\s?\d{2}\s*\d*\s*$/i, "")
      .replace(/\s+(seniors?|vétérans?)\s*\d*\s*$/i, "")
      .replace(/\s+\d+\s*$/, "")
      .trim() || String(name || "");
  const initials = (name) =>
    clean(name)
      .split(/\s+/)
      .filter((w) => /[A-Za-zÀ-ÿ]/.test(w[0] || ""))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";
  const norm = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  function opponentOf(event) {
    const f = event.fff;
    if (f) return f.opponent || (f.home === f.team ? f.away : f.home);
    return String(event.title || "").split(" / ").filter(Boolean).pop() || "Adversaire";
  }
  const clubNameKey = (name) => norm(clean(name))
    .split(" ")
    .filter((word) => !["de", "du", "des", "le", "la", "les"].includes(word))
    .map((word) => word === "gon" ? "gontier" : word)
    .sort()
    .join(" ");

  function opponentLogo(event) {
    const fixture = event.fff || event;
    if (typeof homeSportcoricoLogo !== "function") return "";

    const direct = homeSportcoricoLogo(fixture.opponentLogo);
    if (direct) return direct;

    const data = typeof homeSportcoricoData !== "undefined" ? homeSportcoricoData : null;
    const rows = data && data.sourceURL === homeSportcoricoSourceURL() ? data.rows : [];
    const opponents = (rows || []).filter((row) => row.team_id !== data.teamId);
    const id = Number(fixture.opponentId);
    const identified = opponents.find((row) => row.team_id === id);
    const identifiedLogo = homeSportcoricoLogo(identified?.logo);
    if (identifiedLogo) return identifiedLogo;

    const name = norm(opponentOf(event));
    const exact = opponents.filter((row) => norm(row.team) === name);
    const key = clubNameKey(opponentOf(event));
    const matches = exact.length ? exact : opponents.filter((row) => clubNameKey(row.team) === key);
    const logos = new Set(matches.map((row) => homeSportcoricoLogo(row.logo)).filter(Boolean));
    if (logos.size === 1) return [...logos][0];

    return key === "chateau gj gontier pays"
      ? "assets/opponents/gj-pays-de-chateau-gontier.jpg"
      : "";
  }
  const ownCrest = () => document.querySelector("body>header .brand .club-logo")?.getAttribute("src") || "";
  function badge(src, name, className) {
    const wrap = el("span", "home-thread-badge " + (className || ""));
    const fallback = () => {
      const local = "assets/opponents/gj-pays-de-chateau-gontier.jpg";
      const current = wrap.querySelector("img");
      if (className === "other" && clubNameKey(name) === "chateau gj gontier pays" && current && current.getAttribute("src") !== local) {
        current.onerror = () => wrap.replaceChildren(el("span", "home-thread-initials", initials(name)));
        current.src = local;
        return;
      }
      wrap.replaceChildren(el("span", "home-thread-initials", initials(name)));
    };
    if (src) {
      const img = document.createElement("img");
      img.alt = "";
      img.referrerPolicy = "no-referrer";
      img.src = src;
      img.onerror = async () => {
        // Image bloquée par le navigateur (ex. Opera) : le relais la renvoie à notre place.
        const base = String(window.CLUB_RANKING_GATEWAY || window.CLUB_CANVA_GATEWAY || "").replace(/\/$/, "");
        if (!base || img.dataset.viaRelay) return fallback();
        img.dataset.viaRelay = "1";
        try {
          const response = await fetch(base + "/api/sportcorico-logo?url=" + encodeURIComponent(src), { credentials: "omit", cache: "force-cache" });
          const data = response.ok ? await response.json() : null;
          if (data?.base64 && /^image\/(png|jpeg|webp|gif)$/.test(data.type)) img.src = "data:" + data.type + ";base64," + data.base64;
          else fallback();
        } catch {
          fallback();
        }
      };
      wrap.append(img);
    } else fallback();
    return wrap;
  }
  function state(event, now) {
    let board = null,
      report = null;
    try {
      board = typeof agendaEventBoard === "function" ? agendaEventBoard(event) : null;
    } catch {
      board = null;
    }
    try {
      const key = typeof agendaMatchKeys === "function" ? agendaMatchKeys(event)[0] : null;
      report = key ? reportLibrary.find((r) => r.agendaSourceKey === key) : null;
    } catch {
      report = null;
    }
    const played = event.date < now.day || (event.date === now.day && !!event.time && event.time <= now.time);
    return { board, report, played };
  }
  function build(match, now) {
    const card = el("article", "home-live-card home-live-thread");
    const head = el("div", "home-thread-head");
    head.append(el("h2", "", "Votre fil du match"), el("span", "home-thread-link", "Relié à l’agenda"));
    card.append(head);
    if (!match) {
      card.append(el("p", "home-thread-empty", "Aucun match planifié dans votre agenda."));
      const open = el("button", "home-live-open", "Ouvrir l’agenda →");
      open.type = "button";
      open.onclick = () => workspaceNavigation.run("view-coach-agenda", () => workspaceFlows.agenda.go(1));
      card.append(open);
      return card;
    }
    const f = match.fff,
      opponent = opponentOf(match),
      home = f ? f.home === f.team : true,
      st = state(match, now);
    const date = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "long" }).format(new Date(match.date + "T12:00:00Z")),
      competition = [f?.roundLabel || (f?.round ? "J" + f.round : ""), f?.competition].filter(Boolean).join(" · ");
    const row = el("div", "home-thread-match");
    const mine = el("div", "home-thread-side");
    mine.append(badge(ownCrest(), clubDisplayName(), "own"), el("span", "home-thread-names"));
    const mineNames = mine.querySelector(".home-thread-names");
    mineNames.append(el("strong", "", clubDisplayName()), el("small", "", [match.category, home ? "Domicile" : "Extérieur"].filter(Boolean).join(" · ")));
    const centre = el("div", "home-thread-centre");
    centre.append(el("small", "", date), el("strong", "", match.time || "Horaire ?"), el("small", "", competition));
    const other = el("div", "home-thread-side right");
    const otherNames = el("span", "home-thread-names");
    otherNames.append(el("strong", "", clean(opponent)), el("small", "", "Adversaire"));
    otherNames.title = opponent;
    other.append(otherNames, badge(opponentLogo(match), opponent, "other"));
    row.append(mine, centre, other);
    card.append(row);
    const steps = el("ol", "home-thread-steps");
    const step = (label, sub, status) => {
      const li = el("li", "home-thread-step " + status);
      li.append(el("b", "", label), el("small", "", sub));
      steps.append(li);
    };
    step("✓ Match renseigné", "Depuis l’agenda", "done");
    step("Causerie", st.board ? "✓ Préparée" : "À préparer", st.board ? "done" : "current");
    step("Match joué", st.played ? "✓ Terminé" : date + (match.time ? " · " + match.time : ""), st.played ? "done" : st.board ? "current" : "");
    step("Bilan", st.report ? "✓ Rédigé" : st.played ? "À compléter" : "Après le match", st.report ? "done" : st.played ? "current" : "");
    card.append(steps);
    const actions = el("div", "home-thread-actions");
    const prep = el("button", "home-live-open", st.board ? "Ouvrir la préparation" : "Préparer la causerie");
    prep.type = "button";
    prep.onclick = () => match.open?.();
    const rep = el("button", "export home-thread-secondary", st.report ? "Ouvrir le bilan" : "Faire le bilan");
    rep.type = "button";
    rep.onclick = () => {
      if (typeof agendaEventReport === "function") agendaEventReport(match, match.date);
      else match.open?.();
    };
    actions.append(prep, rep);
    card.append(actions);
    return card;
  }
  function decorate() {
    const root = document.getElementById("home-live-widgets");
    if (!root || root.querySelector(".home-live-thread")) return;
    let snapshot = null;
    try {
      snapshot = homeWidgetsSnapshot();
    } catch {
      return;
    }
    const thread = build(snapshot.match, snapshot.now);
    // Le fil du match remplace la carte « Agenda & séance » ; la prochaine séance reste mentionnée dedans.
    const training = root.querySelector(".home-live-training");
    if (snapshot.training && snapshot.match) {
      const when = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(snapshot.training.date + "T12:00:00Z"));
      thread.append(el("p", "home-thread-next", "Prochaine séance : " + when + (snapshot.training.time ? " · " + snapshot.training.time : "") + " · " + (snapshot.training.title || "séance")));
    }
    training?.remove();
    // « Forme · 5 derniers matchs » : les résultats pas encore saisis (score absent) apparaissent comme des ronds gris vides.
    const circles = root.querySelector(".home-live-form .home-live-results");
    if (circles) {
      const have = circles.querySelectorAll(".home-live-result").length;
      for (let i = have; i < 5 && have > 0; i++) {
        const empty = el("span", "home-live-result result-empty", "·");
        empty.title = "Résultat pas encore saisi";
        circles.prepend(empty);
      }
    }
    root.prepend(thread);
  }
  const original = renderHomeWidgets;
  renderHomeWidgets = function () {
    original.apply(this, arguments);
    decorate();
  };
  document.addEventListener("DOMContentLoaded", () => {
    if (typeof renderHomeWidgets === "function" && document.body.classList.contains("home-mode")) renderHomeWidgets();
  });
})();

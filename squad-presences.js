// Effectif → onglet « Présences » (premier onglet) : pointage Présent / Absent des séances de la semaine, joueur par joueur.
// Il écrit dans le même pointage que les séances (session.attendance), donc les statistiques et le suivi des joueurs le lisent.
document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelector(".squad-followup-tabs");
  if (!tabs || typeof squadPlayers !== "function" || typeof agendaCalendarAllEvents !== "function") return;
  const [rosterTab, followTab] = [...tabs.querySelectorAll("button")];
  const presenceTab = el("button", "export", "Présences");
  presenceTab.type = "button";
  tabs.prepend(presenceTab);
  const panel = el("section", "squad-presences");
  panel.id = "squad-presences";
  panel.hidden = true;
  squadList.before(panel);
  let active = false,
    phoneSession = null, // téléphone : id de la séance affichée
    weekStart = mondayOf(agendaCalendarToday());
  const phoneQuery = window.matchMedia("(max-width: 700px)");
  phoneQuery.addEventListener?.("change", () => active && paint());
  function mondayOf(day) {
    return agendaCalendarAdd(day, -((new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7));
  }
  const fmt = (day, options) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...options }).format(new Date(day + "T12:00:00Z"));
  function weekLabel(start) {
    const end = agendaCalendarAdd(start, 6),
      a = new Date(start + "T12:00:00Z"),
      b = new Date(end + "T12:00:00Z");
    return a.getUTCMonth() === b.getUTCMonth()
      ? a.getUTCDate() + " — " + fmt(end, { day: "numeric", month: "long", year: "numeric" })
      : fmt(start, { day: "numeric", month: "long" }) + " — " + fmt(end, { day: "numeric", month: "long", year: "numeric" });
  }
  const isKeeper = (player) => /gard|gb|goal/i.test(squadPlayerPositions(player).join(" "));
  // Séances enregistrées de la semaine (celles qui peuvent porter un pointage).
  function sessions() {
    try {
      return agendaCalendarAllEvents({ from: weekStart, to: agendaCalendarAdd(weekStart, 6) })
        .filter((e) => e.kind === "training" && e.session && !e.recurring && e.date >= weekStart && e.date <= agendaCalendarAdd(weekStart, 6))
        .map((e) => e.session)
        .filter((s, i, all) => all.findIndex((x) => x.id === s.id) === i)
        .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
    } catch {
      return [];
    }
  }
  const statusOf = (session, player) => session.attendance?.rows?.find((r) => r.squadPlayerId === player.id || r.id === player.id)?.status || "uncertain";
  function save(session, changes) {
    if (!session.time || !/^([01]\d|2[0-3]):[0-5]\d$/.test(session.time)) return notify("Ajoutez un horaire à cette séance pour pointer les présences.");
    const players = squadPlayers(),
      rows = players.map((p) => ({
        id: p.id,
        squadPlayerId: p.id,
        name: String(p.name || "").slice(0, 100),
        status: changes.has(p.id) ? changes.get(p.id) : statusOf(session, p),
        keeper: isKeeper(p),
        included: true,
      })),
      record = { version: 1, source: "manual", date: session.date, time: session.time, validatedAt: new Date().toISOString(), rows };
    if (!trainingAttendanceValid(record)) return notify("Pointage non enregistré : vérifiez les noms des joueurs.");
    const old = trainingLibrary,
      next = old.map((s) => (s.id === session.id ? { ...s, attendance: record, updatedAt: new Date().toISOString() } : s));
    try {
      coachStorageSet("vestiaire-training-library", JSON.stringify(next));
      trainingLibrary = next;
      if (currentTraining.id === session.id) currentTraining = { ...currentTraining, attendance: record };
      document.dispatchEvent(new CustomEvent("training-library-updated"));
    } catch {
      return notify("Pointage non enregistré : le stockage est indisponible.");
    }
    paint();
  }
  function paint() {
    if (!active) return;
    panel.replaceChildren();
    const head = el("div", "squad-presences-head"),
      prev = el("button", "export", "‹"),
      next = el("button", "export", "›"),
      label = el("strong", "", weekLabel(weekStart)),
      today = el("button", "export", "Aujourd’hui");
    prev.type = next.type = today.type = "button";
    prev.setAttribute("aria-label", "Semaine précédente");
    next.setAttribute("aria-label", "Semaine suivante");
    prev.onclick = () => {
      weekStart = agendaCalendarAdd(weekStart, -7);
      phoneSession = null;
      paint();
    };
    next.onclick = () => {
      weekStart = agendaCalendarAdd(weekStart, 7);
      phoneSession = null;
      paint();
    };
    today.onclick = () => {
      weekStart = mondayOf(agendaCalendarToday());
      phoneSession = null;
      paint();
    };
    head.append(prev, label, next, today);
    panel.append(el("h3", "squad-presences-title", "Chaque joueur compte."), el("p", "hint", "Les séances de la semaine, pour tout l’effectif. Touchez P (présent) ou A (absent) ; un second toucher efface."), head);
    const players = squadPlayers(),
      list = sessions();
    if (!players.length) {
      panel.append(el("p", "report-panel", "Aucun joueur dans cette équipe : ajoutez-les dans l’onglet Effectif."));
      return;
    }
    if (!list.length) {
      panel.append(el("p", "report-panel", "Aucune séance enregistrée cette semaine. Préparez-en une depuis l’agenda."));
      return;
    }
    if (phoneQuery.matches) {
      // Téléphone : une séance à la fois, puis la liste des joueurs avec P / A.
      const today = agendaCalendarToday();
      if (!list.some((x) => x.id === phoneSession)) phoneSession = (list.find((x) => x.date >= today) || list[list.length - 1]).id;
      const session = list.find((x) => x.id === phoneSession);
      const chips = el("div", "squad-presences-chips");
      chips.setAttribute("role", "group");
      chips.setAttribute("aria-label", "Séance à pointer");
      for (const item of list) {
        const chip = el("button", "squad-presences-chip", fmt(item.date, { weekday: "short", day: "numeric" }) + (item.time ? " · " + item.time.replace(":", "h") : ""));
        chip.type = "button";
        chip.setAttribute("aria-pressed", String(item.id === phoneSession));
        chip.onclick = () => {
          phoneSession = item.id;
          paint();
        };
        chips.append(chip);
      }
      panel.append(chips);
      const present = players.filter((p) => statusOf(session, p) === "present").length,
        card = el("div", "squad-presences-card"),
        top = el("div", "squad-presences-cardhead"),
        all = el("button", "squad-presences-allbtn", "Tous présents");
      all.type = "button";
      all.onclick = () => save(session, new Map(players.map((p) => [p.id, "present"])));
      const titles = el("div", "squad-presences-cardtitle");
      titles.append(el("strong", "", session.title || "Séance"), el("small", "", present + "/" + players.length + " présents"));
      top.append(titles, all);
      card.append(top);
      for (const player of players) {
        const row = el("div", "squad-presences-line"),
          current = statusOf(session, player),
          buttons = el("div", "squad-presences-cell");
        row.append(el("span", "squad-presences-name", player.name));
        for (const [code, status, name] of [["P", "present", "Présent"], ["A", "absent", "Absent"]]) {
          const button = el("button", "squad-presences-toggle " + status, code);
          button.type = "button";
          button.setAttribute("aria-pressed", String(current === status));
          button.setAttribute("aria-label", name + " · " + player.name);
          button.onclick = () => save(session, new Map([[player.id, current === status ? "uncertain" : status]]));
          buttons.append(button);
        }
        row.append(buttons);
        card.append(row);
      }
      panel.append(card);
      return;
    }
    const table = el("div", "squad-presences-table");
    table.style.setProperty("--cols", String(list.length));
    const header = el("div", "squad-presences-row squad-presences-header");
    header.append(el("span", "", "Joueur"));
    for (const session of list) {
      const col = el("div", "squad-presences-col"),
        present = players.filter((p) => statusOf(session, p) === "present").length,
        all = el("button", "squad-presences-all", "Tous présents");
      all.type = "button";
      all.onclick = () => save(session, new Map(players.map((p) => [p.id, "present"])));
      col.append(el("b", "", fmt(session.date, { weekday: "short", day: "numeric", month: "short" }) + (session.time ? " · " + session.time : "")), el("small", "", present + "/" + players.length + " présents"), all);
      header.append(col);
    }
    table.append(header);
    for (const player of players) {
      const row = el("div", "squad-presences-row");
      row.append(el("span", "squad-presences-name", player.name));
      for (const session of list) {
        const cell = el("div", "squad-presences-cell"),
          current = statusOf(session, player);
        for (const [code, status, name] of [["P", "present", "Présent"], ["A", "absent", "Absent"]]) {
          const button = el("button", "squad-presences-toggle " + status, code);
          button.type = "button";
          button.setAttribute("aria-pressed", String(current === status));
          button.setAttribute("aria-label", name + " · " + player.name + " · " + session.date);
          button.onclick = () => save(session, new Map([[player.id, current === status ? "uncertain" : status]]));
          cell.append(button);
        }
        row.append(cell);
      }
      table.append(row);
    }
    panel.append(table);
  }
  function setActive(on) {
    active = on;
    squadDialog.classList.toggle("squad-followup-mode", on);
    squadDialog.classList.toggle("squad-presences-mode", on);
    panel.hidden = !on;
    presenceTab.setAttribute("aria-pressed", String(on));
    if (on) paint();
  }
  presenceTab.onclick = () => {
    rosterTab?.click(); // remet l'onglet Effectif dans un état propre (cache le suivi), puis on affiche les présences
    setActive(true);
    rosterTab?.setAttribute("aria-pressed", "false");
  };
  // Les deux onglets existants éteignent les présences quand on les choisit.
  rosterTab?.addEventListener("click", () => active && setActive(false));
  followTab?.addEventListener("click", () => {
    if (active) {
      setActive(false);
      followTab.click();
    }
  });
  document.addEventListener("training-library-updated", () => active && paint());
  document.addEventListener("coach-teams-updated", () => active && paint());
  // Premier onglet : la page s'ouvre sur les présences.
  const open = typeof openCoachSquad === "function" ? openCoachSquad : null;
  setActive(true);
  rosterTab?.setAttribute("aria-pressed", "false");
});

// L'agenda est le seul endroit où les équipes se croisent : il montre aussi les matchs des autres équipes du coach.
// Un clic sur un match d'une autre équipe ouvre cette équipe (toute l'interface bascule), puis lance l'action demandée.
// Les widgets, séances, bilans, effectif et causeries restent propres à l'équipe ouverte.
document.addEventListener("DOMContentLoaded", () => {
  if (typeof agendaCalendarEvents !== "function" || typeof agendaPasteValid !== "function" || typeof coachTeams === "undefined") return;
  const PENDING = coachTeamBaseKey("vestiaire-pending-match");
  function otherTeamsFixtures() {
    const out = [];
    for (const team of coachTeams) {
      if (team.id === activeCoachTeam.id || coachTeamIsRemoved(team.id)) continue;
      try {
        const data = JSON.parse(localStorage.getItem(coachTeamBaseKey("vestiaire-pasted-fixtures") + ":team:" + team.id) || "null");
        if (data?.version === 1 && Array.isArray(data.fixtures))
          for (const fixture of data.fixtures.slice(0, 1000)) if (agendaPasteValid(fixture) && fixture.status !== "cancelled") out.push({ team, fixture });
      } catch {
        /* Calendrier illisible : cette équipe est ignorée. */
      }
    }
    return out;
  }
  function openInTeam(teamId, key, action) {
    try {
      sessionStorage.setItem(PENDING, JSON.stringify({ teamId, key, action }));
    } catch {
      return;
    }
    if (!coachTeamSwitch(teamId)) sessionStorage.removeItem(PENDING);
  }
  const previous = agendaCalendarEvents;
  agendaCalendarEvents = function () {
    const base = previous.apply(this, arguments);
    // Les widgets de l'accueil lisent l'agenda « sans filtre » : ils ne voient jamais les autres équipes.
    if (typeof agendaCalendarUnfilteredDepth !== "undefined" && agendaCalendarUnfilteredDepth > 0) return base;
    const added = otherTeamsFixtures()
      .filter(({ fixture }) => agendaCalendarMatches(fixture.date, fixture.category, activeCoach.name))
      .map(({ team, fixture }) => ({
        id: "team:" + team.id + ":" + fixture.key,
        kind: "match",
        label: (fixture.score ? "Match joué " : "Match ") + fixture.category,
        date: fixture.date,
        time: fixture.time,
        title: team.label + " · " + fixture.title + (fixture.score ? " · " + fixture.score.home + "–" + fixture.score.away : ""),
        category: fixture.category,
        sourceInfo: "Équipe " + team.label + " · s’ouvre dans son interface",
        otherTeam: team.id,
        otherKey: fixture.key,
        open: () => openInTeam(team.id, fixture.key, "open"),
      }));
    return [...base, ...added].sort((a, b) => a.date.localeCompare(b.date) || (a.time || "99:99").localeCompare(b.time || "99:99") || a.title.localeCompare(b.title, "fr"));
  };
  for (const [name, action] of [["agendaEventCauserie", "causerie"], ["agendaEventReport", "report"]]) {
    const original = window[name];
    if (typeof original !== "function") continue;
    window[name] = function (event) {
      if (event?.otherTeam) return openInTeam(event.otherTeam, event.otherKey, action);
      return original.apply(this, arguments);
    };
  }
  // Après le changement d'équipe : on lance l'action demandée sur le match.
  setTimeout(() => {
    let pending = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(PENDING) || "null");
      sessionStorage.removeItem(PENDING);
    } catch {
      return;
    }
    if (!pending || pending.teamId !== activeCoachTeam.id) return;
    const fixture = agendaPasteRead().fixtures.find((f) => f.key === pending.key);
    if (!fixture) return;
    if (pending.action === "causerie" || pending.action === "report") {
      const event = agendaCalendarEvents().find((e) => e.fff?.key === fixture.key);
      if (event) return pending.action === "causerie" ? window.agendaEventCauserie(event) : window.agendaEventReport(event);
    }
    agendaFFFPrepare(fixture);
  }, 1200);
  if (typeof renderCoachAgenda === "function") renderCoachAgenda();
});

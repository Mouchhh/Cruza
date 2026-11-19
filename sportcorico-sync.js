// Matchs et forme venant de Sportcorico : ajoutés à l'agenda de l'équipe active et remis à jour à chaque lecture du classement.
// Seules les rencontres 'paste:sc:…' sont touchées ; tout ce que le coach a saisi ou collé reste intact.
(() => {
  const PREFIX = "paste:sc:";
  const category = (name) => {
    const text = String(name || "");
    const age = /\bU\s?(\d{2})\b/i.exec(text);
    if (age) return "U" + age[1];
    if (/senior/i.test(text)) return "Seniors";
    return "";
  };
  function fixtureFrom(game, data) {
    const ownHome = game.homeId === data.teamId,
      team = ownHome ? game.home : game.away,
      fixture = {
        key: PREFIX + game.id,
        date: game.date,
        time: game.time || "",
        home: game.home,
        away: game.away,
        title: game.home + " / " + game.away,
        competition: String(game.competition || data.competition || "Championnat").slice(0, 200),
        round: 0,
        roundLabel: "",
        category: category(data.competition) || category(data.category) || category(data.teamName) || String(data.teamName || "").split(/\s+/)[0].slice(0, 30),
        location: ownHome ? "À domicile · stade à préciser" : "À l’extérieur · stade à préciser",
        status: "confirmed",
        sequence: 0,
        team,
        opponent: ownHome ? game.away : game.home,
        ...(Number.isInteger(ownHome ? game.awayId : game.homeId) ? { opponentId: ownHome ? game.awayId : game.homeId } : {}),
      };
    if (game.status === "played") fixture.score = { home: game.homeScore, away: game.awayScore };
    return fixture;
  }
  const fixtures = (data) => (Array.isArray(data?.games) ? data.games : []).map((game) => fixtureFrom(game, data));
  // Ajoute ou actualise les matchs ; renvoie le nombre de matchs ajoutés ou modifiés.
  function store(data, trusted = false) {
    try {
      if (typeof agendaPasteRead !== "function" || typeof agendaPasteValid !== "function" || !Array.isArray(data?.games) || !data.games.length) return 0;
      if (!trusted && activeCoachTeam.sportcoricoURL !== data.sourceURL) return 0;
      const current = agendaPasteRead(),
        map = new Map(current.fixtures.map((f) => [f.key, f])),
        others = [...current.fixtures.filter((f) => !f.key.startsWith(PREFIX)), ...(typeof agendaClubFixtures === "function" ? agendaClubFixtures() : [])],
        taken = new Set(others.map((f) => f.date));
      let changed = 0;
      for (const fixture of fixtures(data)) {
        if (!agendaPasteValid(fixture)) continue;
        const before = map.get(fixture.key);
        if (!before && taken.has(fixture.date)) continue;
        if (before && JSON.stringify(before) === JSON.stringify(fixture)) continue;
        if (map.size >= 1000) break;
        map.set(fixture.key, fixture);
        changed++;
      }
      // Sportcorico fait foi : un match Sportcorico qui n'est plus dans la liste (ex. matchs « Vétérans » importés par erreur) est retiré.
      const current_keys = new Set(fixtures(data).map((f) => f.key));
      for (const key of [...map.keys()])
        if (key.startsWith(PREFIX) && !current_keys.has(key)) {
          map.delete(key);
          changed++;
        }
      if (changed) coachStorageSet("vestiaire-pasted-fixtures", JSON.stringify({ version: 1, fixtures: [...map.values()] }));
      return changed;
    } catch {
      return 0;
    }
  }
  // Écrit les matchs dans l'agenda d'une équipe précise (même si ce n'est pas l'équipe ouverte).
  function storeFor(teamId, data) {
    try {
      if (typeof agendaPasteValid !== "function" || !Array.isArray(data?.games) || !/^team-[a-z0-9-]{1,80}$/.test(teamId)) return 0;
      const key = coachTeamBaseKey("vestiaire-pasted-fixtures") + ":team:" + teamId, // clé de base (sans l'équipe ouverte) + équipe visée
        old = JSON.parse(localStorage.getItem(key) || "null"),
        map = new Map((Array.isArray(old?.fixtures) ? old.fixtures : []).map((f) => [f.key, f]));
      let changed = 0;
      for (const fixture of fixtures(data)) if (agendaPasteValid(fixture) && map.size < 1000) { map.set(fixture.key, fixture); changed++; }
      if (changed) localStorage.setItem(key, JSON.stringify({ version: 1, fixtures: [...map.values()] }));
      return changed;
    } catch {
      return 0;
    }
  }
  // Les 5 derniers résultats de l'équipe (le plus récent d'abord), calculés à partir des scores.
  function form(data) {
    if (!Array.isArray(data?.games)) return null;
    const played = data.games.filter((g) => g.status === "played").slice(-5).reverse();
    if (!played.length) return null;
    const results = played.map((g) => {
      const own = g.homeId === data.teamId,
        goalsFor = own ? g.homeScore : g.awayScore,
        goalsAgainst = own ? g.awayScore : g.homeScore;
      return { result: goalsFor > goalsAgainst ? "V" : goalsFor === goalsAgainst ? "N" : "D", goalsFor, goalsAgainst, opponent: own ? g.away : g.home };
    });
    return {
      form: results.map((r) => r.result),
      points: results.reduce((sum, r) => sum + (r.result === "V" ? 3 : r.result === "N" ? 1 : 0), 0),
      last: results[0],
    };
  }
  window.sportcoricoSync = { fixtures, store, storeFor, form };
})();

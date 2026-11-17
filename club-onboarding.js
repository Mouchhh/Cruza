// Première connexion : une fenêtre pour régler le minimum de l'apparence du site (nom, logo, couleurs).
// Elle s'affiche tant que le club n'a jamais été configuré sur ce compte, une seule fois ; tout reste modifiable
// ensuite dans Paramètres → Mon club.
(() => {
  const DONE_KEY = "vestiaire-club-onboarding-done";
  let shown = false;
  const text = (tag, className, content) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content) node.textContent = content;
    return node;
  };
  function needed() {
    if (shown || document.querySelector("dialog[open]")) return false;
    const root = document.documentElement;
    if (root.classList.contains("club-private-request") && !root.classList.contains("club-authenticated")) return false;
    try {
      if (typeof coachStorageGet !== "function" || typeof coachClubDetailsKey === "undefined") return false;
      if (coachStorageGet(DONE_KEY)) return false;
      return !coachStorageGet(coachClubDetailsKey);
    } catch {
      return false;
    }
  }
  const markDone = () => {
    try {
      coachStorageSet(DONE_KEY, "1");
    } catch {
      /* Without storage the window may come back on the next visit. */
    }
  };
  async function shrinkLogo(file) {
    const bitmap = await createImageBitmap(file);
    try {
      const side = 256,
        scale = Math.min(side / bitmap.width, side / bitmap.height),
        canvas = document.createElement("canvas");
      canvas.width = canvas.height = side;
      const w = Math.round(bitmap.width * scale),
        h = Math.round(bitmap.height * scale);
      canvas.getContext("2d").drawImage(bitmap, (side - w) / 2, (side - h) / 2, w, h);
      let value = canvas.toDataURL("image/png");
      if (value.length > 200000) value = canvas.toDataURL("image/jpeg", 0.85);
      return value;
    } finally {
      bitmap.close();
    }
  }
  // Couleurs dominantes d'un logo (on ignore blanc, noir et gris).
  async function logoColors(blob) {
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 48;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0, 48, 48);
      const data = ctx.getImageData(0, 0, 48, 48).data,
        buckets = new Map();
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (data[i + 3] < 128) continue;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max > 235 || max < 40 || (max - min) / max < 0.3) continue;
        const key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5),
          item = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
        item.n++; item.r += r; item.g += g; item.b += b;
        buckets.set(key, item);
      }
      const list = [...buckets.values()].sort((a, b) => b.n - a.n).map((x) => [x.r / x.n, x.g / x.n, x.b / x.n]);
      const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
      const first = list[0],
        second = list.find((c) => first && Math.hypot(c[0] - first[0], c[1] - first[1], c[2] - first[2]) > 110);
      return { primary: first ? hex(first) : "", secondary: second ? hex(second) : "" };
    } finally {
      bitmap.close();
    }
  }
  const LOGO_HOSTS = ["s3.pub2.infomaniak.cloud", "www.sportcorico.com", "sportcorico.com"];
  // Équipe choisie : configure l'équipe active (nom, lien Sportcorico) et ajoute ses matchs à l'agenda.
  async function applyTeam(team, clubName, gateway) {
    const response = await fetch(gateway + "/api/sportcorico?url=" + encodeURIComponent(team.url), { cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error("unavailable");
    const data = await response.json(),
      // La catégorie du championnat fait foi (ex. « U19 1 » qui joue en poule U18 → U18).
      age = /\bU\s?(\d{2})\b/i.exec(data.competition || team.competition || "") || /\bU\s?(\d{2})\b/i.exec(team.name),
      entry = {
        id: activeCoachTeam.id,
        label: (age ? String(team.name).replace(/\bU\s?\d{2}\b/i, "U" + age[1]) : String(team.name)).slice(0, 60),
        category: age ? "U" + age[1] : /senior/i.test(team.name) ? "Seniors" : String(team.name).split(/\s+/)[0].slice(0, 30),
        team: String(data.teamName || clubName + " " + team.name).slice(0, 50),
        sportcoricoURL: coachTeamSportcoricoURL(team.url),
      };
    if (!coachTeamValid(entry) || !entry.sportcoricoURL) throw new Error("invalid");
    const stored = JSON.parse(localStorage.getItem(coachTeamManifestKey) || "[]"),
      merged = new Map([...coachTeams, ...(Array.isArray(stored) ? stored.filter(coachTeamValid) : [])].map((t) => [t.id, t]));
    merged.set(entry.id, entry);
    localStorage.setItem(coachTeamManifestKey, JSON.stringify([...merged.values()]));
    window.sportcoricoSync?.store(data, true);
    return entry;
  }
  function notifyTeamFailed() {
    try {
      if (typeof notify === "function") notify("Club enregistré. L’équipe n’a pas pu être récupérée : vous pourrez la régler dans Mon équipe.");
    } catch {
      /* Message facultatif. */
    }
  }
  function open() {
    if (!needed()) return;
    shown = true;
    const dialog = text("dialog", "club-onboarding"),
      form = text("form", "club-onboarding-form"),
      title = text("h2", "", "Bienvenue sur Cruza"),
      intro = text("p", "club-onboarding-intro", "Tapez le nom de votre club : son logo et ses couleurs se règlent tout seuls. Tout reste modifiable dans votre compte."),
      status = text("p", "club-onboarding-status");
    dialog.setAttribute("aria-labelledby", "club-onboarding-title");
    title.id = "club-onboarding-title";
    status.setAttribute("role", "status");
    const field = (label, input) => {
      const wrap = text("label", "club-onboarding-field", label);
      input.setAttribute("aria-label", label);
      wrap.append(input);
      return wrap;
    };
    const name = document.createElement("input");
    name.type = "text";
    name.maxLength = 70;
    name.required = true;
    name.autocomplete = "organization";
    name.placeholder = "Ex. : FC Les Lilas";
    const primary = document.createElement("input"),
      secondary = document.createElement("input");
    primary.type = secondary.type = "color";
    primary.value = (window.clubTheme?.defaults?.primary || "#2855a2").toLowerCase();
    secondary.value = (window.clubTheme?.defaults?.secondary || "#e41f28").toLowerCase();
    const colors = text("div", "club-onboarding-colors");
    colors.append(field("Couleur principale", primary), field("Couleur secondaire", secondary));
    const logoInput = document.createElement("input"),
      preview = document.createElement("img");
    logoInput.type = "file";
    logoInput.accept = "image/png,image/jpeg,image/webp";
    preview.className = "club-onboarding-logo";
    preview.alt = "";
    preview.hidden = true;
    let logoValue = "";
    logoInput.onchange = async () => {
      const file = logoInput.files[0];
      status.textContent = "";
      if (!file) return;
      if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
        status.textContent = "Choisissez une image de moins de 15 Mo.";
        return;
      }
      try {
        logoValue = await shrinkLogo(file);
        preview.src = logoValue;
        preview.hidden = false;
      } catch {
        status.textContent = "Image illisible : essayez un PNG ou un JPEG.";
      }
    };
    const logoWrap = field("Logo du club (facultatif)", logoInput);
    const actions = text("div", "club-onboarding-actions"),
      save = text("button", "primary", "Enregistrer et commencer"),
      skip = text("button", "export", "Passer pour l’instant");
    save.type = "submit";
    skip.type = "button";
    actions.append(save, skip);
    const queryInput = document.createElement("input");
    queryInput.type = "text";
    queryInput.maxLength = 60;
    queryInput.autocomplete = "off";
    queryInput.placeholder = "Ex. : St Mayennais FC";
    const chosen = text("p", "club-onboarding-chosen"),
      find = text("button", "export", "Rechercher mon club"),
      linkRow = text("div", "club-onboarding-linkrow"),
      found = text("div", "club-onboarding-found"),
      teamsBox = text("div", "club-onboarding-found");
    let selectedClub = null,
      selectedTeam = null;
    find.type = "button";
    linkRow.append(field("Nom de votre club", queryInput), find);
    const gatewayURL = () => String(window.CLUB_RANKING_GATEWAY || window.CLUB_CANVA_GATEWAY || "").replace(/\/$/, "");
    async function loadTeams(club) {
      teamsBox.replaceChildren();
      if (!gatewayURL() || typeof club.slug !== "string") return;
      try {
        const response = await fetch(gatewayURL() + "/api/sportcorico-teams?slug=" + encodeURIComponent(club.slug), { cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(60000) });
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json(),
          teams = Array.isArray(data.teams) ? data.teams.filter((team) => team && typeof team.name === "string" && typeof team.url === "string") : [];
        if (!teams.length || selectedClub !== club) return;
        teamsBox.append(text("p", "club-onboarding-help", "Quelle est votre équipe ? (le calendrier, le classement et la forme se rempliront tout seuls)"));
        for (const team of teams) {
          const button = text("button", "club-onboarding-club"),
            labels = text("span", "club-onboarding-club-text");
          button.type = "button";
          labels.append(text("span", "", team.name), text("small", "", team.competition || ""));
          button.append(labels);
          button.onclick = () => {
            selectedTeam = team;
            chosen.textContent = name.value + " · " + team.name;
            teamsBox.replaceChildren();
          };
          teamsBox.append(button);
        }
      } catch {
        /* Le club seul suffit : l’équipe se règle ensuite dans le compte. */
      }
    }
    async function pick(row) {
      selectedClub = row;
      selectedTeam = null;
      await pickLogo(row);
      loadTeams(row);
    }
    async function pickLogo(row) {
      status.textContent = "";
      name.value = String(row.name || "").slice(0, 70);
      chosen.textContent = name.value;
      logoValue = "";
      preview.hidden = true;
      try {
        const u = new URL(typeof row.logo === "string" ? row.logo : "");
        if (u.protocol !== "https:" || !LOGO_HOSTS.includes(u.hostname)) return;
        const blob = await (await fetch(u.href, { credentials: "omit", referrerPolicy: "no-referrer" })).blob();
        logoValue = await shrinkLogo(blob);
        preview.src = logoValue;
        preview.hidden = false;
        const colorsFound = await logoColors(blob);
        if (colorsFound.primary) primary.value = colorsFound.primary;
        if (colorsFound.secondary) secondary.value = colorsFound.secondary;
      } catch {
        status.textContent = "Club trouvé, mais pas son logo : vous pourrez l’ajouter dans votre compte.";
      }
    }
    async function search() {
      status.textContent = "";
      found.replaceChildren();
      const query = queryInput.value.trim(),
        gateway = window.CLUB_RANKING_GATEWAY || window.CLUB_CANVA_GATEWAY;
      if (query.length < 2) {
        status.textContent = "Tapez le nom de votre club.";
        return;
      }
      if (!gateway) {
        status.textContent = "Recherche indisponible pour le moment : réglez votre club dans votre compte.";
        return;
      }
      find.disabled = true;
      find.textContent = "Recherche…";
      try {
        const response = await fetch(gateway.replace(/\/$/, "") + "/api/sportcorico-search?q=" + encodeURIComponent(query), { cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(60000) });
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json(),
          clubs = Array.isArray(data.clubs) ? data.clubs.filter((club) => club && typeof club.name === "string") : [];
        if (!clubs.length) {
          status.textContent = "Aucun club trouvé. Essayez avec moins de mots (ex. « Mayennais »).";
          return;
        }
        for (const club of clubs) {
          const button = text("button", "club-onboarding-club"),
            labels = text("span", "club-onboarding-club-text");
          button.type = "button";
          if (club.logo) {
            const img = document.createElement("img");
            img.alt = "";
            img.loading = "lazy";
            img.referrerPolicy = "no-referrer";
            img.src = club.logo;
            img.onerror = () => img.remove();
            button.append(img);
          }
          labels.append(text("span", "", club.name), text("small", "", club.city || ""));
          button.append(labels);
          button.onclick = async () => {
            found.replaceChildren();
            await pick(club);
          };
          found.append(button);
        }
      } catch {
        status.textContent = "Impossible de chercher pour l’instant. Réessayez, ou passez cette étape et réglez le club dans votre compte.";
      } finally {
        find.disabled = false;
        find.textContent = "Rechercher mon club";
      }
    }
    find.onclick = search;
    queryInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        search();
      }
    });
    const picked = text("div", "club-onboarding-picked");
    picked.append(preview, chosen);
    form.append(title, intro, linkRow, picked, found, teamsBox, status, actions);
    dialog.append(form);
    document.body.append(dialog);
    const finish = () => {
      markDone();
      dialog.close();
      dialog.remove();
    };
    skip.onclick = finish;
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish();
    });
    form.onsubmit = async (event) => {
      event.preventDefault();
      if (!name.value.trim()) {
        status.textContent = "Cherchez votre club et touchez-le dans la liste, ou passez cette étape.";
        queryInput.focus();
        return;
      }
      save.disabled = true;
      try {
        const value = {
          ...coachClubDetailsDefaults(),
          name: name.value.trim(),
          ...(primary.value.toLowerCase() !== clubTheme.defaults.primary ? { primaryColor: primary.value.toLowerCase() } : {}),
          ...(secondary.value.toLowerCase() !== clubTheme.defaults.secondary ? { secondaryColor: secondary.value.toLowerCase() } : {}),
          ...(logoValue ? { logo: logoValue } : {}),
        };
        if (!coachClubDetailsValid(value)) throw new Error("invalid");
        coachStorageSet(coachClubDetailsKey, JSON.stringify(value));
        clubTheme.apply(value);
        window.clubNameRefresh?.();
      } catch {
        status.textContent = "Enregistrement impossible : vérifiez le nom du club.";
        save.disabled = false;
        return;
      }
      let teamEntry = null;
      if (selectedTeam) {
        status.textContent = "Récupération de votre équipe et de ses matchs…";
        try {
          if (typeof flushCoachWorkspace === "function" && !flushCoachWorkspace()) throw new Error("busy");
          teamEntry = await applyTeam(selectedTeam, name.value.trim(), gatewayURL());
        } catch {
          teamEntry = null;
        }
      }
      finish();
      if (teamEntry) {
        coachTeamRememberView(teamEntry.id);
        sessionStorage.setItem(coachTeamSelectionKey, teamEntry.id);
        history.replaceState(null, "", location.href);
        location.reload();
      } else if (selectedTeam) {
        notifyTeamFailed();
      }
    };
    dialog.showModal();
    queryInput.focus();
  }
  const check = () => setTimeout(open, 600);
  document.addEventListener("DOMContentLoaded", check);
  document.addEventListener("club-session-ready", check);
})();

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
  // Adresse du site terminée par ?onboarding=reset : remet la fenêtre de bienvenue à zéro pour ce compte (club mémorisé et « déjà vue »).
  let resetAsked = false;
  try {
    resetAsked = new URL(location.href).searchParams.get("onboarding") === "reset";
  } catch {
    resetAsked = false;
  }
  function applyReset() {
    if (!resetAsked) return;
    resetAsked = false;
    try {
      localStorage.removeItem(coachStorageKey(DONE_KEY));
      localStorage.removeItem(coachStorageKey("vestiaire-club-sportcorico"));
      const url = new URL(location.href);
      url.searchParams.delete("onboarding");
      history.replaceState(history.state, "", url.href);
    } catch {
      /* Sans stockage, rien à remettre à zéro. */
    }
  }
  function needed() {
    if (shown || document.querySelector("dialog[open]")) return false;
    const root = document.documentElement;
    if (root.classList.contains("club-private-request") && !root.classList.contains("club-authenticated")) return false;
    applyReset();
    try {
      if (typeof coachStorageGet !== "function" || typeof coachClubDetailsKey === "undefined") return false;
      // Tous les comptes, anciens compris : la fenêtre s'ouvre une seule fois (jusqu'à « Enregistrer » ou « Passer »).
      return !coachStorageGet(DONE_KEY);
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
  // Logo du club : d'abord via le relais (marche même si le navigateur bloque le site d'images, ex. Opera), sinon en direct.
  async function logoBlob(url) {
    const base = String(window.CLUB_RANKING_GATEWAY || window.CLUB_CANVA_GATEWAY || "").replace(/\/$/, "");
    if (base) {
      try {
        const response = await fetch(base + "/api/sportcorico-logo?url=" + encodeURIComponent(url), { cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(30000) });
        if (response.ok) {
          const data = await response.json();
          if (typeof data.base64 === "string" && /^image\/(png|jpeg|webp|gif)$/.test(data.type)) {
            const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
            return new Blob([bytes], { type: data.type });
          }
        }
      } catch {
        /* On essaie en direct. */
      }
    }
    return (await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" })).blob();
  }
  // Couleurs d'un logo : la teinte dominante, puis une AUTRE teinte (pas une variante plus claire de la première).
  // Blanc, noir et gris sont ignorés ; si le logo n'a qu'une couleur, la seconde est un noir bleuté ou la première foncée.
  async function logoColors(blob) {
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 48;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(bitmap, 0, 0, 48, 48);
      const data = ctx.getImageData(0, 0, 48, 48).data,
        buckets = new Map();
      let opaque = 0,
        dark = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (data[i + 3] < 128) continue;
        opaque++;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max < 60) dark++;
        if (max > 235 || max < 40 || (max - min) / max < 0.3) continue;
        const key = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5),
          item = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
        item.n++; item.r += r; item.g += g; item.b += b;
        buckets.set(key, item);
      }
      const hue = (c) => {
        const [r, g, b] = c.map((v) => v / 255), max = Math.max(r, g, b), d = max - Math.min(r, g, b);
        if (!d) return 0;
        const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return (h * 60 + 360) % 360;
      };
      const gap = (a, b) => Math.min(Math.abs(hue(a) - hue(b)), 360 - Math.abs(hue(a) - hue(b)));
      const list = [...buckets.values()].sort((a, b) => b.n - a.n).map((x) => ({ n: x.n, c: [x.r / x.n, x.g / x.n, x.b / x.n] }));
      const hex = (c) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
      // Logo noir et blanc : noir bleuté et gris plutôt que les couleurs par défaut du site.
      if (!list.length) return opaque && dark / opaque >= 0.06 ? { primary: "#1d2230", secondary: "#8c96a8" } : { primary: "", secondary: "" };
      const first = list[0],
        second = list.find((x) => x.n >= Math.max(6, first.n * 0.12) && gap(first.c, x.c) >= 35);
      const secondary = second ? hex(second.c) : opaque && dark / opaque >= 0.06 ? "#1d2230" : hex(first.c.map((v) => v * 0.55));
      return { primary: hex(first.c), secondary };
    } finally {
      bitmap.close();
    }
  }
  const LOGO_HOSTS = ["s3.pub2.infomaniak.cloud", "www.sportcorico.com", "sportcorico.com"];
  // Équipe choisie : créée comme une vraie équipe du compte (profil identique à celui du formulaire « choisissons vos équipes »),
  // avec son lien Sportcorico ; ses matchs sont ajoutés à l'agenda de cette équipe.
  async function applyTeam(team, clubName, gateway) {
    const response = await fetch(gateway + "/api/sportcorico?url=" + encodeURIComponent(team.url) + (team.split ? "&competition=" + encodeURIComponent(team.split) : ""), { cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error("unavailable");
    const data = await response.json(),
      // La catégorie du championnat fait foi (ex. « U19 1 » qui joue en poule U18 → U18).
      age = /\bU\s?(\d{2})\b/i.exec(data.competition || team.competition || "") || /\bU\s?(\d{2})\b/i.exec(team.name),
      category = age ? "U" + age[1] : /senior/i.test(team.name) ? "Seniors" : String(team.name).split(/\s+/)[0].slice(0, 30),
      number = Math.min(20, Math.max(1, Number(/(\d+)\s*$/.exec(String(team.name).replace(/\bU\s?\d{2}\b/i, ""))?.[1]) || 1)),
      gender = /f[ée]min/i.test(team.name + " " + (data.competition || "")) ? "Féminin" : "Masculin",
      season = /(\d{4})\D+(\d{4})/.exec(data.season || ""),
      entry = {
        id: "team-" + crypto.randomUUID(),
        label: (category + (gender === "Féminin" ? " Féminines" : "") + (number > 1 ? " · Équipe " + number : "")).slice(0, 60),
        category,
        team: String(clubName).slice(0, 50),
        sportcoricoURL: coachTeamSportcoricoURL(team.url),
        ...(team.split ? { sportcoricoCompetition: String(team.split).slice(0, 120) } : {}),
        fffProfile: {
          version: 1,
          gender,
          format: age && Number(age[1]) <= 13 ? "Football à 8" : "Football à 11",
          number,
          season: season ? season[1] + "-" + season[2] : new Date().getFullYear() + "-" + (new Date().getFullYear() + 1),
          level: String(data.competition || "").slice(0, 80),
          sourceURL: "",
          officialName: String(data.teamName || "").slice(0, 150),
        },
      };
    if (!coachTeamValid(entry) || !entry.sportcoricoURL || (typeof coachFFFProfileValid === "function" && !coachFFFProfileValid(entry))) throw new Error("invalid");
    window.sportcoricoSync?.storeFor(entry.id, data);
    const stored = JSON.parse(localStorage.getItem(coachTeamManifestKey) || "[]"),
      merged = new Map([...coachTeams, ...(Array.isArray(stored) ? stored.filter(coachTeamValid) : [])].map((t) => [t.id, t]));
    merged.set(entry.id, entry);
    localStorage.setItem(coachTeamManifestKey, JSON.stringify([...merged.values()]));
    // Compte connecté : l'équipe est aussi gardée dans le compte (retrouvée sur un autre appareil, sans reconfiguration).
    if (typeof clubNetworkBound === "function" && clubNetworkBound() && typeof coachFFFMetadataKey === "string") {
      try {
        const user = await clubNetworkRequest("/auth/v1/user"),
          saved = Array.isArray(user.user_metadata?.[coachFFFMetadataKey]) ? user.user_metadata[coachFFFMetadataKey].filter(coachFFFProfileValid) : [];
        await clubNetworkRequest("/auth/v1/user", { method: "PUT", body: { data: { [coachFFFMetadataKey]: [...saved, entry].slice(-100), stade_active_team_v1: entry.id } } });
      } catch {
        /* L'équipe reste enregistrée sur cet appareil. */
      }
    }
    return entry;
  }
  // Club retenu à la première connexion : permet de proposer ses autres équipes dans « Ajouter une équipe ».
  const CLUB_KEY = "vestiaire-club-sportcorico";
  const gatewayBase = () => String(window.CLUB_RANKING_GATEWAY || window.CLUB_CANVA_GATEWAY || "").replace(/\/$/, "");
  const savedClub = () => {
    try {
      const club = JSON.parse(coachStorageGet(CLUB_KEY) || "null");
      return club && /^[a-z0-9-]{2,100}$/.test(club.slug) && typeof club.name === "string" ? club : null;
    } catch {
      return null;
    }
  };
  const rememberClub = (club) => {
    try {
      if (club && /^[a-z0-9-]{2,100}$/.test(club.slug)) coachStorageSet(CLUB_KEY, JSON.stringify({ slug: club.slug, name: String(club.name).slice(0, 70), ...(typeof club.logo === "string" && club.logo.length <= 1000 ? { logo: club.logo } : {}) }));
    } catch {
      /* Facultatif. */
    }
  };
  async function relay(path) {
    const response = await fetch(gatewayBase() + path, { cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error("unavailable");
    return response.json();
  }
  // Nom, logo et couleurs du club (comme à la première connexion) quand le club n'a pas encore été réglé ou vient d'être changé.
  async function applyClubIdentity(club) {
    let logoValue = "",
      colorsFound = {};
    try {
      let logoURL = typeof club.logo === "string" ? club.logo : "";
      if (!logoURL && gatewayBase()) {
        const data = await relay("/api/sportcorico-search?q=" + encodeURIComponent(club.name)),
          same = (Array.isArray(data.clubs) ? data.clubs : []).find((c) => c.slug === club.slug);
        logoURL = typeof same?.logo === "string" ? same.logo : "";
      }
      const u = new URL(logoURL);
      if (u.protocol === "https:" && LOGO_HOSTS.includes(u.hostname)) {
        const blob = await logoBlob(u.href);
        logoValue = await shrinkLogo(blob);
        colorsFound = await logoColors(blob);
      }
    } catch {
      /* Le nom suffit : le logo se règle ensuite dans le compte. */
    }
    let current = {};
    try {
      current = JSON.parse(coachStorageGet(coachClubDetailsKey) || "null") || {};
    } catch {
      current = {};
    }
    const { logo: oldLogo, primaryColor: oldPrimary, secondaryColor: oldSecondary, ...rest } = current,
      value = {
        ...coachClubDetailsDefaults(),
        ...rest,
        name: String(club.name).slice(0, 70),
        ...(colorsFound.primary && colorsFound.primary.toLowerCase() !== clubTheme.defaults.primary ? { primaryColor: colorsFound.primary.toLowerCase() } : {}),
        ...(colorsFound.secondary && colorsFound.secondary.toLowerCase() !== clubTheme.defaults.secondary ? { secondaryColor: colorsFound.secondary.toLowerCase() } : {}),
        ...(logoValue ? { logo: logoValue } : {}),
      };
    if (!coachClubDetailsValid(value)) return;
    coachStorageSet(coachClubDetailsKey, JSON.stringify(value));
    clubTheme.apply(value);
    window.clubNameRefresh?.();
    markDone();
  }
  // Liste « Choisir dans mon club » à poser dans une fenêtre (Ajouter une équipe) : un clic crée l'équipe et ouvre son interface.
  function mountPicker(container, closeDialog) {
    if (!gatewayBase()) return;
    const box = text("section", "club-picker"),
      status = text("p", "club-onboarding-status"),
      list = text("div", "club-onboarding-found");
    box.append(text("h3", "", "Choisir dans mon club"), list, status);
    container.append(box);
    let identityPending = false; // vrai si le club vient d'être choisi ou changé ici
    const fail = (message) => {
      status.style.color = "#b3261e";
      status.textContent = message;
    };
    const add = async (club, team) => {
      status.style.color = "";
      status.textContent = "Ajout de l’équipe et de ses matchs…";
      try {
        if (typeof flushCoachWorkspace === "function" && !flushCoachWorkspace()) throw new Error("busy");
        let hasDetails = false,
          hasLogo = false;
        try {
          const raw = coachStorageGet(coachClubDetailsKey);
          hasDetails = !!raw;
          hasLogo = !!(raw && JSON.parse(raw)?.logo);
        } catch {
          hasDetails = false;
        }
        // Club réglé sans logo (ancien compte) : le logo, le nom et les couleurs du club choisi sont appliqués.
        if (identityPending || !hasDetails || !hasLogo) await applyClubIdentity(club);
        const entry = await applyTeam(team, club.name, gatewayBase());
        closeDialog?.();
        coachTeamRememberView(entry.id);
        sessionStorage.setItem(coachTeamSelectionKey, entry.id);
        history.replaceState(null, "", location.href);
        location.reload();
      } catch {
        fail("Équipe non ajoutée : réessayez, ou remplissez les champs ci-dessous.");
      }
    };
    const showSearch = () => {
      list.replaceChildren();
      status.textContent = "";
      const query = document.createElement("input"),
        go = text("button", "export", "Rechercher mon club");
      query.type = "text";
      query.maxLength = 60;
      query.placeholder = "Nom de votre club";
      query.setAttribute("aria-label", "Nom de votre club");
      go.type = "button";
      list.append(query, go);
      const search = async () => {
        status.textContent = "";
        if (query.value.trim().length < 2) return;
        try {
          const data = await relay("/api/sportcorico-search?q=" + encodeURIComponent(query.value.trim())),
            clubs = (Array.isArray(data.clubs) ? data.clubs : []).filter((c) => c && typeof c.name === "string" && /^[a-z0-9-]{2,100}$/.test(c.slug || ""));
          list.replaceChildren(query, go);
          for (const found of clubs) {
            const button = text("button", "club-onboarding-club"),
              labels = text("span", "club-onboarding-club-text");
            button.type = "button";
            if (found.logo) {
              const img = document.createElement("img");
              img.alt = "";
              img.referrerPolicy = "no-referrer";
              img.src = found.logo;
              img.onerror = () => img.remove();
              button.append(img);
            }
            labels.append(text("span", "", found.name), text("small", "", found.city || ""));
            button.append(labels);
            button.onclick = () => {
              rememberClub(found);
              identityPending = true;
              showTeams(found);
            };
            list.append(button);
          }
          if (!clubs.length) status.textContent = "Aucun club trouvé.";
        } catch {
          fail("Recherche indisponible pour le moment.");
        }
      };
      go.onclick = search;
      query.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          search();
        }
      });
      query.focus();
    };
    const showTeams = async (club) => {
      list.replaceChildren();
      status.textContent = "";
      const change = text("button", "export club-picker-change", "Ce n’est pas votre club ? Changer de club");
      change.type = "button";
      change.onclick = showSearch;
      try {
        const data = await relay("/api/sportcorico-teams?slug=" + encodeURIComponent(club.slug)),
          taken = (team) => coachTeams.some((t) => t.sportcoricoURL === team.url && (t.sportcoricoCompetition || "") === (team.split || "")),
          teams = (Array.isArray(data.teams) ? data.teams : []).filter((team) => team && typeof team.name === "string" && typeof team.url === "string" && !taken(team));
        list.append(text("p", "club-onboarding-help", club.name + " : touchez l’équipe à ajouter"));
        for (const team of teams) {
          const button = text("button", "club-onboarding-club"),
            labels = text("span", "club-onboarding-club-text");
          button.type = "button";
          labels.append(text("span", "", team.name), text("small", "", team.competition || ""));
          button.append(labels);
          button.onclick = () => add(club, team);
          list.append(button);
        }
        if (!teams.length) status.textContent = "Toutes les équipes de ce club sont déjà ajoutées.";
      } catch {
        fail("Équipes du club indisponibles pour le moment. Remplissez les champs ci-dessous.");
      }
      list.append(change);
    };
    const club = savedClub();
    if (club) showTeams(club);
    else showSearch();
  }
  window.clubSportcorico = { mountPicker };
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
    try {
      // Compte déjà réglé : on propose son nom de club actuel dans la recherche.
      const known = JSON.parse(coachStorageGet(coachClubDetailsKey) || "null")?.name;
      if (typeof known === "string" && known.trim() && known !== "Mon club") queryInput.value = known.trim().slice(0, 60);
    } catch {
      /* Champ laissé vide. */
    }
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
          teams = Array.isArray(data.teams)
            ? data.teams.filter((team) => team && typeof team.name === "string" && typeof team.url === "string" && !coachTeams.some((t) => t.sportcoricoURL === team.url && (t.sportcoricoCompetition || "") === (team.split || "")))
            : [];
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
        const blob = await logoBlob(u.href);
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
        // Compte déjà réglé : contacts et autres informations sont conservés, seuls nom, logo et couleurs changent.
        let existing = {};
        try {
          existing = JSON.parse(coachStorageGet(coachClubDetailsKey) || "null") || {};
        } catch {
          existing = {};
        }
        const { logo: oldLogo, primaryColor: oldPrimary, secondaryColor: oldSecondary, ...kept } = existing;
        const value = {
          ...coachClubDetailsDefaults(),
          ...kept,
          name: name.value.trim(),
          ...(primary.value.toLowerCase() !== clubTheme.defaults.primary ? { primaryColor: primary.value.toLowerCase() } : {}),
          ...(secondary.value.toLowerCase() !== clubTheme.defaults.secondary ? { secondaryColor: secondary.value.toLowerCase() } : {}),
          ...(logoValue ? { logo: logoValue } : {}),
        };
        if (!coachClubDetailsValid(value)) throw new Error("invalid");
        coachStorageSet(coachClubDetailsKey, JSON.stringify(value));
        clubTheme.apply(value);
        window.clubNameRefresh?.();
        rememberClub(selectedClub);
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
  // Plusieurs essais : la session et les autres fenêtres du site peuvent arriver après le premier test.
  const check = () => [600, 2500, 6000, 12000].forEach((delay) => setTimeout(open, delay));
  document.addEventListener("DOMContentLoaded", check);
  document.addEventListener("club-session-ready", check);
})();

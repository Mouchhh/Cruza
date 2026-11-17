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
  function sportcoricoLink(value) {
    try {
      const url = new URL(value.trim());
      return url.protocol === "https:" && /^(www\.)?sportcorico\.com$/.test(url.hostname) && url.pathname.startsWith("/clubs/") && !url.username ? url.href : "";
    } catch {
      return "";
    }
  }
  const cleanTeamName = (value) => String(value || "").replace(/\s+\d+$/, "").trim();
  function open() {
    if (!needed()) return;
    shown = true;
    const dialog = text("dialog", "club-onboarding"),
      form = text("form", "club-onboarding-form"),
      title = text("h2", "", "Bienvenue sur Cruza"),
      intro = text("p", "club-onboarding-intro", "Collez le lien Sportcorico de votre équipe : le nom, le logo et les couleurs de votre club se règlent tout seuls. Tout reste modifiable dans votre compte."),
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
    const linkInput = document.createElement("input");
    linkInput.type = "text";
    linkInput.inputMode = "url";
    linkInput.placeholder = "https://www.sportcorico.com/clubs/…";
    const chosen = text("p", "club-onboarding-chosen"),
      find = text("button", "export", "Récupérer mon club"),
      linkRow = text("div", "club-onboarding-linkrow"),
      help = text("p", "club-onboarding-help"),
      found = text("div", "club-onboarding-found");
    find.type = "button";
    linkRow.append(field("Lien Sportcorico de votre équipe (le plus simple)", linkInput), find);
        const helpLink = document.createElement("a");
    helpLink.href = "https://www.sportcorico.com";
    helpLink.target = "_blank";
    helpLink.rel = "noopener noreferrer";
    helpLink.textContent = "Trouvez votre équipe sur Sportcorico ↗";
    help.append(helpLink, " puis copiez l’adresse de la page.");
    async function pick(row) {
      status.textContent = "";
      name.value = cleanTeamName(row.team).slice(0, 70);
      chosen.textContent = name.value;
      const logoUrl = typeof row.logo === "string" ? row.logo : "";
      try {
        const u = new URL(logoUrl);
        if (u.protocol !== "https:" || !LOGO_HOSTS.includes(u.hostname)) return;
        const blob = await (await fetch(u.href, { credentials: "omit", referrerPolicy: "no-referrer" })).blob();
        logoValue = await shrinkLogo(blob);
        preview.src = logoValue;
        preview.hidden = false;
        const colorsFound = await logoColors(blob);
        if (colorsFound.primary) primary.value = colorsFound.primary;
        if (colorsFound.secondary) secondary.value = colorsFound.secondary;
      } catch {
        status.textContent = "Nom récupéré, mais pas le logo : vous pourrez l’ajouter dans votre compte.";
      }
    }
    find.onclick = async () => {
      status.textContent = "";
      found.replaceChildren();
      const source = sportcoricoLink(linkInput.value),
        gateway = window.CLUB_RANKING_GATEWAY || window.CLUB_CANVA_GATEWAY;
      if (!source) {
        status.textContent = "Collez l’adresse d’une page équipe Sportcorico (sportcorico.com/clubs/…).";
        return;
      }
      if (!gateway) {
        status.textContent = "Récupération indisponible pour le moment : réglez votre club dans votre compte.";
        return;
      }
      find.disabled = true;
      find.textContent = "Recherche…";
      try {
        const response = await fetch(gateway.replace(/\/$/, "") + "/api/sportcorico?url=" + encodeURIComponent(source), { cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(60000) });
        if (!response.ok) throw new Error("unavailable");
        const data = await response.json(),
          rows = Array.isArray(data.rows) ? data.rows.filter((row) => row && typeof row.team === "string") : [];
        if (!rows.length) throw new Error("empty");
        const own = rows.find((row) => row.team_id === data.teamId) || rows[0];
        await pick(own);
        if (rows.length > 1) {
          found.append(text("p", "club-onboarding-help", "Ce n’est pas votre club ? Touchez le bon :"));
          for (const row of rows) {
            const button = text("button", "club-onboarding-club", cleanTeamName(row.team));
            button.type = "button";
            button.onclick = () => pick(row);
            found.append(button);
          }
        }
      } catch {
        status.textContent = "Impossible de lire ce lien pour l’instant. Vérifiez l’adresse ou passez cette étape et réglez le club dans votre compte.";
      } finally {
        find.disabled = false;
        find.textContent = "Récupérer mon club";
      }
    };
    const picked = text("div", "club-onboarding-picked");
    picked.append(preview, chosen);
    form.append(title, intro, linkRow, help, picked, found, status, actions);
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
    form.onsubmit = (event) => {
      event.preventDefault();
      if (!name.value.trim()) {
        status.textContent = "Collez le lien Sportcorico puis touchez « Récupérer mon club », ou passez cette étape.";
        linkInput.focus();
        return;
      }
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
        finish();
      } catch {
        status.textContent = "Enregistrement impossible : vérifiez le nom du club.";
      }
    };
    dialog.showModal();
    linkInput.focus();
  }
  const check = () => setTimeout(open, 600);
  document.addEventListener("DOMContentLoaded", check);
  document.addEventListener("club-session-ready", check);
})();

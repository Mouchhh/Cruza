// Page de test : « Créer mon effectif » en cochant des joueurs lus dans un fichier.
// Tout reste dans le navigateur (localStorage) : aucune écriture vers Cruza, Supabase ou un autre club.
(function () {
  const I = window.ImportEffectif,
    $ = (id) => document.getElementById(id),
    SQUAD_KEY = "cruza-apercu-import-effectif",
    LIST_KEY = "cruza-apercu-import-liste",
    MAX_PLAYERS = 100, // même limite que « Mes joueurs » sur le site
    UNSET = "Catégorie à préciser";

  let squad = read(SQUAD_KEY, []),
    source = read(LIST_KEY, null), // { name, header, rows, firstLine, mapping }
    players = [],
    problems = [],
    chosen = new Set(),
    filter = "",
    toastTimer;

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  function toast(text) {
    $("toast").textContent = text;
    $("toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 3500);
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function initials(p) {
    return ((p.firstName || "?")[0] + ((p.lastName || "")[0] || "")).toLocaleUpperCase("fr");
  }
  function categoryOrder(c) {
    const m = /^U(\d+)$/.exec(c);
    return m ? +m[1] : c === "Seniors" ? 50 : c === UNSET ? 99 : 60;
  }
  function sortPlayers(list, cat) {
    return list.slice().sort((a, b) => categoryOrder(cat(a)) - categoryOrder(cat(b)) || a.name.localeCompare(b.name, "fr"));
  }
  function playerCard(p, category) {
    const card = el("div", "card"),
      info = el("span", "info");
    info.append(el("strong", "", p.name), el("small", "", [category, p.position].filter(Boolean).join(" · ")));
    card.append(el("span", "avatar", initials(p)), info);
    return card;
  }

  // ---- Mon effectif (test) ----
  function renderSquad() {
    const list = $("squad-list");
    list.replaceChildren(...sortPlayers(squad, (p) => p.primaryCategory || UNSET).map((p) => playerCard(p, p.primaryCategory || UNSET)));
    $("squad-empty").hidden = squad.length > 0;
    $("clear-squad").hidden = squad.length === 0;
    $("open-picker").textContent = squad.length ? "Ajouter des joueurs" : "Créer mon effectif";
  }
  $("clear-squad").onclick = () => {
    if (!confirm("Vider l’effectif de test ? Le fichier importé reste disponible.")) return;
    squad = [];
    write(SQUAD_KEY, squad);
    renderSquad();
  };

  // ---- Fenêtre de sélection ----
  $("open-picker").onclick = () => {
    $("picker-title").textContent = squad.length ? "Ajouter des joueurs" : "Créer mon effectif";
    chosen = new Set();
    filter = "";
    $("search").value = "";
    if (source) showPick();
    else showFile();
    $("picker").showModal();
  };
  $("picker-close").onclick = () => $("picker").close();
  $("change-file").onclick = showFile;

  function showFile() {
    $("step-file").hidden = false;
    $("step-pick").hidden = $("foot").hidden = true;
    $("file-error").textContent = "";
    $("file").value = "";
  }
  function fail(message) {
    $("file-error").textContent = message;
  }

  $("file").onchange = async () => {
    const file = $("file").files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return fail("Fichier trop lourd : 5 Mo maximum.");
    let rows;
    try {
      const buffer = await file.arrayBuffer();
      if (/\.xlsx?$/i.test(file.name)) {
        if (!window.XLSX)
          return fail("L’import Excel n’est pas encore activé. Dans Excel : Fichier › Enregistrer sous › CSV, puis choisis ce fichier.");
        const book = XLSX.read(buffer, { type: "array" });
        rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1, raw: true, defval: "" });
      } else rows = I.parseCsv(I.decodeText(buffer));
    } catch {
      return fail("Ce fichier est illisible. Vérifie qu’il s’agit bien d’un CSV ou d’un Excel.");
    }
    useRows(rows, file.name);
  };
  $("use-sample").onclick = async () => {
    try {
      const response = await fetch("exemple-effectif.csv");
      if (!response.ok) throw new Error();
      useRows(I.parseCsv(I.decodeText(await response.arrayBuffer())), "exemple-effectif.csv");
    } catch {
      fail("Le fichier exemple n’a pas pu être chargé.");
    }
  };

  function useRows(rows, name) {
    rows = rows.filter((r) => Array.isArray(r) && r.some((v) => String(v ?? "").trim() !== ""));
    const h = I.findHeaderRow(rows);
    if (rows.length - h < 2) return fail("Aucun joueur trouvé : le fichier doit avoir une ligne de titres puis une ligne par joueur.");
    const header = rows[h].map((v) => String(v ?? "").trim());
    source = { name, header, rows: rows.slice(h + 1), firstLine: h + 2, mapping: I.guessMapping(header) };
    // La liste reste sur cet appareil pour que « Ajouter des joueurs » la rouvre (comme la future liste du club).
    write(LIST_KEY, source);
    showPick();
    $("columns").open = source.mapping.firstName < 0;
  }

  function showPick() {
    $("step-file").hidden = true;
    $("step-pick").hidden = $("foot").hidden = false;
    renderMapping();
    rebuild();
  }

  function renderMapping() {
    const box = $("mapping");
    box.replaceChildren();
    for (const field of I.FIELDS) {
      const label = el("label", "", field.label + (field.required ? " (obligatoire)" : "")),
        select = el("select");
      select.append(new Option("— Aucune colonne —", "-1"));
      source.header.forEach((title, i) => {
        const example = source.rows.map((r) => String(r[i] ?? "").trim()).find(Boolean);
        select.append(new Option((title || "Colonne " + (i + 1)) + (example ? " (ex. " + example.slice(0, 20) + ")" : ""), String(i)));
      });
      select.value = String(source.mapping[field.key]);
      select.onchange = () => {
        source.mapping[field.key] = +select.value;
        write(LIST_KEY, source);
        rebuild();
      };
      label.append(select);
      box.append(label);
    }
  }

  function rebuild() {
    const result = I.buildPlayers(source.rows, source.mapping, { firstLine: source.firstLine });
    players = result.players;
    problems = result.problems;
    const known = new Set(squad.flatMap((p) => I.playerKeys(p)));
    for (const p of players) {
      p.key = I.playerKeys(p)[0];
      p.existing = I.playerKeys(p).some((k) => known.has(k));
    }
    // Si les colonnes changent, on garde seulement les coches qui correspondent encore à un joueur.
    for (const key of [...chosen]) if (!players.some((p) => p.key === key && !p.existing)) chosen.delete(key);
    $("source").textContent = source.name + " · " + players.length + " joueur" + (players.length > 1 ? "s" : "") + " · saison " + (I.seasonEndYear() - 1) + "-" + I.seasonEndYear();
    $("problems").hidden = problems.length === 0;
    $("problems-title").textContent = problems.length + (problems.length > 1 ? " lignes à vérifier" : " ligne à vérifier");
    $("problems-list").replaceChildren(...problems.map((p) => el("li", "", "Ligne " + p.line + " : " + p.message)));
    if (source.mapping.firstName < 0) {
      $("problems").hidden = false;
      $("problems-title").textContent = "Aucune colonne « Prénom » trouvée : choisis-la dans « Colonnes du fichier »";
      $("columns").open = true;
    }
    renderGrid();
  }

  const categoryOf = (p) => p.category || UNSET;

  function visiblePlayers() {
    const query = I.normalize($("search").value);
    return players.filter((p) => (!filter || categoryOf(p) === filter) && (!query || I.normalize(p.name).includes(query)));
  }

  function renderGrid() {
    const categories = [...new Set(players.map(categoryOf))].sort((a, b) => categoryOrder(a) - categoryOrder(b));
    if (filter && !categories.includes(filter)) filter = "";
    $("chips").replaceChildren(
      ...["", ...categories].map((c) => {
        const chip = el("button", "chip", (c || "Toutes") + " (" + (c ? players.filter((p) => categoryOf(p) === c).length : players.length) + ")");
        chip.type = "button";
        chip.setAttribute("aria-pressed", String(c === filter));
        chip.onclick = () => {
          filter = c;
          renderGrid();
        };
        return chip;
      }),
    );
    const visible = sortPlayers(visiblePlayers(), categoryOf),
      free = visible.filter((p) => !p.existing),
      allChecked = free.length > 0 && free.every((p) => chosen.has(p.key));
    $("check-all").hidden = free.length === 0;
    $("check-all").textContent = allChecked ? "Tout décocher" : "Cocher les " + free.length + " joueurs affichés";
    $("grid-empty").hidden = visible.length > 0;
    $("grid").replaceChildren(
      ...visible.map((p) => {
        const card = playerCard(p, categoryOf(p)),
          box = el("input");
        card.classList.toggle("existing", p.existing);
        box.type = "checkbox";
        box.checked = p.existing || chosen.has(p.key);
        box.disabled = p.existing;
        box.setAttribute("aria-label", (p.existing ? "Déjà dans ton effectif : " : "Choisir ") + p.name);
        box.onchange = () => {
          if (box.checked && squad.length + chosen.size >= MAX_PLAYERS) {
            box.checked = false;
            return toast("Ton effectif est limité à " + MAX_PLAYERS + " joueurs.");
          }
          box.checked ? chosen.add(p.key) : chosen.delete(p.key);
          renderGrid();
        };
        const label = el("label", card.className);
        label.append(box, ...card.childNodes);
        if (p.existing) label.querySelector(".info").append(el("span", "badge", "Déjà dans ton effectif"));
        return label;
      }),
    );
    $("count").textContent = chosen.size ? chosen.size + " joueur" + (chosen.size > 1 ? "s" : "") + " à ajouter" : "Coche tes joueurs";
    $("confirm").disabled = chosen.size === 0;
  }

  $("search").oninput = renderGrid;
  $("check-all").onclick = () => {
    const free = visiblePlayers().filter((p) => !p.existing),
      allChecked = free.every((p) => chosen.has(p.key));
    if (allChecked) free.forEach((p) => chosen.delete(p.key));
    else {
      for (const p of free) {
        if (squad.length + chosen.size >= MAX_PLAYERS) {
          toast("Ton effectif est limité à " + MAX_PLAYERS + " joueurs.");
          break;
        }
        chosen.add(p.key);
      }
    }
    renderGrid();
  };

  $("confirm").onclick = () => {
    const added = players
      .filter((p) => chosen.has(p.key) && !p.existing)
      .map((p) => ({
        // Même forme qu'un joueur de « Mes joueurs » sur le site, pour pouvoir le brancher plus tard.
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
        name: p.name,
        firstName: p.firstName,
        lastName: p.lastName,
        license: p.license,
        primaryCategory: p.category,
        position: p.position,
        positions: p.position ? [p.position] : [],
        photo: "",
      }));
    const next = squad.concat(added).slice(0, MAX_PLAYERS);
    if (!write(SQUAD_KEY, next)) return toast("Stockage indisponible sur cet appareil : rien n’a été ajouté.");
    squad = next;
    $("picker").close();
    renderSquad();
    toast(added.length + " joueur" + (added.length > 1 ? "s ajoutés" : " ajouté") + " à ton effectif.");
  };

  renderSquad();
})();

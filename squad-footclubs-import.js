// « Créer mon effectif » / « Ajouter des joueurs » : l'éducateur coche ses joueurs dans la liste
// des licenciés du club (export Excel ou PDF de Footclubs, ou CSV).
// Les joueurs ne vont que dans l'effectif de l'équipe et de l'éducateur connectés (squadSave habituel) :
// rien n'est envoyé ailleurs, et le fichier n'est lu que dans le navigateur.
// Lecture Excel et PDF : Enzo. Règles de lecture (colonnes, doublons, dates…) : squad-import-core.js.
(() => {
  const I = window.ImportEffectif,
    UNSET = "Catégorie à préciser",
    MAX_PLAYERS = 100;
  // shortcut: la liste lue reste en mémoire seulement jusqu'au rechargement de la page ; la garder demandera la liste du club (morceau C).
  let lastSource = null;

  let parser;
  function loadParser() {
    parser ??= new Promise((resolve, reject) => {
      const script = el("script");
      script.src = "vendor/sheetjs/xlsx.full.min.js?v=0.20.3";
      script.onload = () => window.XLSX ? resolve(window.XLSX) : reject();
      script.onerror = reject;
      document.head.append(script);
    }).catch(() => {
      parser = null;
      throw Error("Le lecteur Excel n’a pas pu être chargé. Réessayez.");
    });
    return parser;
  }

  const hasText = row => Array.isArray(row) && row.some(cell => String(cell ?? "").trim());
  const headerIndex = rows => rows.slice(0, 50).findIndex(row => I.guessMapping(row.map(String)).firstName >= 0);
  const source = (name, header, rows, firstLine, lineLabel = "Ligne") => ({
    name, header: header.map(cell => String(cell ?? "").trim()), rows, firstLine, lineLabel,
    mapping: I.guessMapping(header.map(String)),
  });

  async function read(file) {
    if (!/\.(pdf|xlsx?|csv|txt)$/i.test(file.name) || !file.size || file.size > 8 * 1024 * 1024)
      throw Error("Choisissez un export Footclubs (.pdf, .xls, .xlsx) ou un fichier .csv, 8 Mo maximum.");
    if (/\.pdf$/i.test(file.name)) return readPdf(file);
    if (/\.(csv|txt)$/i.test(file.name)) {
      const rows = I.parseCsv(I.decodeText(await file.arrayBuffer())), h = I.findHeaderRow(rows);
      if (rows.length - h < 2) throw Error("Aucun joueur trouvé : le fichier doit avoir une ligne de titres puis une ligne par joueur.");
      if (rows.length > 5001) throw Error("Ce fichier dépasse 5 000 lignes. Filtrez votre équipe avant de réexporter.");
      return source(file.name, rows[h], rows.slice(h + 1), h + 2);
    }
    const xlsx = await loadParser();
    let book;
    try {
      book = xlsx.read(await file.arrayBuffer(), { sheetRows: 5001 });
    } catch {
      throw Error("Impossible de lire ce fichier Excel. Téléchargez de nouveau l’export Footclubs.");
    }
    let fallback = null;
    for (const sheet of book.SheetNames) {
      const worksheet = book.Sheets[sheet];
      if (!worksheet["!ref"]) continue;
      const range = xlsx.utils.decode_range(worksheet["!ref"]);
      range.e.c = Math.min(range.e.c, range.s.c + 149);
      range.e.r = Math.min(range.e.r, 5000);
      // raw : les dates restent des nombres Excel, lus sans ambiguïté jour/mois par squad-import-core.js.
      const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: true, defval: "", range });
      const name = file.name + (book.SheetNames.length > 1 ? " · " + sheet : "");
      const h = headerIndex(rows);
      if (h < 0) {
        // Aucune colonne « Prénom » reconnue : l'éducateur pourra choisir ses colonnes lui-même.
        const first = rows.findIndex(hasText);
        if (!fallback && first >= 0 && rows.slice(first + 1).some(hasText))
          fallback = source(name, rows[first], rows.slice(first + 1), range.s.r + first + 2);
        continue;
      }
      if (worksheet["!fullref"] && xlsx.utils.decode_range(worksheet["!fullref"]).e.r >= 5000)
        throw Error("Cet export dépasse 5 000 lignes. Filtrez votre équipe dans Footclubs avant de réexporter.");
      if (rows.slice(h + 1).some(hasText)) return source(name, rows[h], rows.slice(h + 1), range.s.r + h + 2);
    }
    if (fallback) return fallback;
    throw Error("Aucun joueur trouvé dans ce fichier Excel.");
  }

  // ---- Lecture des PDF Footclubs (Enzo) ----
  const pdfAliases = {
    firstName: /^(prenom|prenoms|prenom du licencie|prenom licencie)$/,
    lastName: /^(nom|nom de famille|nom du licencie|nom licencie|nom de naissance)$/,
    license: /^(n (de )?licence|no (de )?licence|numero (de )?licence|licence|n (de )?licencie|numero (de )?licencie)$/,
    primaryCategory: /^(categorie|categorie d age|categorie age|categorie licence|categorie sportive|categorie du licencie|sous categorie)$/,
  };

  function pdfLines(items) {
    const ordered = items.filter(item => item.str?.trim())
      .map(item => ({ value: item.str.trim(), x: item.transform[4], y: item.transform[5], width: item.width }))
      .sort((a, b) => b.y - a.y);
    const lines = [];
    for (const item of ordered) {
      const line = lines.at(-1);
      if (line && Math.abs(line[0].y - item.y) <= 2) line.push(item);
      else lines.push([item]);
    }
    return lines.map(line => line.sort((a, b) => a.x - b.x));
  }

  function pdfColumns(line) {
    const headings = [];
    for (const item of line) {
      const previous = headings.at(-1);
      const end = item.x + item.width;
      if (previous && item.x - previous.end < 7) {
        previous.value += " " + item.value;
        previous.end = end;
      } else {
        headings.push({ ...item, end });
      }
    }
    for (const [index, heading] of headings.entries()) {
      const label = I.normalize(heading.value);
      heading.key = /^(nom prenom|nom et prenom|nom prenom du licencie)$/.test(label)
        ? "fullName"
        : Object.keys(pdfAliases).find(key => pdfAliases[key].test(label));
      const previous = headings[index - 1];
      heading.start = heading.x - (previous ? Math.min(12, (heading.x - previous.end) * .65) : 4);
    }
    const has = key => headings.some(heading => heading.key === key);
    return (has("firstName") && has("lastName")) || (has("fullName") && has("license"))
      ? headings : null;
  }

  function pdfPlayer(cells) {
    const isName = value => /^\p{L}[\p{L}\p{M} .'’–-]*$/u.test(value || "");
    let { firstName, lastName, license, primaryCategory } = cells;
    if (cells.fullName) {
      // The Footclubs match license list prints surnames in uppercase, then given names.
      // A numeric license distinguishes the actual player row from notes and suspension lines.
      if (!/^\d{6,15}$/.test(license || "") || !isName(cells.fullName)) return null;
      const words = cells.fullName.split(/\s+/);
      const firstMixedCase = words.findIndex(word => /\p{Ll}/u.test(word));
      const split = firstMixedCase > 0 ? firstMixedCase : words.length - 1;
      lastName = words.slice(0, split).join(" ");
      firstName = words.slice(split).join(" ");
      primaryCategory = primaryCategory?.match(/\bU\s?\d{1,2}F?\b/i)?.[0].toUpperCase().replace(/\s/g, "")
        || primaryCategory;
    }
    if (!isName(firstName) || !isName(lastName)) return null;
    return [firstName, lastName, license || "", primaryCategory || ""];
  }

  async function readPdf(file) {
    let pdf;
    try {
      pdf = await import("./vendor/pdfjs/build/pdf.min.mjs");
    } catch {
      throw Error("Le lecteur PDF n’a pas pu être chargé. Réessayez.");
    }
    pdf.GlobalWorkerOptions.workerSrc = new URL("vendor/pdfjs/build/pdf.worker.min.mjs", document.baseURI).href;
    const task = pdf.getDocument({
      data: await file.arrayBuffer(),
      isEvalSupported: false,
      useWasm: false,
      stopAtErrors: true,
    });
    const rows = [];
    let columns, hasPdfText = false;
    try {
      const document = await task.promise;
      if (document.numPages > 50) throw Error("Cet export dépasse 50 pages. Filtrez votre équipe dans Footclubs avant de réexporter.");
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber);
        const { items } = await page.getTextContent();
        const lines = pdfLines(items);
        hasPdfText ||= lines.length > 0;
        const headers = lines.map(pdfColumns);
        const firstHeader = headers.findIndex(Boolean);
        // Repeated headers replace the previous page's positions. Continuation pages can reuse them.
        for (let index = Math.max(0, firstHeader); index < lines.length; index++) {
          if (headers[index]) {
            columns = headers[index];
            continue;
          }
          if (!columns) continue;
          const cells = {};
          for (const item of lines[index]) {
            const key = columns.findLast(column => item.x >= column.start)?.key;
            if (key) cells[key] = [cells[key], item.value].filter(Boolean).join(" ");
          }
          const row = pdfPlayer(cells);
          if (row) rows.push(row);
        }
        page.cleanup();
      }
    } catch (error) {
      if (error.message.startsWith("Cet export dépasse")) throw error;
      throw Error("Impossible de lire ce PDF. Vérifiez qu’il s’ouvre et qu’il est accessible sans mot de passe.");
    } finally {
      await task.destroy();
    }
    if (!rows.length) throw Error(hasPdfText
      ? "Aucun joueur reconnu dans ce PDF. Vérifiez que le tableau comporte un nom et un prénom par joueur."
      : "Ce PDF ne contient pas de texte lisible. Utilisez le PDF d’origine dans Footclubs si vous avez une version scannée.");
    return source(file.name, ["Prénom", "Nom", "N° de licence", "Catégorie"], rows, 1, "Joueur n°");
  }

  // ---- Fenêtre de choix ----
  const categoryOf = player => player.category || UNSET;
  function categoryOrder(category) {
    const match = /^U(\d+)$/.exec(category);
    return match ? +match[1] : category === "Seniors" ? 50 : category === UNSET ? 99 : 60;
  }

  function open() {
    const teamId = coachTeamSquadId();
    const dialog = el("dialog", "squad-editor squad-pick");
    const title = el("h2", "", squadPlayers().length ? "Ajouter des joueurs" : "Créer mon effectif");
    title.id = "squad-pick-title";
    dialog.setAttribute("aria-labelledby", title.id);
    const closeIcon = el("button", "squad-pick-close", "×");
    closeIcon.type = "button";
    closeIcon.setAttribute("aria-label", "Fermer");
    const head = el("div", "squad-pick-head");
    head.append(title, closeIcon);

    // Étape 1 : le fichier
    const fileStep = el("div");
    const zone = el("label", "squad-pick-drop");
    const input = el("input");
    input.type = "file";
    input.accept = ".pdf,.xls,.xlsx,.csv";
    zone.append(input, el("span", "", "Choisir un fichier"));
    const message = el("p", "hint");
    message.setAttribute("role", "status");
    fileStep.append(
      el("p", "hint", "Importez la liste des licenciés : export Excel ou PDF de Footclubs, ou fichier CSV. Vous cocherez ensuite vos joueurs."),
      zone, message,
    );

    // Étape 2 : la grille
    const pickStep = el("div");
    pickStep.hidden = true;
    const sourceLine = el("p", "hint"), sourceName = el("span"), change = el("button", "squad-pick-link", "Changer de fichier");
    change.type = "button";
    sourceLine.append(sourceName, " · ", change);
    const columns = el("details", "squad-pick-details"), mapping = el("div", "squad-pick-mapping");
    columns.append(el("summary", "", "Colonnes du fichier"), el("p", "hint", "Associez chaque information de Cruza à une colonne de votre fichier."), mapping);
    const problems = el("details", "squad-pick-details squad-pick-problems"), problemsTitle = el("summary"), problemsList = el("ul");
    problems.append(problemsTitle, problemsList);
    const filters = el("div", "squad-pick-filters"), chips = el("div", "squad-pick-chips"), search = el("input");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "Filtrer par catégorie");
    search.type = "search";
    search.placeholder = "Rechercher un joueur";
    search.setAttribute("aria-label", "Rechercher un joueur dans la liste");
    filters.append(chips, search);
    const checkAll = el("button", "squad-pick-link");
    checkAll.type = "button";
    const empty = el("p", "hint", "Aucun joueur à afficher.");
    const grid = el("div", "squad-pick-grid");
    pickStep.append(sourceLine, columns, problems, filters, checkAll, empty, grid);

    const foot = el("div", "squad-pick-foot"), count = el("span"), save = el("button", "primary", "Ajouter à mon effectif");
    save.type = "button";
    foot.hidden = true;
    foot.append(count, save);

    dialog.append(head, el("div", "squad-pick-body"), foot);
    dialog.querySelector(".squad-pick-body").append(fileStep, pickStep);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    closeIcon.onclick = () => dialog.close();
    document.body.append(dialog);

    let current = null, players = [], chosen = new Set(), filter = "", request = 0;
    const room = () => MAX_PLAYERS - squadPlayers().length;

    function showFile() {
      fileStep.hidden = false;
      pickStep.hidden = foot.hidden = true;
      message.textContent = "";
    }
    function showPick(next) {
      current = lastSource = next;
      chosen = new Set();
      filter = search.value = "";
      fileStep.hidden = true;
      pickStep.hidden = foot.hidden = false;
      renderMapping();
      rebuild();
      columns.open = current.mapping.firstName < 0;
    }
    change.onclick = showFile;

    async function preview(file) {
      if (!file) return;
      const reading = ++request;
      message.textContent = "Lecture du fichier…";
      try {
        const next = await read(file);
        if (dialog.open && reading === request) showPick(next);
      } catch (error) {
        if (dialog.open && reading === request) message.textContent = error.message;
      }
    }
    input.onchange = () => { preview(input.files[0]); input.value = ""; };
    dialog.ondragover = event => event.preventDefault();
    dialog.ondrop = event => { event.preventDefault(); preview(event.dataTransfer.files[0]); };

    function renderMapping() {
      mapping.replaceChildren();
      for (const field of I.FIELDS) {
        const label = el("label", "", field.label + (field.required ? " (obligatoire)" : "")), select = el("select");
        select.append(new Option("— Aucune colonne —", "-1"));
        current.header.forEach((heading, index) => {
          const example = current.rows.map(row => String(row[index] ?? "").trim()).find(Boolean);
          select.append(new Option((heading || "Colonne " + (index + 1)) + (example ? " (ex. " + example.slice(0, 20) + ")" : ""), String(index)));
        });
        select.value = String(current.mapping[field.key]);
        select.onchange = () => {
          current.mapping[field.key] = +select.value;
          rebuild();
        };
        label.append(select);
        mapping.append(label);
      }
    }

    function rebuild() {
      const result = I.buildPlayers(current.rows, current.mapping, { firstLine: current.firstLine });
      const known = I.createMatcher(squadPlayers());
      players = result.players;
      for (const player of players) {
        player.key = String(player.line);
        player.existing = !!known.find(player);
      }
      // Si les colonnes changent, on ne garde que les coches qui correspondent encore à un joueur.
      for (const key of [...chosen]) if (!players.some(p => p.key === key && !p.existing)) chosen.delete(key);
      sourceName.textContent = current.name + " · " + players.length + " joueur" + (players.length > 1 ? "s" : "")
        + " · saison " + (I.seasonEndYear() - 1) + "-" + I.seasonEndYear();
      const list = result.problems;
      problems.hidden = !list.length && current.mapping.firstName >= 0;
      problemsTitle.textContent = current.mapping.firstName < 0
        ? "Aucune colonne « Prénom » trouvée : choisissez-la dans « Colonnes du fichier »"
        : list.length + (list.length > 1 ? " lignes à vérifier" : " ligne à vérifier");
      problemsList.replaceChildren(...list.map(p => el("li", "", current.lineLabel + " " + p.line + " : " + p.message)));
      renderGrid();
    }

    function visible() {
      const query = I.normalize(search.value);
      return players
        .filter(p => (!filter || categoryOf(p) === filter) && (!query || I.normalize(p.name).includes(query)))
        .sort((a, b) => categoryOrder(categoryOf(a)) - categoryOrder(categoryOf(b)) || a.name.localeCompare(b.name, "fr"));
    }

    function renderGrid() {
      const categories = [...new Set(players.map(categoryOf))].sort((a, b) => categoryOrder(a) - categoryOrder(b));
      if (filter && !categories.includes(filter)) filter = "";
      chips.replaceChildren(...["", ...categories].map(category => {
        const total = category ? players.filter(p => categoryOf(p) === category).length : players.length;
        const chip = el("button", "squad-pick-chip", (category || "Toutes") + " (" + total + ")");
        chip.type = "button";
        chip.setAttribute("aria-pressed", String(category === filter));
        chip.onclick = () => { filter = category; renderGrid(); };
        return chip;
      }));
      const shown = visible(), free = shown.filter(p => !p.existing);
      const allChecked = free.length > 0 && free.every(p => chosen.has(p.key));
      checkAll.hidden = !free.length;
      checkAll.textContent = allChecked ? "Tout décocher" : "Cocher les " + free.length + " joueurs affichés";
      empty.hidden = shown.length > 0;
      grid.replaceChildren(...shown.map(player => {
        const card = el("label", "squad-pick-card" + (player.existing ? " is-existing" : ""));
        const box = el("input"), info = el("span", "squad-pick-info");
        box.type = "checkbox";
        box.checked = player.existing || chosen.has(player.key);
        box.disabled = player.existing;
        box.setAttribute("aria-label", (player.existing ? "Déjà dans votre effectif : " : "Choisir ") + player.name);
        box.onchange = () => {
          if (box.checked && chosen.size >= room()) {
            box.checked = false;
            return notify("Votre effectif est limité à " + MAX_PLAYERS + " joueurs.");
          }
          box.checked ? chosen.add(player.key) : chosen.delete(player.key);
          renderGrid();
        };
        info.append(el("strong", "", player.name), el("small", "", [categoryOf(player), player.position].filter(Boolean).join(" · ")));
        if (player.existing) info.append(el("small", "squad-pick-badge", "Déjà dans votre effectif"));
        card.append(box, squadCardAvatar(player), info);
        return card;
      }));
      count.textContent = chosen.size ? chosen.size + " joueur" + (chosen.size > 1 ? "s" : "") + " à ajouter" : "Cochez vos joueurs";
      save.disabled = !chosen.size;
    }

    search.oninput = renderGrid;
    checkAll.onclick = () => {
      const free = visible().filter(p => !p.existing);
      if (free.every(p => chosen.has(p.key))) free.forEach(p => chosen.delete(p.key));
      else for (const player of free) {
        if (chosen.size >= room()) {
          notify("Votre effectif est limité à " + MAX_PLAYERS + " joueurs.");
          break;
        }
        chosen.add(player.key);
      }
      renderGrid();
    };

    save.onclick = () => {
      if (teamId !== coachTeamSquadId()) return dialog.close();
      const existing = squadPlayers(), known = I.createMatcher(existing);
      const additions = players.filter(p => chosen.has(p.key) && !known.find(p)).map(p => ({
        id: crypto.randomUUID(),
        name: p.name,
        firstName: p.firstName,
        lastName: p.lastName,
        license: p.license,
        primaryCategory: p.category,
        position: p.position,
        positions: p.position ? [p.position] : [],
        photo: "",
      }));
      if (!additions.length || existing.length + additions.length > MAX_PLAYERS) {
        message.textContent = "";
        rebuild();
        return notify("Votre effectif a changé : vérifiez la sélection.");
      }
      if (!squadSave([...existing, ...additions])) return;
      dialog.close();
      squadRender();
      notify(additions.length + " joueur" + (additions.length > 1 ? "s ajoutés" : " ajouté") + " à votre effectif.");
    };

    dialog.showModal();
    if (lastSource) showPick(lastSource);
  }

  // Bouton à côté de « + Nouveau joueur » : « Créer mon effectif » tant qu'il est vide, puis « Ajouter des joueurs ».
  const button = el("button", "export squad-pick-open");
  button.type = "button";
  button.onclick = open;
  squadNew.before(button);
  const label = () => (button.textContent = squadPlayers().length ? "Ajouter des joueurs" : "Créer mon effectif");
  const render = squadRender;
  squadRender = function (...args) {
    const result = render.apply(this, args);
    label();
    return result;
  };
  label();
  window.squadPick = { open }; // ouvert aussi depuis la composition quand l'effectif est vide
})();

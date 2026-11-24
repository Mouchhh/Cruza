(() => {
  const aliases = {
    firstName: /^(prenom|prenoms|prenom du licencie|prenom licencie)$/,
    lastName: /^(nom|nom de famille|nom du licencie|nom licencie|nom de naissance)$/,
    license: /^(n (de )?licence|no (de )?licence|numero (de )?licence|licence|n (de )?licencie|numero (de )?licencie)$/,
    primaryCategory: /^(categorie|categorie d age|categorie age|categorie licence|categorie sportive|categorie du licencie)$/,
  };
  const normalize = value => String(value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const licenseKey = value => String(value || "").replace(/[ -]/g, "").toUpperCase();
  const text = value => String(value ?? "").trim().replace(/\s+/g, " ");

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

  async function read(file) {
    if (!/\.xlsx?$/i.test(file.name) || !file.size || file.size > 8 * 1024 * 1024)
      throw Error("Choisissez un export Excel Footclubs (.xls ou .xlsx, 8 Mo maximum).");
    const xlsx = await loadParser();
    let book;
    try {
      book = xlsx.read(await file.arrayBuffer(), { sheetRows: 5001 });
    } catch {
      throw Error("Impossible de lire ce fichier Excel. Téléchargez de nouveau l’export Footclubs.");
    }
    for (const sheet of book.SheetNames) {
      const worksheet = book.Sheets[sheet];
      if (!worksheet["!ref"]) continue;
      const range = xlsx.utils.decode_range(worksheet["!ref"]);
      range.e.c = Math.min(range.e.c, range.s.c + 149);
      range.e.r = Math.min(range.e.r, 5000);
      const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false, range });
      let columns;
      const header = rows.slice(0, 50).findIndex(row => {
        columns = Object.fromEntries(Object.entries(aliases).map(([key, alias]) =>
          [key, row.findIndex(cell => alias.test(normalize(cell)))]));
        return columns.firstName >= 0 && columns.lastName >= 0;
      });
      if (header < 0) continue;
      if (worksheet["!fullref"] && xlsx.utils.decode_range(worksheet["!fullref"]).e.r >= 5000)
        throw Error("Cet export dépasse 5 000 lignes. Filtrez votre équipe dans Footclubs avant de réexporter.");
      const players = rows.slice(header + 1).flatMap(row => {
        const firstName = text(row[columns.firstName]);
        const lastName = text(row[columns.lastName]);
        if (!firstName || !lastName || aliases.firstName.test(normalize(firstName))) return [];
        const license = text(row[columns.license]);
        return [{
          firstName: firstName.slice(0, 25), lastName: lastName.slice(0, 25),
          name: (firstName + " " + lastName).slice(0, 25).trimEnd(),
          license: /^[A-Za-z0-9 -]{1,20}$/.test(license) ? license : "",
          primaryCategory: text(row[columns.primaryCategory]).slice(0, 30),
          photo: "", position: "",
        }];
      });
      if (players.length) return { sheet, players };
    }
    throw Error("Aucun joueur trouvé. L’export doit comporter les colonnes Nom et Prénom.");
  }

  function removeDuplicates(incoming, existing) {
    const names = new Map(), licenses = new Set();
    const nameKey = player => normalize(player.firstName && player.lastName
      ? player.firstName + " " + player.lastName : player.name);
    function remember(player) {
      const key = nameKey(player), license = licenseKey(player.license);
      if (!names.has(key)) names.set(key, new Set());
      names.get(key).add(license);
      if (license) licenses.add(license);
    }
    existing.forEach(remember);
    return incoming.filter(player => {
      const license = licenseKey(player.license), known = names.get(nameKey(player));
      if (licenses.has(license) || (known && (!license || known.has("")))) return false;
      remember(player);
      return true;
    });
  }

  function open() {
    const teamId = coachTeamSquadId();
    const dialog = el("dialog", "squad-editor squad-footclubs-import");
    const title = el("h2", "", "Importer depuis Footclubs");
    const instructions = el("p", "hint", "Déposez ici l’export .xls ou .xlsx téléchargé dans Footclubs, ou choisissez-le sur votre appareil.");
    const zone = el("label", "report-field", "Fichier Excel Footclubs");
    const input = el("input");
    input.type = "file";
    input.accept = ".xls,.xlsx";
    zone.append(input);
    const message = el("p", "hint");
    message.setAttribute("role", "status");
    const list = el("div", "squad-list squad-footclubs-results");
    const actions = el("div", "report-actions");
    const close = el("button", "export", "Fermer");
    const save = el("button", "primary", "Ajouter les joueurs sélectionnés");
    close.type = save.type = "button";
    close.onclick = () => dialog.close();
    save.disabled = true;
    actions.append(close, save);
    dialog.append(title, instructions, zone, message, list, actions);
    title.id = "squad-footclubs-title";
    dialog.setAttribute("aria-labelledby", title.id);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    document.body.append(dialog);

    let request = 0, choices = [];
    function selected() { return choices.filter(choice => choice.checkbox.checked).map(choice => choice.player); }
    function updateButton() {
      const count = selected().length;
      save.disabled = !count || count + squadPlayers().length > 100;
      save.textContent = count ? "Ajouter " + count + " joueur" + (count > 1 ? "s" : "") : "Ajouter les joueurs sélectionnés";
    }
    async function preview(file) {
      if (!file) return;
      const reading = ++request;
      choices = [];
      list.replaceChildren();
      updateButton();
      message.textContent = "Lecture du fichier Excel…";
      try {
        const { sheet, players } = await read(file);
        if (!dialog.open || reading !== request) return;
        const candidates = removeDuplicates(players, squadPlayers());
        const room = 100 - squadPlayers().length;
        message.textContent = sheet + " · " + candidates.length + " à ajouter · " +
          (players.length - candidates.length) + " doublon(s) écarté(s). " +
          (candidates.length > room ? "Sélectionnez jusqu’à " + room + " joueur(s)." : "Vérifiez votre sélection avant l’ajout.");
        choices = candidates.map(player => {
          const row = el("label", "squad-row");
          const checkbox = el("input");
          checkbox.type = "checkbox";
          checkbox.checked = candidates.length <= room;
          checkbox.onchange = updateButton;
          row.append(checkbox, el("span", "", [player.firstName + " " + player.lastName, player.primaryCategory].filter(Boolean).join(" · ")));
          list.append(row);
          return { player, checkbox };
        });
        updateButton();
      } catch (error) {
        if (dialog.open && reading === request) message.textContent = error.message;
      }
    }
    input.onchange = () => { preview(input.files[0]); input.value = ""; };
    dialog.ondragover = event => event.preventDefault();
    dialog.ondrop = event => { event.preventDefault(); preview(event.dataTransfer.files[0]); };
    save.onclick = () => {
      if (teamId !== coachTeamSquadId()) return dialog.close();
      const existing = squadPlayers(), additions = removeDuplicates(selected(), existing);
      if (!additions.length || existing.length + additions.length > 100) {
        message.textContent = "L’effectif a changé. Relisez le fichier pour actualiser la sélection.";
        return;
      }
      if (!squadSave([...existing, ...additions.map(player => ({ ...player, id: crypto.randomUUID() }))])) return;
      dialog.close();
      squadRender();
      notify(additions.length + " joueur(s) importé(s) dans votre effectif.");
    };
    dialog.showModal();
  }

  const button = el("button", "export", "Importer depuis Footclubs");
  button.type = "button";
  button.onclick = open;
  squadTools.insertBefore(button, squadImport);
})();

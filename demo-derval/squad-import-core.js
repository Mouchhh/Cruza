// Lecture d'une liste de joueurs (CSV ou lignes Excel) sans aucun accès réseau ni base de données.
// Fonctions pures : testées par tests/squad-import-core-test.cjs (node tests/squad-import-core-test.cjs).
(function (root) {
  // Excel (Windows, en français) enregistre souvent ses CSV en Windows-1252 : on bascule si l'UTF-8 échoue.
  function decodeText(buffer) {
    let text = new TextDecoder("utf-8").decode(buffer);
    if (text.includes("�")) text = new TextDecoder("windows-1252").decode(buffer);
    return text.replace(/^﻿/, "");
  }

  function parseCsv(text) {
    const end = text.search(/\r?\n|$/),
      firstLine = text.slice(0, end);
    const sep = [";", "\t", ","].reduce(
      (best, s) => (firstLine.split(s).length > firstLine.split(best).length ? s : best),
      ";",
    );
    const rows = [];
    let row = [],
      field = "",
      quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
        else if (c === '"') quoted = false;
        else field += c;
      } else if (c === '"' && field === "") quoted = true;
      else if (c === sep) row.push(field), (field = "");
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field), rows.push(row), (row = []), (field = "");
      } else field += c;
    }
    if (field !== "" || row.length) row.push(field), rows.push(row);
    return rows.filter((r) => r.some((v) => String(v).trim() !== ""));
  }

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  // Les titres attendus sont une hypothèse tant qu'on n'a pas vu un vrai export (FFF, Club Compagnon…).
  const FIELDS = [
    { key: "firstName", label: "Prénom", required: true, guess: ["prenom", "prenoms", "first name", "prenom joueur", "prenom du licencie", "prenom licencie"] },
    { key: "lastName", label: "Nom", guess: ["nom", "nom de famille", "nom joueur", "last name", "nom usage", "nom du licencie", "nom licencie", "nom de naissance"] },
    { key: "license", label: "N° de licence", guess: ["licence", "n licence", "no licence", "num licence", "numero licence", "numero de licence", "n de licence", "n de licencie", "numero de licencie", "numero licencie"] },
    { key: "category", label: "Catégorie", guess: ["categorie", "sous categorie", "cat", "categorie age", "categorie d age", "categorie licence", "categorie sportive", "categorie du licencie"] },
    { key: "birthDate", label: "Date de naissance", guess: ["date de naissance", "naissance", "date naissance", "ne le", "ddn", "ne e le"] },
    { key: "position", label: "Poste", guess: ["poste", "postes", "position"] },
  ];

  function guessMapping(header) {
    const names = header.map(normalize),
      used = new Set(),
      mapping = {};
    for (const field of FIELDS) {
      let index = names.findIndex((n, i) => !used.has(i) && field.guess.includes(n));
      // Repli : tous les mots d'un titre attendu présents (« Numéro de licence FFF »). « prenom » ne contient pas le mot « nom ».
      if (index < 0)
        index = names.findIndex((n, i) => {
          if (used.has(i)) return false;
          const words = n.split(" ");
          return field.guess.some((g) => g.split(" ").every((w) => words.includes(w)));
        });
      mapping[field.key] = index;
      if (index >= 0) used.add(index);
    }
    return mapping;
  }

  // Certains exports commencent par un titre (« Liste des licenciés… ») : on cherche la ligne qui contient « Prénom ».
  function findHeaderRow(rows) {
    for (let i = 0; i < Math.min(rows.length, 10); i++)
      if (guessMapping(rows[i].map(String)).firstName >= 0) return i;
    return 0;
  }

  function validDate(y, m, d) {
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }

  // Accepte 05/03/2011, 5-3-2011, 05.03.11, 2011-03-05 et les dates Excel (nombre de jours depuis 1899).
  function parseBirthDate(value, today = new Date()) {
    let y, m, d;
    if (typeof value === "number" && value > 0) {
      const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 864e5);
      (y = date.getUTCFullYear()), (m = date.getUTCMonth() + 1), (d = date.getUTCDate());
    } else {
      const text = String(value ?? "").trim().split(/[ T]/)[0];
      let match;
      if ((match = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) (y = +match[1]), (m = +match[2]), (d = +match[3]);
      else if ((match = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/))) {
        (d = +match[1]), (m = +match[2]), (y = +match[3]);
        if (match[3].length === 2) y += y <= today.getFullYear() % 100 ? 2000 : 1900;
      } else return null;
    }
    if (!validDate(y, m, d) || y < 1940 || y > today.getFullYear()) return null;
    return { year: y, month: m, day: d };
  }

  // Saison FFF du 1er juillet au 30 juin : en 2026-2027, un joueur né en 2011 est U16 (2027 - 2011).
  function seasonEndYear(today = new Date()) {
    return today.getMonth() >= 6 ? today.getFullYear() + 1 : today.getFullYear();
  }
  function categoryFromBirthYear(year, seasonEnd) {
    const age = seasonEnd - year;
    if (age < 5) return "";
    return age <= 19 ? "U" + age : "Seniors";
  }
  function normalizeCategory(value) {
    const text = String(value ?? "").trim(),
      n = normalize(text);
    let match;
    if ((match = n.match(/^(?:u|moins de)\s*(\d{1,2})(?:\s.*)?$/))) return "U" + +match[1];
    if (/^seniors?\b/.test(n)) return "Seniors";
    if (/^veterans?\b/.test(n)) return "Vétérans";
    return text.slice(0, 30);
  }
  function normalizePosition(value) {
    const n = normalize(value);
    if (!n) return "";
    // Les abréviations d'une lettre doivent être seules (« G »), sinon « gauche » deviendrait Gardien.
    if (/^(g|gb|gk)$|^(gardien|goal)/.test(n)) return "Gardien";
    if (/^(d|def)$|^(defenseur|arriere|lateral|libero|central)/.test(n)) return "Défenseur";
    if (/^(m|mil)$|^milieu/.test(n)) return "Milieu";
    if (/^(a|att)$|^(attaquant|avant|ailier|buteur)/.test(n)) return "Attaquant";
    return "";
  }

  // « MARTIN » → « Martin », « jean-PIERRE » → « Jean-Pierre », espaces en trop retirés.
  function cleanName(value) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .toLocaleLowerCase("fr")
      .replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep, letter) => sep + letter.toLocaleUpperCase("fr"));
  }

  const licenseKey = (value) => String(value || "").replace(/[\s-]/g, "").toUpperCase();
  const nameKey = (p) => normalize(p.firstName || p.lastName ? (p.firstName || "") + " " + (p.lastName || "") : p.name);

  // Reconnaît un joueur déjà connu : même licence, ou même nom quand l'un des deux n'a pas de licence.
  // Deux homonymes avec deux licences différentes restent deux joueurs (règle reprise de l'import d'Enzo).
  function createMatcher(list = []) {
    const byLicense = new Map(),
      byName = new Map();
    const matcher = {
      find(p) {
        const license = licenseKey(p.license),
          known = byName.get(nameKey(p)) || [];
        return (license && byLicense.get(license)) || known.find((k) => !license || !licenseKey(k.license)) || null;
      },
      add(p) {
        const license = licenseKey(p.license);
        if (license) byLicense.set(license, p);
        byName.set(nameKey(p), (byName.get(nameKey(p)) || []).concat(p));
      },
    };
    list.forEach(matcher.add);
    return matcher;
  }

  const MAX_NAME = 25; // même limite que la fiche joueur du site (prénom + nom)

  function buildPlayers(rows, mapping, options = {}) {
    const seasonEnd = options.seasonEnd || seasonEndYear(),
      firstLine = options.firstLine || 2,
      players = [],
      problems = [],
      seen = createMatcher();
    rows.forEach((row, i) => {
      if (!row.some((v) => String(v ?? "").trim())) return; // ligne vide d'un tableur
      const line = firstLine + i,
        raw = (key) => (mapping[key] >= 0 ? row[mapping[key]] : ""),
        get = (key) => String(raw(key) ?? "").trim();
      let firstName = cleanName(get("firstName")),
        lastName = cleanName(get("lastName"));
      if (!firstName) {
        problems.push({ line, message: "prénom manquant, ligne ignorée" + (lastName ? " (" + lastName + ")" : "") });
        return;
      }
      let name = (firstName + " " + lastName).trim();
      if (name.length > MAX_NAME && lastName) {
        const short = (firstName + " " + lastName[0] + ".").trim();
        if (short.length <= MAX_NAME) {
          problems.push({ line, message: "nom trop long, raccourci en « " + short + " »" });
          lastName = lastName[0] + ".";
          name = short;
        }
      }
      if (name.length > MAX_NAME) {
        problems.push({ line, message: "« " + name + " » dépasse 25 caractères, ligne ignorée" });
        return;
      }
      let license = get("license").replace(/\s+/g, "");
      if (license && !/^[A-Za-z0-9-]{1,20}$/.test(license)) {
        problems.push({ line, message: "numéro de licence illisible (« " + get("license") + " »), ignoré" });
        license = "";
      }
      let category = normalizeCategory(get("category"));
      if (!category && mapping.birthDate >= 0 && get("birthDate")) {
        const birth = parseBirthDate(raw("birthDate"));
        if (birth) category = categoryFromBirthYear(birth.year, seasonEnd);
        else problems.push({ line, message: "date de naissance illisible (« " + get("birthDate") + " »), catégorie à préciser" });
      }
      const player = { line, firstName, lastName, name, license, category, position: normalizePosition(get("position")) };
      const twin = seen.find(player);
      if (twin) {
        problems.push({ line, message: name + " est déjà ligne " + twin.line + ", doublon ignoré" });
        return;
      }
      seen.add(player);
      players.push(player);
    });
    return { players, problems };
  }

  const api = {
    FIELDS,
    MAX_NAME,
    decodeText,
    parseCsv,
    normalize,
    guessMapping,
    findHeaderRow,
    parseBirthDate,
    seasonEndYear,
    categoryFromBirthYear,
    normalizeCategory,
    normalizePosition,
    cleanName,
    createMatcher,
    buildPlayers,
  };
  if (typeof module !== "undefined") module.exports = api;
  else root.ImportEffectif = api;
})(this);

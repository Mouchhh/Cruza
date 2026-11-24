// Vérifie les règles de lecture : node apercu-import-effectif/test-core.js (joueurs inventés uniquement).
const assert = require("assert");
const I = require("./import-effectif-core.js");

// CSV : séparateur « ; », guillemets, retour à la ligne Windows, BOM
const rows = I.parseCsv('﻿Nom;Prénom;Poste\r\n"DUPONT; fils";Léo;"Milieu ""relayeur"""\r\n\r\nMARTIN;Inès;G\r\n'.replace(/^﻿/, ""));
assert.deepStrictEqual(rows, [["Nom", "Prénom", "Poste"], ["DUPONT; fils", "Léo", 'Milieu "relayeur"'], ["MARTIN", "Inès", "G"]]);
assert.deepStrictEqual(I.parseCsv("a,b\n1,2"), [["a", "b"], ["1", "2"]]);

// Accents : un CSV enregistré par Excel en Windows-1252
const latin1 = Uint8Array.from([0x50, 0x72, 0xe9, 0x6e, 0x6f, 0x6d]); // « Prénom »
assert.strictEqual(I.decodeText(latin1), "Prénom");
assert.strictEqual(I.decodeText(new TextEncoder().encode("﻿Prénom")), "Prénom");

// Colonnes : « Prénom » ne doit pas être pris pour « Nom »
const m = I.guessMapping(["NOM", "PRENOM", "Date de naissance", "Numéro de licence FFF", "Sous catégorie"]);
assert.deepStrictEqual([m.lastName, m.firstName, m.birthDate, m.license, m.category, m.position], [0, 1, 2, 3, 4, -1]);
assert.strictEqual(I.findHeaderRow([["Liste des licenciés"], ["Nom", "Prénom"], ["A", "B"]]), 1);

// Dates de naissance
const today = new Date(2026, 10, 24);
assert.deepStrictEqual(I.parseBirthDate("05/03/2011", today), { year: 2011, month: 3, day: 5 });
assert.deepStrictEqual(I.parseBirthDate("2011-03-05", today), { year: 2011, month: 3, day: 5 });
assert.deepStrictEqual(I.parseBirthDate("5.3.11", today), { year: 2011, month: 3, day: 5 });
assert.deepStrictEqual(I.parseBirthDate(40607, today), { year: 2011, month: 3, day: 5 }); // date Excel
assert.strictEqual(I.parseBirthDate("31/02/2011", today), null);
assert.strictEqual(I.parseBirthDate("mars 2011", today), null);
assert.strictEqual(I.parseBirthDate("01/01/2030", today), null);

// Catégories
assert.strictEqual(I.seasonEndYear(today), 2027);
assert.strictEqual(I.seasonEndYear(new Date(2027, 2, 1)), 2027);
assert.strictEqual(I.categoryFromBirthYear(2011, 2027), "U16");
assert.strictEqual(I.categoryFromBirthYear(2000, 2027), "Seniors");
assert.strictEqual(I.normalizeCategory("U 16 F"), "U16");
assert.strictEqual(I.normalizeCategory("Moins de 18"), "U18");
assert.strictEqual(I.normalizeCategory("SENIOR"), "Seniors");
assert.strictEqual(I.normalizePosition("Gauche"), "");
assert.strictEqual(I.normalizePosition("Défenseur central"), "Défenseur");
assert.strictEqual(I.cleanName("  jean-PIERRE  "), "Jean-Pierre");

// Construction : doublons, prénom manquant, nom trop long, date illisible, catégorie calculée
const header = ["Nom", "Prénom", "Date de naissance", "Licence"];
const data = [
  ["MARTIN", "Léo", "12/04/2011", "9000000001"],
  ["Martin", "léo", "12/04/2011", ""], // même nom : doublon
  ["BERNARD", "", "01/01/2011", "9000000002"],
  ["DE LA FONTAINE-MONTAGNE", "Maximilien", "01/01/2010", "9000000003"],
  ["PETIT", "Noah", "31/02/2011", "9000000004"],
];
const result = I.buildPlayers(data, I.guessMapping(header), { seasonEnd: 2027 });
assert.deepStrictEqual(result.players.map((p) => [p.name, p.category]), [["Léo Martin", "U16"], ["Maximilien D.", "U17"], ["Noah Petit", ""]]);
assert.deepStrictEqual(result.problems.map((p) => p.line), [3, 4, 5, 6]);
assert.ok(I.playerKeys({ firstName: "Léo", lastName: "MARTIN" }).includes("N:leo martin"));

console.log("import-effectif-core : tous les tests passent");

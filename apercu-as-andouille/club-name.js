// Le nom du club saisi dans Paramètres → Mon club s'applique partout : textes de l'écran, titre de la page,
// exports (images, PowerPoint). Le nom d'origine « AS Andouillé » sert de repère à remplacer.
const clubDefaultName = "AS Andouillé";
function clubDisplayName() {
  try {
    const stored = JSON.parse(coachStorageGet("vestiaire-club-details") || "null");
    const name = typeof stored?.name === "string" ? stored.name.trim() : "";
    if (name) return name;
  } catch {
    /* Storage not ready or unreadable: the default name stays. */
  }
  return clubDefaultName;
}
function clubDisplayNameUpper() {
  return clubDisplayName().toLocaleUpperCase("fr-FR");
}
(() => {
  const FIND = /stade mayennais/gi;
  const HAS = /stade mayennais/i;
  const ATTRIBUTES = ["alt", "title", "aria-label", "placeholder"];
  const texts = new WeakMap(); // text node -> { original, output }
  const attributes = new WeakMap(); // element -> Map(attribute -> { original, output })
  let current = clubDefaultName;
  const swap = (text) =>
    current === clubDefaultName
      ? text
      : text.replace(FIND, (match) => (match === match.toUpperCase() ? current.toLocaleUpperCase("fr-FR") : current));
  const skipped = (element) => !element || /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(element.tagName) || element.isContentEditable || element.closest("[data-keep-club-name]");
  function processText(node) {
    if (skipped(node.parentElement)) return;
    let record = texts.get(node);
    // The page rewrote this text itself: what it wrote becomes the new original.
    if (!record || record.output !== node.nodeValue) record = { original: node.nodeValue, output: node.nodeValue };
    if (!HAS.test(record.original)) {
      texts.delete(node);
      return;
    }
    const output = swap(record.original);
    record.output = output;
    texts.set(node, record);
    if (node.nodeValue !== output) node.nodeValue = output;
  }
  function processAttributes(element) {
    if (skipped(element)) return;
    let records = attributes.get(element);
    for (const name of ATTRIBUTES) {
      const value = element.getAttribute(name);
      if (value === null) continue;
      let record = records?.get(name);
      if (!record || record.output !== value) record = { original: value, output: value };
      if (!HAS.test(record.original)) {
        records?.delete(name);
        continue;
      }
      const output = swap(record.original);
      record.output = output;
      if (!records) attributes.set(element, (records = new Map()));
      records.set(name, record);
      if (value !== output) element.setAttribute(name, output);
    }
  }
  function walk(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let node = walker.currentNode; node; node = walker.nextNode()) {
      if (node.nodeType === 3) processText(node);
      else if (node.nodeType === 1) processAttributes(node);
    }
  }
  // Team names that start with the old club name ("AS Andouillé U16…") follow the new name.
  const LAST = "vestiaire-club-name-applied";
  function renameTeams(previous, next) {
    const fix = (value) => (typeof value === "string" && value.startsWith(previous) ? next + value.slice(previous.length) : value);
    try {
      if (typeof state !== "undefined" && state) {
        const team = fix(state.team);
        if (team !== state.team) {
          state.team = team;
          if (typeof persist === "function") persist();
          if (typeof render === "function") render();
        }
      }
      if (typeof currentTraining !== "undefined" && currentTraining) {
        const team = fix(currentTraining.team);
        if (team !== currentTraining.team) {
          currentTraining.team = team;
          if (typeof saveTrainingDraft === "function") saveTrainingDraft();
          if (typeof renderTrainingForm === "function") renderTrainingForm();
        }
      }
      for (const id of ["team", "club-team", "training-team"]) {
        const field = document.getElementById(id);
        if (field && "value" in field) field.value = fix(field.value);
      }
    } catch {
      /* Display names still follow through the page text pass below. */
    }
  }
  function refresh() {
    current = clubDisplayName();
    // Texte généré en CSS (en-tête des fenêtres) : passe par une variable.
    document.documentElement.style.setProperty("--club-name-upper", JSON.stringify(current.toLocaleUpperCase("fr-FR")));
    try {
      const previous = cruzaDemoLocalStorage.getItem(LAST) || clubDefaultName;
      if (previous !== current) {
        renameTeams(previous, current);
        cruzaDemoLocalStorage.setItem(LAST, current);
      }
    } catch {
      /* Private mode: no rename memory. */
    }
    walk(document.documentElement);
  }
  window.clubNameRefresh = refresh;
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") processText(record.target);
      else if (record.type === "attributes") processAttributes(record.target);
      else for (const node of record.addedNodes) node.nodeType === 3 ? processText(node) : node.nodeType === 1 && walk(node);
    }
  });
  function start() {
    refresh();
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRIBUTES });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  window.addEventListener("storage", refresh);
  document.addEventListener("club-session-ready", refresh);
})();

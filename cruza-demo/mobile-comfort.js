// Menu du bas sur téléphone : 5 entrées, différentes pour un coach et un responsable.
// Les autres rubriques sont rangées dans le menu du profil (rond en haut à droite).
(() => {
 const MAIN = {
  coach: ['view-home', 'view-pitch', 'view-training', 'view-coach-agenda', 'view-reports'],
  manager: ['view-home', 'view-management', 'view-coach-agenda', 'view-reports']
 };
 document.addEventListener('DOMContentLoaded', () => {
  const nav = document.getElementById('workspace-navigation'); if (!nav) return;
  function build() {
   const buttons = [...nav.querySelectorAll(':scope>button')];
   const mgr = document.getElementById('view-management');
   const demo = new URLSearchParams(location.search).get('mode') === 'local';
   const keep = MAIN[mgr && !mgr.hidden && !demo ? 'manager' : 'coach'];
   const menu = document.getElementById('coach-profile-options');
   menu?.querySelectorAll('.mc-extra').forEach(e => e.remove());
   for (const b of buttons) {
    const more = !keep.includes(b.id); b.dataset.mc = more ? 'more' : 'main';
    b.style.setProperty('--mc-order', keep.includes(b.id) ? keep.indexOf(b.id) : 9);
    if (!more || b.hidden || !menu) continue;
    const c = document.createElement('button'); c.type = 'button'; c.className = 'mc-extra';
    c.textContent = b.textContent.trim();
    c.onclick = () => { menu.hidden = true; document.getElementById('coach-profile-trigger')?.setAttribute('aria-expanded', 'false'); b.click(); };
    menu.append(c);
   }
  }
  new MutationObserver(build).observe(nav, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
  build();
 });

 // Téléphone : le terrain reste toujours en portrait (pas de place pour le paysage).
 document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('landscape-toggle'); if (!toggle) return;
  const phone = matchMedia('(max-width:700px)');
  const force = () => { if (phone.matches && document.body.classList.contains('landscape-mode')) toggle.click(); };
  new MutationObserver(force).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  force();
 });
 // Marque le bloc « Réglages du match » pour pouvoir le masquer sur téléphone.
 document.addEventListener('DOMContentLoaded', () => {
  const mark = () => document.querySelectorAll('summary:not(.mc-hide-reglages)').forEach(s => { if (/^\s*Réglages du match/.test(s.textContent)) s.classList.add('mc-hide-reglages'); });
  new MutationObserver(mark).observe(document.body, { childList: true, subtree: true }); mark();
 });
 // Téléphone : bouton d'enregistrement du haut sans flèche ni mots en trop (« Enregistrer »).
 document.addEventListener('DOMContentLoaded', () => {
  const phone = matchMedia('(max-width:700px)');
  const clean = () => { const b = document.getElementById('save'); if (!b || !phone.matches) return; const t = b.textContent, n = t.replace(/\s*↗/, '').replace(/^(Enregistrer)\s+(la|le|l’)\s*\S+/, '$1').trim(); if (n && n !== t) b.textContent = n; };
  const b = document.getElementById('save'); if (!b) return;
  new MutationObserver(clean).observe(b, { childList: true, characterData: true, subtree: true }); clean();
 });
 // Téléphone : page Séances. Étapes 1-4 remplacées par « Étape 3 sur 4 » ; actions sur une ligne ; Fiche terrain en bas.
 document.addEventListener('DOMContentLoaded', () => {
  let done = false;
  const phone = matchMedia('(max-width:700px)');
  function init() {
  const first = document.getElementById('training-step-link-0'); if (!first || done) return; done = true;
  const bar = first.parentElement; bar.classList.add('mc-step-stepper');
  const label = document.createElement('div'); label.className = 'mc-step-label'; bar.prepend(label);
  const steps = [...bar.querySelectorAll(':scope>button')];
  const upd = () => { const i = steps.findIndex(b => b.classList.contains('active')); if (i < 0) return; const name = steps[i].textContent.replace(/^\s*\d+\s*/, '').trim(); label.textContent = 'Étape ' + (i + 1) + ' sur ' + steps.length + ' · ' + name; };
  new MutationObserver(upd).observe(bar, { attributes: true, subtree: true, attributeFilter: ['class'] }); upd();
  const field = document.getElementById('training-field-open'), next = document.getElementById('training-next');
  if (field && next) {
   const home = { parent: field.parentElement, before: field.nextSibling };
   const place = () => { if (phone.matches) { field.classList.add('mc-field-link'); next.parentElement.after(field); } else { field.classList.remove('mc-field-link'); home.parent.insertBefore(field, home.before); } };
   phone.addEventListener('change', place); place();
  }
  }
  new MutationObserver(init).observe(document.body, { childList: true, subtree: true }); init();
 });
 // Téléphone : page Exercices allégée (Affiner masqué, nombre de résultats sous les filtres).
 document.addEventListener('DOMContentLoaded', () => {
  const phone = matchMedia('(max-width:700px)');
  let home = null;
  const run = () => {
   document.querySelectorAll('summary').forEach(s => { if (/^\s*Affiner la recherche/.test(s.textContent)) s.parentElement.classList.add('mc-hide'); });
   const r = document.getElementById('bible-results'), cat = document.getElementById('training-catalogue');
   if (!r || !cat) return;
   if (phone.matches) { if (!home) home = { parent: r.parentElement, before: r.nextSibling }; if (r.nextElementSibling !== cat) cat.before(r); }
   else if (home) { home.parent.insertBefore(r, home.before); home = null; }
  };
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true }); phone.addEventListener('change', run); run();
 });
 // Téléphone : assistant « Créer ma séance avec l'Assistant » — message clair si aucune intention de jeu n'est cochée.
 (() => {
  const phone = matchMedia('(max-width:700px)');
  window.addEventListener('submit', e => {
   const form = e.target; if (!phone.matches || !form.matches || !form.matches('.training-assistant-form')) return;
   const set = form.querySelector('.training-assistant-objectives'); if (!set || set.querySelector('input:checked')) return;
   e.preventDefault(); e.stopImmediatePropagation();
   let msg = document.getElementById('mc-intent-error');
   if (!msg) { msg = document.createElement('p'); msg.id = 'mc-intent-error'; msg.className = 'mc-error'; msg.setAttribute('role', 'alert'); set.after(msg); set.addEventListener('change', () => msg.remove()); }
   msg.textContent = 'Choisissez au moins une intention de jeu : ouvrez une intention dans la liste, puis cochez une sous-partie.';
   set.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, true);
 })();
 // Téléphone : liste « Mes séances » — « Créer ma séance » à côté de la recherche, sans doublon de titre ni brouillon.
 document.addEventListener('DOMContentLoaded', () => {
  let done = false;
  function init() {
   const create = document.getElementById('training-create-session'), label = document.querySelector('.training-library-search');
   if (!create || !label || done) return; done = true;
   const row = document.createElement('div'); row.className = 'mc-search-row';
   const input = label.querySelector('input'); if (input && matchMedia('(max-width:700px)').matches) input.placeholder = 'Rechercher une séance';
   label.before(row); row.append(label, create);
  }
  new MutationObserver(init).observe(document.body, { childList: true, subtree: true }); init();
 });
 // Téléphone : l'éditeur d'exercice dessine le terrain en portrait (le plus grand possible).
 document.addEventListener('DOMContentLoaded', () => {
  const phone = matchMedia('(max-width:700px)');
  const apply = () => {
   const c = document.getElementById('exercise-board-canvas'); if (!c) return;
   const want = phone.matches ? 'true' : 'false';
   if (c.dataset.portrait !== want) { c.dataset.portrait = want; try { if (typeof exerciseEditorRefresh === 'function') exerciseEditorRefresh(); } catch {} }
  };
  new MutationObserver(apply).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden'] });
  phone.addEventListener('change', apply); apply();
 });
})();

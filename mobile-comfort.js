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

 // Bouton « Paysage » dans la barre d'actions de la Tactique (même réglage que « Terrain paysage »).
 document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('landscape-toggle'); if (!toggle) return;
  const label = () => document.body.classList.contains('landscape-mode') ? '▯ Portrait' : '▭ Paysage';
  function sync() {
   document.querySelectorAll('.tactic-compact-actions').forEach(bar => {
    let b = bar.querySelector('.mc-landscape');
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'mc-landscape export'; b.onclick = () => toggle.click(); bar.append(b); }
    if (b.textContent !== label()) b.textContent = label();
   });
  }
  new MutationObserver(sync).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  sync();
 });
})();

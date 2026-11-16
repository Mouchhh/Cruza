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
   const keep = MAIN[mgr && !mgr.hidden ? 'manager' : 'coach'];
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
})();

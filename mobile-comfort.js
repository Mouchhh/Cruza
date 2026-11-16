// Menu du bas sur téléphone : 4 entrées + « Plus », différent pour un coach et pour un responsable.
(() => {
 const phone = matchMedia('(max-width:700px)');
 const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false" class="navigation-icon"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>';
 const MAIN = {
  coach: ['view-home', 'view-pitch', 'view-training', 'view-coach-agenda'],
  manager: ['view-home', 'view-management', 'view-reports']
 };
 document.addEventListener('DOMContentLoaded', () => {
  const nav = document.getElementById('workspace-navigation'); if (!nav) return;
  const plus = document.createElement('button'); plus.type = 'button'; plus.className = 'mc-plus';
  plus.setAttribute('aria-haspopup', 'true'); plus.setAttribute('aria-expanded', 'false'); plus.setAttribute('aria-label', 'Plus de rubriques');
  plus.innerHTML = PLUS + '<span class="navigation-label">Plus</span>';
  const sheet = document.createElement('div'); sheet.className = 'mc-sheet'; sheet.hidden = true; sheet.setAttribute('role', 'menu');
  nav.append(plus); document.body.append(sheet);
  const close = () => { sheet.hidden = true; plus.setAttribute('aria-expanded', 'false'); };
  function build() {
   const buttons = [...nav.querySelectorAll(':scope>button:not(.mc-plus)')];
   const mgr = document.getElementById('view-management');
   const kind = mgr && !mgr.hidden ? 'manager' : 'coach', keep = MAIN[kind];
   sheet.replaceChildren(); let current = false;
   for (const b of buttons) {
    const more = !keep.includes(b.id); b.dataset.mc = more ? 'more' : 'main';
    if (b.hidden || !more) continue;
    if (b.getAttribute('aria-current') === 'page') current = true;
    const c = document.createElement('button'); c.type = 'button'; c.setAttribute('role', 'menuitem');
    if (b.getAttribute('aria-current') === 'page') c.setAttribute('aria-current', 'page');
    c.innerHTML = (b.querySelector('svg')?.outerHTML || '') + '<span>' + b.textContent.trim() + '</span>';
    c.onclick = () => { close(); b.click(); }; sheet.append(c);
   }
   buttons.forEach((b, i) => { b.style.order = keep.includes(b.id) ? keep.indexOf(b.id) : 9; });
   plus.style.order = 5; plus.classList.toggle('mc-current', current);
  }
  plus.onclick = () => { const open = sheet.hidden; build(); sheet.hidden = !open; plus.setAttribute('aria-expanded', String(open)); };
  document.addEventListener('click', e => { if (!sheet.hidden && !sheet.contains(e.target) && !plus.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); plus.focus(); } });
  phone.addEventListener('change', close);
  new MutationObserver(build).observe(nav, { attributes: true, subtree: true, attributeFilter: ['hidden', 'aria-current'] });
  build();
 });
})();

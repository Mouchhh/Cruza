/* Cruza — enregistre le service worker et propose la nouvelle version (jamais de rechargement forcé). */
(function () {
  if (!('serviceWorker' in navigator)) return;
  if (!(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;

  let banner = null;
  function showBanner(worker) {
    if (banner) return;
    banner = document.createElement('div');
    banner.setAttribute('role', 'status');
    banner.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:520px;margin:0 auto;display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:12px;background:#0B2E8A;color:#fff;font:15px/1.35 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.3)';
    const text = document.createElement('span');
    text.textContent = 'Nouvelle version de Cruza disponible. Terminez votre saisie, puis rechargez.';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Recharger';
    button.style.cssText = 'flex:none;padding:8px 14px;border:0;border-radius:8px;background:#fff;color:#0B2E8A;font:600 15px system-ui,sans-serif;cursor:pointer';
    const later = document.createElement('button');
    later.type = 'button';
    later.textContent = 'Plus tard';
    later.setAttribute('aria-label', 'Fermer');
    later.style.cssText = 'flex:none;padding:8px;border:0;background:transparent;color:#fff;font:15px system-ui,sans-serif;cursor:pointer;text-decoration:underline';
    button.onclick = () => { button.disabled = true; worker.postMessage({ type: 'SKIP_WAITING' }); };
    later.onclick = () => { banner.remove(); };
    banner.append(text, button, later);
    document.body.appendChild(banner);
  }

  let reloading = false;
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }   // 1re installation : le worker prend la main, rien à recharger
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  navigator.serviceWorker.register('sw.js').then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) showBanner(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showBanner(worker);
      });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
})();

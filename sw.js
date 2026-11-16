/* Cruza — service worker.
   La ligne VERSION est réécrite automatiquement (scripts/stamp-sw-version.sh) :
   chaque modification du site change cette ligne, donc sw.js, donc déclenche la mise à jour. */
const VERSION = 'ad355288d2';
const CACHE = 'cruza-' + VERSION;
const CORE = ['manifest.webmanifest', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/apple-touch-icon.png'];

self.addEventListener('install', event => {
  // Pas de skipWaiting automatique : l'éducateur choisit quand passer à la nouvelle version (bandeau).
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).catch(() => {}));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('cruza-') && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function put(request, response) {
  if (response && response.status === 200 && response.type === 'basic') {
    try { await (await caches.open(CACHE)).put(request, response.clone()); } catch (e) { /* quota plein : on ignore */ }
  }
  return response;
}

// Réseau d'abord, copie en secours (pages et fichiers sans numéro de version).
async function networkFirst(request, fallbackUrl) {
  try { return await put(request, await fetch(request)); }
  catch (e) {
    return (await caches.match(request)) || (fallbackUrl && await caches.match(fallbackUrl)) ||
      new Response('Hors connexion', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

// Copie d'abord (fichiers dont l'adresse contient ?v=… : une autre version = une autre adresse).
async function cacheFirst(request) {
  return (await caches.match(request)) || put(request, await fetch(request));
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;               // Supabase, Canva, polices externes : jamais interceptés
  if (request.headers.has('range')) return;                      // vidéos : on laisse le navigateur faire
  if (url.pathname.includes('/assets/videos/')) return;          // trop lourd pour le cache
  if (url.pathname.endsWith('/sw.js')) return;                   // le navigateur gère seul ses mises à jour
  if (request.mode === 'navigate') { event.respondWith(networkFirst(request, 'index.html')); return; }
  event.respondWith(url.searchParams.has('v') ? cacheFirst(request) : networkFirst(request));
});

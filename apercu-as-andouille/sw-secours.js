/* SW DE SECOURS — à utiliser seulement si le service worker pose problème.
   Mode d'emploi : copier ce fichier PAR-DESSUS sw.js, publier. À la prochaine ouverture,
   chaque téléphone supprime ses copies, se désinscrit et recharge la page : le site redevient un site normal. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) await caches.delete(name);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
  })());
});

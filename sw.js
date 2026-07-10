// Ce service worker se désinstalle proprement pour effacer tout cache précédent
// et laisser le navigateur charger directement depuis le réseau.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// Aucune interception des requêtes : tout passe par le réseau normalement

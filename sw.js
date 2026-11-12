// Service worker : l'appli s'ouvre même sans réseau (dernières données connues)
const CACHE = "departs-unac-v17";
const SHELL = ["./", "index.html", "manifest.webmanifest", "img/avion-unac.png", "img/unac-texte.png", "img/logo-unac-blanc.png", "fonts/sfr-r.woff2", "fonts/sfr-b.woff2", "img/titre-prochains-departs.png", "img/titre-lc.png", "img/titre-mc.png", "img/air-france-blanc.png", "img/air-france-virgule.png",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/favicon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Réseau d'abord (données et page toujours fraîches), cache en secours hors connexion
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); const key = url.pathname.endsWith("flights.json") ? "data/flights.json" : e.request;
        caches.open(CACHE).then(c => c.put(key, copy)); }
      return r;
    }).catch(() => caches.match(url.pathname.endsWith("flights.json") ? "data/flights.json" : e.request).then(m => m || caches.match("index.html")))
  );
});

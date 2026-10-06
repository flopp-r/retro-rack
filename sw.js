// Retro Rack service worker: lets the installed game start without internet.
// Network first, always: when online, every file comes fresh from the site (so updates arrive straight away and
// both online players get the same version); the saved copy is used only when the network fails.
const CACHE = 'retro-rack';
const FILES = ['./', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'no-cache' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // the game is one page, so every visit to it shares one saved copy, whatever the ?relay= or #room= part says
  const home = new URL('./', self.registration.scope);
  const page = req.mode === 'navigate' && (url.pathname === home.pathname || url.pathname === home.pathname + 'index.html');
  if (req.mode === 'navigate' && !page) return;   // other pages on the site (README and so on) aren't the game
  const key = page ? home.href : req;
  e.respondWith((async () => {
    try {
      // 'no-cache' checks with the site each time (cheap when nothing changed) instead of trusting the browser cache
      let res = await fetch(page ? req.url : req, { cache: 'no-cache', credentials: 'same-origin' });
      if (page && res.redirected) res = await fetch(req);
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        e.waitUntil(caches.open(CACHE).then(c => c.put(key, copy)));
      }
      return res;
    } catch (err) {
      const saved = await caches.match(key, { ignoreSearch: true });
      if (saved) return saved;
      throw err;
    }
  })());
});

var CACHE = 'glasses-cinema-v1';
var SHELL = ['./', './index.html', './app.js', './manifest.json', './icon.png',
  './media/bbb.jpg','./media/sintel.jpg','./media/tos.jpg','./media/ed.jpg','./media/cosmos.jpg','./media/spring.jpg','./media/agent327.jpg','./media/caminandes.jpg'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.pathname.endsWith('.mp4')) return; // videos stream from network
  e.respondWith(caches.match(e.request).then(function (r) { return r || fetch(e.request); }));
});

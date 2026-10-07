var CACHE = 'glasses-cinema-v7';
var SHELL = ['./', './index.html', './app.js', './library.js', './manifest.json', './icon.png',
  './media/pioneer.jpg','./media/lastman.jpg','./media/terror.jpg','./media/hauntedhill.jpg','./media/hitchhiker.jpg','./media/stooges.jpg','./media/notld.jpg','./media/littleshop.jpg','./media/bevhill.jpg','./media/hisgirl.jpg','./media/dementia13.jpg','./media/reefer.jpg','./media/teenagers.jpg'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return; // videos stream from archive.org
  e.respondWith(fetch(e.request).then(function (r) {
    var copy = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copy); }); return r;
  }).catch(function () { return caches.match(e.request); }));
});

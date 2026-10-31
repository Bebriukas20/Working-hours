/* Offline cache for Work Hours. Bump VERSION when files change. */
var VERSION = 'wh-v5';
var FILES = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'vendor/jspdf.umd.min.js', 'vendor/jspdf.plugin.autotable.min.js', 'vendor/pdf-fonts.js',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Network first for the page (so updates arrive), cache first for everything else.
  if (e.request.mode === 'navigate') {
    // If the network fails OR the host answers with an error (e.g. site moved), keep using the cached app.
    e.respondWith(fetch(e.request).then(function (r) {
      if (!r.ok) throw new Error('bad status ' + r.status);
      var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put('index.html', copy); }); return r;
    }).catch(function () {
      return caches.match('index.html', { ignoreSearch: true }).then(function (hit) { return hit || fetch(e.request); });
    }));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).then(function (r) {
      if (r.ok) { var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); }); }
      return r;
    });
  }));
});

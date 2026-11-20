const cacheName = 'pixel-scout-mobile-v2';
const scope = new URL(self.registration.scope);
const hub = new URL('games/', scope).href;
const shell = ['games/', 'games/launcher.js', 'games/launcher.css', 'games/registry.json',
  'assets/ball.svg', 'app.webmanifest', 'mobile/install.js', 'mobile/install.css',
  'mobile/icon-192.png', 'mobile/icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell.map(file => new URL(file, scope)))));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('pixel-scout-mobile-') && key !== cacheName)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const {request} = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const relative = url.pathname.slice(scope.pathname.length);
  if (relative.startsWith('api/')) return;

  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        try { await cache.put(request, response.clone()); } catch { /* Storage can be full. */ }
      }
      return response;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        if (url.href === scope.href) return Response.redirect(hub);
        return new Response('<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pixel Scout</title><h1>Bu oyun bağlantı gerektiriyor</h1><p><a href="'+hub+'">Oyunlara dön</a></p></html>',
          {headers:{'Content-Type':'text/html; charset=utf-8'}});
      }
      return Response.error();
    }
  })());
});

// OpenTip service worker: installable PWA, offline form shell, and generic push notifications.
// It never caches API responses, tip pages, or anything from /check or /staff.
const STATIC = 'opentip-static-v1';
const PAGES = 'opentip-pages-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(PAGES).then((c) => c.addAll(['/', '/submit'])).catch(() => {}));
});

self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;

  if (u.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.open(STATIC).then(async (c) => (await c.match(r)) || fetch(r).then((res) => { c.put(r, res.clone()); return res; })),
    );
    return;
  }
  if (r.mode === 'navigate' && (u.pathname === '/' || u.pathname === '/submit')) {
    e.respondWith(
      fetch(r)
        .then((res) => { const copy = res.clone(); caches.open(PAGES).then((c) => c.put(r, copy)); return res; })
        .catch(() => caches.match(r)),
    );
  }
});

// The push carries NO data. This fixed text is all that can ever appear in an OS notification preview.
self.addEventListener('push', (e) => {
  e.waitUntil(
    self.registration.showNotification('Tip update', {
      body: 'You have an update on your tip.',
      tag: 'tip-update',
      icon: '/icons/icon-192.png',
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow('/check'));
});

/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

declare let self: ServiceWorkerGlobalScope;

// Precache app shell
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA navigation fallback — serve index.html for all navigation requests
// This ensures offline navigation works (e.g. start_url with query params,
// hash-based routes, deep links)
const navigationHandler = createHandlerBoundToURL('/index.html');
registerRoute(new NavigationRoute(navigationHandler));

// Cache-First for static assets (icons, fonts, audio)
registerRoute(
  ({ request }) =>
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.url.includes('/audio/'),
  new CacheFirst({
    cacheName: 'static-assets',
  }),
);

// Stale-While-Revalidate for module code
registerRoute(
  ({ url }) => url.pathname.includes('/modules/'),
  new StaleWhileRevalidate({
    cacheName: 'module-code',
  }),
);

// Network-Only for API calls with background sync
const bgSyncPlugin = new BackgroundSyncPlugin('upload-results', {
  maxRetentionTime: 24 * 60, // 24 hours
});

registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'POST',
);

// Network-Only for GET API calls (no caching)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkOnly(),
  'GET',
);

// Skip waiting control — do NOT auto-skip
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Asset verification on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
    })(),
  );
});

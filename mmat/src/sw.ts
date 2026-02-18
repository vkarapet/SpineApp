/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { handleProxyRequest } from './mock-proxy';

declare let self: ServiceWorkerGlobalScope;

// Precache app shell
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA navigation fallback — serve index.html for all navigation requests
// This ensures offline navigation works (e.g. start_url with query params,
// hash-based routes, deep links)
const base = import.meta.env.BASE_URL || '/';
const navigationHandler = createHandlerBoundToURL(base + 'index.html');
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

// Mock proxy for API calls — intercept POST /api/proxy in the SW
registerRoute(
  ({ url, request }) =>
    request.method === 'POST' && url.pathname.includes('/api/proxy'),
  async ({ request }) => handleProxyRequest(request),
  'POST',
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

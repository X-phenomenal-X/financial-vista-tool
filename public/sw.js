// Wealthpilot service worker.
//
// Scope notes:
//  - Supabase and Google Fonts are cross-origin, so they fall through to the
//    network untouched. Nothing authenticated is ever cached from them here.
//  - Rendered pages go in their own cache so sign-out can drop them without
//    throwing away the static shell.

const VERSION = "v2";
const SHELL_CACHE = `wp-shell-${VERSION}`;
const PAGE_CACHE = `wp-pages-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, PAGE_CACHE];

const OFFLINE_URL = "/offline.html";
const SHELL_ASSETS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/icon-any-192.png",
  "/icon-any-512.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Settled rather than addAll: one missing asset must not fail the install.
      Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(asset))),
    ),
    // No skipWaiting() — the page decides when to activate an update so a
    // running session never gets swapped underneath itself.
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !CURRENT_CACHES.includes(key)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (type === "CLEAR_PRIVATE_CACHE") {
    // Called on sign-out: rendered financial screens must not outlive the session.
    event.waitUntil(caches.delete(PAGE_CACHE));
  }
});

function isCacheable(response) {
  return response && response.status === 200 && response.type === "basic";
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (isCacheable(response)) {
      const copy = response.clone();
      caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch {
    const cached = await caches.match(request, { cacheName: PAGE_CACHE, ignoreSearch: true });
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL, { cacheName: SHELL_CACHE });
    if (offline) return offline;
    return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function handleAsset(request, url) {
  const cached = await caches.match(request, { cacheName: SHELL_CACHE });

  // Build output under /assets/ is content-hashed, so a hit is always current.
  if (cached && url.pathname.startsWith("/assets/")) return cached;

  const network = fetch(request)
    .then((response) => {
      if (isCacheable(response)) {
        const copy = response.clone();
        caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => cached);

  // Everything else is stale-while-revalidate.
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleAsset(request, url));
});

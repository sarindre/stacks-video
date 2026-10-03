// Stacks Video service worker: makes the app open and work without internet.
//
// - Everything the build produced is stored when the worker installs (the list below is
//   filled in by the build, see vite.config.ts), so every screen works offline.
// - Opening the app tries the network first (so updates arrive) and falls back to the stored copy.
// - Cover images from the lookup services are stored as you see them, up to a limit.
// - API calls (TMDB, Open Library, MusicBrainz, UPC) are left alone.
// Your collection is not stored here; it lives in localStorage.

const BUILD = "__BUILD__";
const PRECACHE = /*__PRECACHE__*/[];

const SHELL_PREFIX = "stacks-video-shell-";
const SHELL = `${SHELL_PREFIX}${BUILD}`;
const COVERS = "stacks-video-covers-v1";
const MAX_COVERS = 400;
const KEEP_SHELLS = 2; // current build + previous, so a tab still on the old build can load its files
const COVER_HOSTS = ["image.tmdb.org", "covers.openlibrary.org", "coverartarchive.org"];

// Servers often send "Vary: Origin"; ignore it so stored files are found.
const LOOKUP = { ignoreVary: true };
const fromScope = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE.map(fromScope)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const shells = (await caches.keys()).filter((k) => k.startsWith(SHELL_PREFIX) && k !== SHELL);
      await Promise.all(shells.slice(0, Math.max(0, shells.length - (KEEP_SHELLS - 1))).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(request.mode === "navigate" ? openApp() : fromCache(request));
  } else if (COVER_HOSTS.includes(url.hostname)) {
    event.respondWith(cover(request));
  }
});

async function openApp() {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(fromScope("./"));
    if (response.ok) cache.put(fromScope("./"), response.clone());
    return response;
  } catch {
    return (await cache.match(fromScope("./"), LOOKUP)) || (await cache.match(fromScope("index.html"), LOOKUP)) || Response.error();
  }
}

// Built files carry content hashes in their names, so a stored one is always right.
async function fromCache(request) {
  const hit = await caches.match(request, LOOKUP);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) (await caches.open(SHELL)).put(request, response.clone());
  return response;
}

async function cover(request) {
  const cache = await caches.open(COVERS);
  const hit = await cache.match(request.url, LOOKUP);
  if (hit) return hit;
  try {
    const response = await fetch(request.url, { mode: "cors" });
    if (response.ok) {
      await cache.put(request.url, response.clone());
      trim(cache);
    }
    return response;
  } catch {
    try {
      return await fetch(request); // CORS refused: still show it, just don't keep it
    } catch {
      return Response.error(); // offline and never seen: the card shows its placeholder
    }
  }
}

async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_COVERS)).map((k) => cache.delete(k)));
}

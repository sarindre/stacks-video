// Stacks Video service worker: makes the app open and work without internet.
//
// - Everything the build produced is stored when the worker installs (the list below is
//   filled in by the build, see vite.config.ts), so every screen works offline.
// - Opening the app tries the network first (so updates arrive) and falls back to the stored copy.
// - Cover images from the lookup services are stored as you see them, up to a limit, and each is
//   dropped after about five months: TMDB's terms don't allow keeping its content cached for more
//   than six, so every stored image is stamped with the time it was saved.
// - API calls (TMDB, Open Library, MusicBrainz, UPC) are left alone.
// Your collection is not stored here; it lives in localStorage.

const BUILD = "__BUILD__";
const PRECACHE = /*__PRECACHE__*/[];

const SHELL_PREFIX = "stacks-video-shell-";
const SHELL = `${SHELL_PREFIX}${BUILD}`;
const COVERS = "stacks-video-covers-v1";
const MAX_COVERS = 400;
const MAX_COVER_AGE_MS = 150 * 24 * 60 * 60 * 1000; // about five months, safely inside TMDB's six
const STAMP = "x-cached-at"; // when we saved it (an added header)
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
      await sweepCovers();
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

// How old a stored image is: our own stamp, else the server's Date header. An image whose age we
// can't tell counts as stale, so it is refetched rather than kept.
function isStale(response, now = Date.now()) {
  const saved = Number(response.headers.get(STAMP)) || Date.parse(response.headers.get("date") || "");
  return !Number.isFinite(saved) || now - saved > MAX_COVER_AGE_MS;
}

// A copy of the response with the time we saved it added.
async function stamped(response) {
  const headers = new Headers(response.headers);
  headers.set(STAMP, String(Date.now()));
  return new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers });
}

// Removes every stored image that has passed its time limit (run each time a new version activates).
async function sweepCovers() {
  const cache = await caches.open(COVERS);
  for (const key of await cache.keys()) {
    const hit = await cache.match(key, LOOKUP);
    if (!hit || isStale(hit)) await cache.delete(key);
  }
}

async function cover(request) {
  const cache = await caches.open(COVERS);
  const hit = await cache.match(request.url, LOOKUP);
  if (hit && !isStale(hit)) return hit;
  if (hit) await cache.delete(request.url); // expired: never serve it, fetch a fresh copy
  try {
    const response = await fetch(request.url, { mode: "cors" });
    if (response.ok) {
      await cache.put(request.url, await stamped(response.clone()));
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

// Lets the unit test (src/lib/swExpiry.test.ts) load the expiry rule without a browser.
if (typeof module !== "undefined" && module.exports) module.exports = { isStale, MAX_COVER_AGE_MS, STAMP };

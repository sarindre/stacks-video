// The desktop app's rules about which addresses it will load and open, and which permissions its
// pages may use. Pure, so they can be tested without starting Electron (see src/desktop/policy.test.ts).

const path = require("node:path");

const APP_SCHEME = "app";
const APP_HOST = "stacksvideo";

// where the app lives while it's running: app://stacksvideo/
const appUrl = (suffix = "") => `${APP_SCHEME}://${APP_HOST}/${suffix}`;

// Is this one of the app's own pages? (anything else must not be loaded inside the window)
function isAppUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === `${APP_SCHEME}:` && u.host === APP_HOST;
  } catch {
    return false;
  }
}

// Links that may be handed to the user's browser: ordinary web addresses only. Never file:,
// app:, javascript: or anything else a page could try to launch.
function isSafeExternal(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// The file on disk for a request to the app, or null if it would leave the app's folder.
function resolveAppFile(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(String(pathname || "/"));
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const relative = decoded.replace(/^\/+/, "") || "index.html";
  const resolved = path.resolve(root, relative);
  const base = path.resolve(root);
  return resolved === base || resolved.startsWith(base + path.sep) ? resolved : null;
}

// Permissions the app's pages may use. Everything else is refused.
//  - clipboard-sanitized-write: "Copy" buttons
//  - notifications, fileSystem: reserved for features and for choosing an automatic backup folder
//  - media: only the camera, only for barcode scanning (see mediaAllowed)
const ALLOWED_PERMISSIONS = new Set(["clipboard-sanitized-write", "notifications", "fileSystem"]);

// The camera may be used, the microphone may not. Electron describes the request in two ways:
// an asynchronous request lists `mediaTypes` (["video"], ["audio"], or both); the synchronous
// check has a single `mediaType`. A request that includes audio is refused outright.
function mediaAllowed(details) {
  if (!details) return false;
  if (Array.isArray(details.mediaTypes)) return details.mediaTypes.length > 0 && details.mediaTypes.every((t) => t === "video");
  return details.mediaType === "video";
}

function permissionAllowed(permission, requestingUrl, details) {
  if (!isAppUrl(requestingUrl)) return false;
  if (permission === "media") return mediaAllowed(details);
  return ALLOWED_PERMISSIONS.has(permission);
}

module.exports = { APP_SCHEME, APP_HOST, appUrl, isAppUrl, isSafeExternal, resolveAppFile, ALLOWED_PERMISSIONS, mediaAllowed, permissionAllowed };

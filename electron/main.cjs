// Stacks Video desktop: a window around the built web app (dist/). The app is served from its own
// app://stacksvideo/ address, so it behaves like a normal website (its own storage, a secure
// context) without running a server. All the app's logic is the web app's; nothing here sees your data.

const { app, BrowserWindow, Menu, net, protocol, session, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { APP_SCHEME, appUrl, isAppUrl, isSafeExternal, permissionAllowed, resolveAppFile } = require("./policy.cjs");

const DIST = path.join(__dirname, "..", "dist");
const DEV_URL = process.env.STACKSVIDEO_URL || ""; // optional: point the window at a running dev server
const PROJECT_URL = "https://github.com/sarindre/stacks-video";

protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

function openExternal(url) {
  if (isSafeExternal(url)) shell.openExternal(url);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 600,
    backgroundColor: "#151311",
    title: "Stacks Video",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once("ready-to-show", () => win.show());

  // links that leave the app go to the user's browser; the window only ever shows the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (DEV_URL && url.startsWith(DEV_URL)) return;
    if (!isAppUrl(url)) {
      event.preventDefault();
      openExternal(url);
    }
  });

  win.loadURL(DEV_URL || appUrl());
  return win;
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "editMenu" },
    {
      label: "View",
      submenu: [{ role: "reload" }, { role: "togglefullscreen" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, ...(app.isPackaged ? [] : [{ role: "toggleDevTools" }])],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [{ label: "Stacks Video on GitHub", click: () => openExternal(PROJECT_URL) }],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!app.requestSingleInstanceLock()) {
  app.quit(); // a second copy would fight over the same data
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    protocol.handle(APP_SCHEME, (request) => {
      const file = resolveAppFile(DIST, new URL(request.url).pathname);
      if (!file) return new Response("Not found", { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    });

    // the app's pages may copy to the clipboard, pick a backup folder and use the camera for
    // barcode scanning (never the microphone); nothing else (see policy.cjs)
    session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => callback(permissionAllowed(permission, details.requestingUrl, details)));
    session.defaultSession.setPermissionCheckHandler((wc, permission, requestingOrigin, details) => permissionAllowed(permission, requestingOrigin, details));

    buildMenu();
    createWindow();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

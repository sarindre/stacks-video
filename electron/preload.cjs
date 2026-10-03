// Runs before the page, with no access to Node from the page itself (context isolation is on).
// It only tells the app it's running as the desktop version.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("stacksVideoDesktop", { isDesktop: true, platform: process.platform });

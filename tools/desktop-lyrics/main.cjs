// See-through lyrics on the desktop: a frameless, transparent, always-on-top window that shows the /overlay page over the
// wallpaper and every app, and lets clicks pass through to whatever is under it. A browser's floating window cannot be
// transparent, which is why this small Electron helper exists.
//
// Start it with `pnpm lyrics:desktop` while Lyricscape runs and Settings -> Lyrics outside the app -> "Share what is playing
// with overlays on this computer" is on. Keys (work from anywhere):
//   Ctrl+Alt+L  move / resize mode (the window takes the mouse and shows a frame), press again to lock it in place
//   Ctrl+Alt+H  hide / show
//   Ctrl+Alt+Q  quit
// Options: the overlay options as an argument (pnpm lyrics:desktop "bg=transparent&size=xl&font=serif", the same as the
// overlay address Settings builds), LYRICSCAPE_URL (default http://127.0.0.1:3000).

const { app, BrowserWindow, globalShortcut, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const BASE = (process.env.LYRICSCAPE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const argQuery = process.argv.slice(2).find((a) => /^[a-z]+=/.test(a));
const QUERY = argQuery || process.env.LYRICS_QUERY || 'bg=transparent&size=l&font=clean&next=1&meta=0';
const STATE = () => path.join(app.getPath('userData'), 'desktop-lyrics.json');

function readBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(STATE(), 'utf8'));
    // only use saved bounds that still land on a connected screen
    const ok = screen.getAllDisplays().some((d) => b.x >= d.bounds.x - 50 && b.y >= d.bounds.y - 50 && b.x < d.bounds.x + d.bounds.width && b.y < d.bounds.y + d.bounds.height);
    if (ok && b.width > 200 && b.height > 80) return b;
  } catch {
    /* first run */
  }
  const wa = screen.getPrimaryDisplay().workArea;
  const width = Math.round(Math.min(1200, wa.width * 0.7));
  const height = 240;
  return { x: Math.round(wa.x + (wa.width - width) / 2), y: Math.round(wa.y + wa.height - height - 40), width, height };
}

let win = null;
let editing = false;
let editCss = null;

function setEditing(on) {
  if (!win) return;
  editing = on;
  win.setIgnoreMouseEvents(!on, { forward: true });
  win.setFocusable(on);
  if (editCss) void win.webContents.removeInsertedCSS(editCss).catch(() => {});
  editCss = null;
  if (on) {
    void win.webContents
      .insertCSS('html{-webkit-app-region:drag;outline:2px dashed rgba(255,255,255,.7);outline-offset:-2px;background:rgba(0,0,0,.35)!important;cursor:move}')
      .then((k) => (editCss = k));
    win.focus();
  } else {
    fs.writeFile(STATE(), JSON.stringify(win.getBounds()), () => {});
  }
}

function create() {
  win = new BrowserWindow({
    ...readBounds(),
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    backgroundColor: '#00000000',
    title: 'Lyricscape desktop lyrics',
    webPreferences: { backgroundThrottling: false, contextIsolation: true, sandbox: true },
  });
  // above full-screen apps and games in borderless mode too
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  // only the overlay page loads here; links never open inside this window
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`${BASE}/overlay`)) e.preventDefault();
  });
  const url = `${BASE}/overlay?${QUERY}`;
  const load = () => win && win.loadURL(url).catch(() => setTimeout(load, 3000));
  win.webContents.on('did-fail-load', () => setTimeout(load, 3000));
  load();
  win.on('closed', () => (win = null));
}

app.whenReady().then(() => {
  create();
  globalShortcut.register('CommandOrControl+Alt+L', () => setEditing(!editing));
  globalShortcut.register('CommandOrControl+Alt+H', () => win && (win.isVisible() ? win.hide() : win.showInactive()));
  globalShortcut.register('CommandOrControl+Alt+Q', () => app.quit());
  console.log(`Desktop lyrics: showing ${BASE}/overlay. Ctrl+Alt+L move/resize, Ctrl+Alt+H hide, Ctrl+Alt+Q quit.`);
  console.log('Nothing showing? In Lyricscape, turn on Settings -> Lyrics outside the app -> "Share what is playing with overlays on this computer".');
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());

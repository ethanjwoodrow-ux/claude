const { app, BrowserWindow, Tray, Menu, nativeImage, screen, globalShortcut } = require('electron');
const zlib = require('zlib');

// ── Minimal PNG generator (no deps) ─────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function makePNG(w, h, getPixel) {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = getPixel(x, y);
      const o = y * (1 + w * 4) + 1 + x * 4;
      raw[o] = r; raw[o+1] = g; raw[o+2] = b; raw[o+3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// 16×16 pixel-art ant icon (1 = brown, 0 = transparent)
const ICON_DATA = [
  [0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
  [0,1,0,0,1,1,1,1,1,1,0,0,0,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0],
  [0,1,0,0,1,1,1,1,1,1,0,0,0,1,0,0],
  [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

let win, tray;

function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  const W = 270, H = 340;

  win = new BrowserWindow({
    width: W, height: H,
    x: sw - W - 10,
    y: sh - H - 10,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadFile('index.html');

  // Keep above other windows even when they go fullscreen
  win.setAlwaysOnTop(true, 'screen-saver');
}

function createTray() {
  const iconBuf = makePNG(16, 16, (x, y) =>
    ICON_DATA[y][x] ? [139, 90, 30, 255] : [0, 0, 0, 0]
  );
  tray = new Tray(nativeImage.createFromBuffer(iconBuf));
  tray.setToolTip('Ant Colony — click to show/hide');

  tray.on('click', () => {
    if (!win) return;
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });

  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Show / Hide Colony',
      click: () => {
        if (!win) return;
        if (win.isVisible()) win.hide();
        else { win.show(); win.focus(); }
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { tray.destroy(); app.quit(); } },
  ]));
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

// Keep app alive via tray even if window closes
app.on('window-all-closed', () => {});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

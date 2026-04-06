const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

let win;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const W = 270;
  const H = 340;

  win = new BrowserWindow({
    width: W,
    height: H,
    x: screenWidth - W - 10,
    y: screenHeight - H - 10,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile('index.html');
  win.setIgnoreMouseEvents(true);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

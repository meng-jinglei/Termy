import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { PtyManager } from './pty/manager';
import { detectShells } from './pty/shell-detector';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;
const ptyManager = new PtyManager();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Termy',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Register IPC handlers and detect shells
  registerIpcHandlers(mainWindow, ptyManager);

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  ptyManager.killAll();
});

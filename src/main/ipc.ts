import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS, IpcPtySpawnArgs, IpcPtyWriteArgs, IpcPtyResizeArgs, IpcPtyKillArgs } from '../shared/ipc-channels';
import { PtyManager } from './pty/manager';
import { detectShells } from './pty/shell-detector';
import { randomUUID } from 'crypto';

export function registerIpcHandlers(mainWindow: BrowserWindow, manager: PtyManager): void {
  // Buffer-based batching for PTY_DATA output (prevents IPC backpressure)
  const buffers = new Map<string, string>();
  const scheduled = new Set<string>();

  manager.on('data', ({ sessionId, data }) => {
    const existing = buffers.get(sessionId) || '';
    buffers.set(sessionId, existing + data);
    if (!scheduled.has(sessionId)) {
      scheduled.add(sessionId);
      setImmediate(() => {
        scheduled.delete(sessionId);
        const buffered = buffers.get(sessionId) || '';
        buffers.delete(sessionId);
        if (buffered.length > 0) {
          mainWindow.webContents.send(IPC_CHANNELS.PTY_DATA, { sessionId, data: buffered });
        }
      });
    }
  });

  manager.on('exit', ({ sessionId, exitCode, signal }) => {
    mainWindow.webContents.send(IPC_CHANNELS.PTY_EXIT, { sessionId, exitCode, signal });
  });

  // Shell detection — emit available shells to renderer
  const shells = detectShells();
  mainWindow.webContents.send('shells:available', {
    shells: shells.map(s => ({ id: s.id, label: s.label })),
    defaultShell: shells[0]?.id,
  });

  ipcMain.handle(IPC_CHANNELS.PTY_SPAWN, (_event, args: IpcPtySpawnArgs) => {
    const session = manager.spawn(randomUUID(), {
      shell: args.shell,
      cwd: args.cwd,
      cols: args.cols,
      rows: args.rows,
    });
    return { sessionId: session.id };
  });

  ipcMain.on(IPC_CHANNELS.PTY_WRITE, (_event, args: IpcPtyWriteArgs) => {
    manager.write(args.sessionId, args.data);
  });

  ipcMain.on(IPC_CHANNELS.PTY_RESIZE, (_event, args: IpcPtyResizeArgs) => {
    manager.resize(args.sessionId, args.cols, args.rows);
  });

  ipcMain.on(IPC_CHANNELS.PTY_KILL, (_event, args: IpcPtyKillArgs) => {
    manager.kill(args.sessionId);
  });
}

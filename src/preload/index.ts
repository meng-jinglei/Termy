import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, IpcPtySpawnArgs, IpcPtyWriteArgs, IpcPtyResizeArgs, IpcPtyKillArgs, IpcPtyDataEvent, IpcPtyExitEvent } from '../shared/ipc-channels';

contextBridge.exposeInMainWorld('terminalAPI', {
  spawn: (args: IpcPtySpawnArgs): Promise<{ sessionId: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.PTY_SPAWN, args);
  },
  write: (args: IpcPtyWriteArgs): void => {
    ipcRenderer.send(IPC_CHANNELS.PTY_WRITE, args);
  },
  resize: (args: IpcPtyResizeArgs): void => {
    ipcRenderer.send(IPC_CHANNELS.PTY_RESIZE, args);
  },
  kill: (args: IpcPtyKillArgs): void => {
    ipcRenderer.send(IPC_CHANNELS.PTY_KILL, args);
  },
  onData: (callback: (event: IpcPtyDataEvent) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.PTY_DATA, (_event, args: IpcPtyDataEvent) => callback(args));
  },
  onExit: (callback: (event: IpcPtyExitEvent) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.PTY_EXIT, (_event, args: IpcPtyExitEvent) => callback(args));
  },
});

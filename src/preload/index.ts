import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('terminalAPI', {
  send: (channel: string, data: unknown) => {
    ipcRenderer.send(channel, data);
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  invoke: (channel: string, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },
});

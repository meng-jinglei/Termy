export const IPC_CHANNELS = {
  PTY_SPAWN: 'pty:spawn',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_KILL: 'pty:kill',
  PTY_DATA: 'pty:data',
  PTY_EXIT: 'pty:exit',
} as const;

export interface IpcPtySpawnArgs {
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
}

export interface IpcPtyWriteArgs {
  sessionId: string;
  data: string;
}

export interface IpcPtyResizeArgs {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface IpcPtyKillArgs {
  sessionId: string;
}

export interface IpcPtyDataEvent {
  sessionId: string;
  data: string;
}

export interface IpcPtyExitEvent {
  sessionId: string;
  exitCode: number;
  signal?: number;
}

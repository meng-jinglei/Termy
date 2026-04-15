import type * as pty from '@lydell/node-pty';

export interface ShellProfile {
  id: string;
  label: string;
  path: string;
  args?: string[];
}

export interface PtySession {
  id: string;
  process: pty.IPty;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
}

export interface PtyOptions {
  shell: string;
  args?: string[];
  cwd: string;
  cols: number;
  rows: number;
  env?: Record<string, string>;
}

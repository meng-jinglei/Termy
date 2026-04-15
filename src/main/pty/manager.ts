import * as pty from '@lydell/node-pty';
import { EventEmitter } from 'events';
import { PtySession, PtyOptions } from './types';

export class PtyManager extends EventEmitter {
  private sessions: Map<string, PtySession> = new Map();

  spawn(id: string, options: PtyOptions): PtySession {
    const env = { ...process.env } as Record<string, string>;

    const ptyProcess = pty.spawn(options.shell, options.args || [], {
      name: 'xterm-256color',
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd,
      env,
      useConpty: true,
    });

    const session: PtySession = {
      id,
      process: ptyProcess,
      shell: options.shell,
      cwd: options.cwd,
      cols: options.cols,
      rows: options.rows,
    };
    this.sessions.set(id, session);

    ptyProcess.onData((data: string) => {
      this.emit('data', { sessionId: id, data });
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit('exit', { sessionId: id, exitCode, signal });
      this.sessions.delete(id);
    });

    return session;
  }

  write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.process.write(data);
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.process.resize(cols, rows);
      session.cols = cols;
      session.rows = rows;
    }
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const timeout = setTimeout(() => {
      try {
        require('child_process').execSync(
          `taskkill /PID ${session.process.pid} /T /F`,
          { stdio: 'ignore' }
        );
      } catch { /* process already dead */ }
    }, 3000);

    try {
      session.process.kill();
    } finally {
      clearTimeout(timeout);
      this.sessions.delete(sessionId);
    }
  }

  killAll(): void {
    const ids = Array.from(this.sessions.keys());
    for (const id of ids) {
      this.kill(id);
    }
  }
}

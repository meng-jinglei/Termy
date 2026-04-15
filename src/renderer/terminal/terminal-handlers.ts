import { createTerminal } from './terminal-instance';

declare global {
  interface Window {
    terminalAPI: {
      spawn: (args: { shell: string; cwd: string; cols: number; rows: number }) => Promise<{ sessionId: string }>;
      write: (args: { sessionId: string; data: string }) => void;
      resize: (args: { sessionId: string; cols: number; rows: number }) => void;
      kill: (args: { sessionId: string }) => void;
      onData: (callback: (event: { sessionId: string; data: string }) => void) => void;
      onExit: (callback: (event: { sessionId: string; exitCode: number; signal?: number }) => void) => void;
    };
  }
}

let sessionId: string | null = null;

export function bootstrapTerminal(container: HTMLElement) {
  const { terminal, fitAddon } = createTerminal(container);

  // Wire up IPC — renderer to main
  terminal.onData((data: string) => {
    if (sessionId) {
      window.terminalAPI.write({ sessionId, data });
    }
  });

  // Wire up IPC — main to renderer
  window.terminalAPI.onData(({ data }: { data: string }) => {
    terminal.write(data);
  });

  window.terminalAPI.onExit(({ exitCode }: { exitCode: number }) => {
    terminal.write(`\r\n[Process exited with code ${exitCode}]\r\n`);
    sessionId = null;
  });

  // Handle resize
  terminal.onResize(({ cols, rows }) => {
    if (sessionId) {
      window.terminalAPI.resize({ sessionId, cols, rows });
    }
  });

  // Auto-fit on window resize
  window.addEventListener('resize', () => {
    fitAddon.fit();
  });

  // Request shell spawn from main
  window.terminalAPI.spawn({
    shell: 'powershell.exe',
    cwd: process.env.USERPROFILE || 'C:\\Users\\picld',
    cols: 80,
    rows: 24,
  }).then(({ sessionId: id }) => {
    sessionId = id;
    terminal.focus();
  });

  return { terminal, fitAddon };
}

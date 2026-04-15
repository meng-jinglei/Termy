import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { SearchAddon } from '@xterm/addon-search';
import type { ITerminalOptions } from '@xterm/xterm';

const OPTIONS: ITerminalOptions = {
  allowProposedApi: true,
  cursorBlink: true,
  fontSize: 14,
  fontFamily: '"Cascadia Code", "Consolas", "Courier New", monospace',
  scrollback: 10000,
  convertEol: true,
};

export function createTerminal(container: HTMLElement) {
  const terminal = new Terminal(OPTIONS);

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  const webglAddon = new WebglAddon();
  terminal.loadAddon(webglAddon);

  const searchAddon = new SearchAddon();
  terminal.loadAddon(searchAddon);

  terminal.open(container);
  fitAddon.fit();

  try {
    webglAddon.activate(terminal);
  } catch {
    console.warn('WebGL unavailable, falling back to DOM renderer');
  }

  return { terminal, fitAddon, webglAddon, searchAddon };
}

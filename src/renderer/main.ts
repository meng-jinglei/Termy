import { bootstrapTerminal } from './terminal/terminal-handlers';

const container = document.getElementById('terminal-container');
if (container) {
  bootstrapTerminal(container);
}

// Renderer entry — xterm.js will bootstrap here in Plan 03
const container = document.getElementById('terminal-container');
if (container) {
  container.style.width = '100%';
  container.style.height = '100%';
  container.innerHTML = '<div style="padding: 20px; font-family: monospace;">Termy — PTY loading...</div>';
}

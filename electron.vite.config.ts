import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        external: ['node-pty', '@lydell/node-pty'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    optimizeDeps: {
      exclude: [
        '@xterm/xterm',
        '@xterm/addon-fit',
        '@xterm/addon-webgl',
        '@xterm/addon-search',
      ],
    },
  },
});

import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        external: ['node-pty', '@lydell/node-pty'],
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
    },
  },
  renderer: {
    build: {
      outDir: 'dist/renderer',
    },
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

/** Dev server: Vite serves the UI on 127.0.0.1:5173 and relays /api and the /live WebSocket to the Hono server. */
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

const apiPort = process.env['ALCC_PORT'] ?? '9320';

export default defineConfig({
  plugins: [solid()],
  server: {
    host: '127.0.0.1', // `localhost` resolves to ::1 on Windows
    port: 5173,
    strictPort: true,
    // On Windows the native watcher missed quick successive writes twice (stale modules served); polling does not.
    watch: process.platform === 'win32' ? { usePolling: true, interval: 200 } : {},
    proxy: {
      '/api': `http://127.0.0.1:${apiPort}`,
      '/game-assets': `http://127.0.0.1:${apiPort}`,
      '/live': { target: `ws://127.0.0.1:${apiPort}`, ws: true },
    },
  },
});

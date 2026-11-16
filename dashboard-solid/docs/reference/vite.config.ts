/** Dev server: Vite serves the UI and relays /api and the /live WebSocket to Hono on 9320. */
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

const apiPort = process.env['ALCC_PORT'] ?? '9320';

export default defineConfig({
  plugins: [solid()],
  server: {
    host: '127.0.0.1', // localhost resolves to ::1 on Windows
    port: 5173,
    proxy: {
      '/api': `http://127.0.0.1:${apiPort}`,
      '/live': { target: `ws://127.0.0.1:${apiPort}`, ws: true },
    },
  },
});

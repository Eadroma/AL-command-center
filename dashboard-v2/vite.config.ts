import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: { assetsDir: 'app-assets' },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:9320',
        changeOrigin: true,
      },
      '/live': {
        target: 'ws://127.0.0.1:9320',
        ws: true,
      },
      '/assets': {
        target: 'http://127.0.0.1:9320',
        changeOrigin: true,
      },
    },
  },
})


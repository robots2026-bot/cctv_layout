import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://backend:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: `${apiProxyTarget}`,
        changeOrigin: true
      },
      '/realtime': {
        target: `${apiProxyTarget}`,
        changeOrigin: true,
        ws: true
      }
    }
  },
  preview: {
    port: 4173,
    host: '0.0.0.0'
  }
});

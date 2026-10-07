import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offlineApp } from './build/pwa.ts';

export default defineConfig({
  plugins: [react(), offlineApp()],
  build: { outDir: 'dist/client', sourcemap: false },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
});

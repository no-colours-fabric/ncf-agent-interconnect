import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({
  root: path.resolve('desktop/renderer'),
  base: './',
  plugins: [react()],
  build: { outDir: path.resolve('build/renderer'), emptyOutDir: true },
  server: { host: '127.0.0.1' },
});

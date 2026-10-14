import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// one page per landing direction
const pages = ['index', 'seats', 'tifo', 'liquid', 'deck', 'broadcast', 'tunnel'];
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { input: Object.fromEntries(pages.map((p) => [p, resolve(import.meta.dirname, `${p}.html`)])) },
  },
});

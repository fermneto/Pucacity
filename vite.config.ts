import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        // index.html = o jogo (src/game/main.ts); vitrine.html = validação visual do PC1; lab.html = laboratório de assets
        main: resolve(import.meta.dirname, 'index.html'),
        vitrine: resolve(import.meta.dirname, 'vitrine.html'),
        lab: resolve(import.meta.dirname, 'lab.html'),
        ui: resolve(import.meta.dirname, 'ui.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});

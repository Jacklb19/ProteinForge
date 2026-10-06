import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { translate } from './src/i18n/translate';

const tokens = readFileSync(new URL('./src/design-tokens.css', import.meta.url), 'utf8');
const surface = tokens.match(/--color-surface:\s*([^;]+);/)?.[1]?.trim();
if (!surface) throw new Error('The surface design token is missing.');

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    injectRegister: 'script',
    manifest: {
      name: translate('es', 'app.name'),
      short_name: translate('es', 'app.name'),
      description: translate('es', 'app.description'),
      lang: 'es',
      start_url: '/',
      display: 'standalone',
      theme_color: surface,
      background_color: surface,
      icons: [{ src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,wasm}'],
      navigateFallback: 'index.html',
      cleanupOutdatedCaches: true,
    },
  })],
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    port: 4173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});

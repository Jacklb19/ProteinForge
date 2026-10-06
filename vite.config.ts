import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { translate } from './src/i18n/translate';

const tokens = readFileSync(new URL('./src/design-tokens.css', import.meta.url), 'utf8');
const surface = tokens.match(/--color-surface:\s*([^;]+);/)?.[1]?.trim();
if (!surface) throw new Error('The surface design token is missing.');
const accent = tokens.match(/--color-focus:\s*([^;]+);/)?.[1]?.trim();
const stroke = tokens.match(/--stroke-icon:\s*([^;]+);/)?.[1]?.trim();
if (!accent || !stroke) throw new Error('The icon design tokens are missing.');
const appIcon = readFileSync(new URL('./src/shared/app-icon.svg', import.meta.url), 'utf8')
  .replaceAll('{{surface}}', surface).replaceAll('{{accent}}', accent).replaceAll('{{stroke}}', stroke);

/** Resolve standalone icon colors and initial metadata from the shared catalog. */
const applicationIdentity: Plugin = {
  name: 'application-identity',
  configureServer(server) {
    server.middlewares.use('/app-icon.svg', (_request, response) => {
      response.setHeader('Content-Type', 'image/svg+xml');
      response.end(appIcon);
    });
  },
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'app-icon.svg', source: appIcon }); },
  transformIndexHtml: {
    order: 'pre',
    handler(html) {
      return html.replaceAll('%APP_TITLE%', translate('es', 'app.title'))
        .replaceAll('%APP_DESCRIPTION%', translate('es', 'app.description'))
        .replaceAll('%APP_THEME_COLOR%', surface);
    },
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), applicationIdentity, VitePWA({
    registerType: 'prompt',
    injectRegister: 'script',
    manifest: {
      name: translate('es', 'app.name'),
      short_name: translate('es', 'app.name'),
      description: translate('es', 'app.description'),
      lang: 'es',
      start_url: '/',
      display: 'standalone',
      theme_color: accent,
      background_color: surface,
      icons: [{ src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,wasm,woff2}'],
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

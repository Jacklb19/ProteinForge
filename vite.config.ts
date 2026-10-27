import { defineConfig } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { translate } from './src/i18n/translate';
import { DEFAULT_LOCALE } from './src/i18n/config';
import { FONT_FILES, fontUrl } from './src/theme/fonts';
import {LAB_CONFIG} from './src/features/design-lab/config';

const tokens = readFileSync(new URL('./src/design-tokens.css', import.meta.url), 'utf8');
/** First declaration of a design token, which holds the light theme value. */
function token(name: string): string {
  const value = tokens.match(new RegExp(`(?<![\\w-])${name}:\\s*([^;]+);`))?.[1]?.trim();
  if (!value) throw new Error(`The design token ${name} is missing.`);
  return value;
}
const surface = token('--bg-canvas');
const accent = token('--accent-brand');
const stroke = token('--stroke-icon');
const fontPreloads = FONT_FILES.filter((font) => font.preload)
  .map((font) => `<link rel="preload" href="${fontUrl(font)}" as="font" type="font/woff2" crossorigin />`)
  .join('\n    ');
const appIcon = readFileSync(new URL('./src/shared/app-icon.svg', import.meta.url), 'utf8')
  .replaceAll('{{surface}}', surface).replaceAll('{{accent}}', accent).replaceAll('{{stroke}}', stroke);

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
};
/** Static serving bypasses configured headers on 304; apply isolation before cache validation too. */
function configureIsolation(server: Pick<ViteDevServer, 'middlewares'>): void {
  server.middlewares.use((_request, response, next) => {
    for (const [name, value] of Object.entries(isolationHeaders)) response.setHeader(name, value);
    next();
  });
}
const resourceIsolation: Plugin = {
  name: 'resource-isolation',
  configureServer: configureIsolation,
  configurePreviewServer: configureIsolation,
};

/** Serve the same reviewed, output-free notebook in development and in the production assets. */
const laboratoryNotebook:Plugin={
  name:'laboratory-notebook',
  configureServer(server){
    server.middlewares.use(LAB_CONFIG.colabNotebookPath,(_request,response)=>{
      response.setHeader('Content-Type','application/x-ipynb+json');
      response.setHeader('Content-Disposition','attachment; filename="proteinforge-design-lab.ipynb"');
      response.end(readFileSync(new URL('.'+LAB_CONFIG.colabNotebookPath,import.meta.url)));
    });
  },
  generateBundle(){this.emitFile({type:'asset',fileName:LAB_CONFIG.colabNotebookPath.slice(1),source:readFileSync(new URL('.'+LAB_CONFIG.colabNotebookPath,import.meta.url))});},
};

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
      return html.replaceAll('%APP_TITLE%', translate(DEFAULT_LOCALE, 'app.title'))
        .replaceAll('%APP_DESCRIPTION%', translate(DEFAULT_LOCALE, 'app.description'))
        .replaceAll('%FONT_PRELOADS%', fontPreloads)
        .replaceAll('%APP_LANG%', DEFAULT_LOCALE)
        .replaceAll('%APP_THEME_COLOR%', surface);
    },
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), resourceIsolation, applicationIdentity, laboratoryNotebook, VitePWA({
    registerType: 'prompt',
    injectRegister: 'script',
    manifest: {
      name: translate(DEFAULT_LOCALE, 'app.name'),
      short_name: translate(DEFAULT_LOCALE, 'app.name'),
      description: translate(DEFAULT_LOCALE, 'app.description'),
      lang: DEFAULT_LOCALE,
      start_url: '/',
      display: 'standalone',
      theme_color: accent,
      background_color: surface,
      icons: [{ src: '/app-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,wasm,woff2,ipynb}'],
      // Experimental structures stay online and demand-loaded; do not precache the large viewer engine.
      globIgnores: ['**/molstarRuntime-*.js'],
      navigateFallback: 'index.html',
      cleanupOutdatedCaches: true,
    },
  })],
  optimizeDeps: { entries: ['index.html', 'src/**/*.{ts,tsx}', '!src/**/*.test.{ts,tsx}', '!src/test/**', '!src/gen/**/*_connect.ts'] },
  server: {
    port: 5173,
    watch: { ignored: ['**/artifacts/**', '**/coverage/**', '**/test-results/**', '**/tmp/**'] },
    headers: isolationHeaders,
  },
  preview: {
    port: 4173,
    headers: isolationHeaders,
  },
});

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design-tokens.css';
import './fonts.css';
import './index.css';
import './workbench.css';
import './frames.css';
import App from './App';
import { loadCatalog } from './i18n/catalogs';
import { loadPreferences } from './preferences/preferences';

const container = document.getElementById('root');

if (!container) {
  throw new Error('The document root element (#root) is missing.');
}

const render = (): void => {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
};
// A visitor who chose another language gets its catalog first; if it cannot load, the default one renders.
loadCatalog(loadPreferences().locale).then(render, render);

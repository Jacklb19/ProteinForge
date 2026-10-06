import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design-tokens.css';
import './fonts.css';
import './index.css';
import App from './App';

const container = document.getElementById('root');

if (!container) {
  throw new Error('The document root element (#root) is missing.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

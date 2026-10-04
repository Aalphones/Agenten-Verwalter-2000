import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/theme.css';
import '@/styles/syntax.css';
import { App } from '@/app/App';
import { applyColorSchemeClass, readRememberedColorScheme } from '@/lib/colorScheme';
import type { ColorScheme } from '@/lib/bindings/ColorScheme';

const remembered: ColorScheme | null = readRememberedColorScheme();
if (remembered !== null) {
  applyColorSchemeClass(remembered);
}

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Wurzelelement #root fehlt in index.html');
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

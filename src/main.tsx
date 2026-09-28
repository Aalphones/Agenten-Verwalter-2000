import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import '@/styles/theme.css';
import { App } from '@/app/App';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Wurzelelement #root fehlt in index.html');
}

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

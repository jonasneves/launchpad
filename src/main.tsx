import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

async function bootstrap() {
  // Register the SW that injects COOP/COEP headers
  if ('serviceWorker' in navigator) {
    const base = import.meta.env.BASE_URL;
    const reg = await navigator.serviceWorker.register(`${base}sw.js`);

    // If the SW just installed and isn't controlling this page yet,
    // reload so the headers take effect and SharedArrayBuffer works.
    if (reg.installing && !navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        reg.installing!.addEventListener('statechange', function handler() {
          if (this.state === 'activated') {
            this.removeEventListener('statechange', handler);
            resolve();
          }
        });
      });
      window.location.reload();
      return;
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

bootstrap();

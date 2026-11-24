import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true);
  },
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      // Periodically check for new version every 30 seconds when online
      setInterval(async () => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        try {
          const resp = await fetch(swUrl, {
            cache: 'no-store',
            headers: {
              'cache': 'no-store',
              'cache-control': 'no-cache',
            },
          });
          if (resp?.status === 200) {
            await registration.update();
          }
        } catch {
          // ignore transient offline fetch failures
        }
      }, 30_000);
    }
  },
});

// Auto-reload when new service worker activates and takes control
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  // Check for updates when PWA or tab returns to the foreground
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) void reg.update();
      });
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

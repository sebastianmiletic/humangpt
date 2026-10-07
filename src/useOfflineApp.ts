import { useEffect, useState } from 'react';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useOfflineApp() {
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [cacheError, setCacheError] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    const offerInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const installed = () => setInstallPrompt(null);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    window.addEventListener('beforeinstallprompt', offerInstall);
    window.addEventListener('appinstalled', installed);
    let active = true;
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
        const check = () => {
          if (!active) return;
          if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);
        };
        check();
        const observeInstall = () => {
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            check();
            if (active && installing.state === 'redundant' && !registration.active) setCacheError(true);
          });
        };
        observeInstall();
        registration.addEventListener('updatefound', observeInstall);
        return navigator.serviceWorker.ready;
      }).then(() => { if (active) setOfflineReady(true); })
        .catch(() => { if (active) setCacheError(true); });
    }
    return () => {
      active = false;
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('beforeinstallprompt', offerInstall);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  const update = () => {
    if (!waiting) return;
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    waiting.postMessage('SKIP_WAITING');
  };
  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };
  return { online, offlineReady, cacheError, updateAvailable: Boolean(waiting), update, canInstall: Boolean(installPrompt), install };
}

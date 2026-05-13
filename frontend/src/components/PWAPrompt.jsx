import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, RefreshCw, X } from 'lucide-react';

/**
 * Two-in-one PWA helper:
 *
 * 1. "Install AKAN" toast — fires when the browser raises
 *    `beforeinstallprompt` (Android Chrome, desktop Chrome/Edge).
 *    iOS Safari doesn't fire this event; users add to home screen via
 *    the Share menu — we don't show anything in that case to avoid noise.
 *
 * 2. "New version available — reload" toast — appears when the
 *    service worker has fetched a new build in the background.
 */
export default function PWAPrompt() {
  // --- Auto-update prompt ---
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(reg) {
      // Re-check for a new build every 30 min while the tab is open.
      if (reg) {
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      }
    },
    onRegisterError(err) {
      console.warn('[PWA] SW registration failed:', err);
    },
  });

  // --- Install prompt ---
  const [installEvent, setInstallEvent] = useState(null);
  const [installDismissed, setInstallDismissed] = useState(
    () => localStorage.getItem('akan_pwa_install_dismissed') === '1'
  );

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      localStorage.setItem('akan_pwa_install_dismissed', '1');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismissInstall = () => {
    setInstallEvent(null);
    setInstallDismissed(true);
    localStorage.setItem('akan_pwa_install_dismissed', '1');
  };

  const triggerInstall = async () => {
    if (!installEvent) return;
    installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      localStorage.setItem('akan_pwa_install_dismissed', '1');
    }
    setInstallEvent(null);
  };

  const showInstall = !!installEvent && !installDismissed;
  if (!showInstall && !needRefresh) return null;

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 w-[calc(100%-1.5rem)] max-w-sm">
      {showInstall && (
        <div className="bg-white border border-[#af4408]/30 shadow-lg rounded-xl p-3 flex items-center gap-3">
          <img src="/akan-logo.png" alt="AKAN" className="w-9 h-9 rounded-lg" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">Install AKAN Party Manager</p>
            <p className="text-[11px] text-gray-500 truncate">Faster access, works like a native app.</p>
          </div>
          <button
            onClick={triggerInstall}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#af4408] text-white text-xs font-semibold hover:bg-[#963a07] transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Install
          </button>
          <button
            onClick={dismissInstall}
            aria-label="Dismiss install prompt"
            className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {needRefresh && (
        <div className="bg-white border border-blue-300 shadow-lg rounded-xl p-3 flex items-center gap-3">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-blue-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">A new version is available</p>
            <p className="text-[11px] text-gray-500 truncate">Reload to get the latest features.</p>
          </div>
          <button
            onClick={() => updateServiceWorker(true)}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            Reload
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            aria-label="Dismiss update prompt"
            className="shrink-0 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

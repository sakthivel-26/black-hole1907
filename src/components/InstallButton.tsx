import { useEffect, useState } from 'react';
import { FiDownload } from 'react-icons/fi';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);

    const onInstalled = () => {
      setDeferredPrompt(null);
      setVisible(false);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible || !deferredPrompt) return null;

  const handleInstall = async () => {
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setVisible(false);
      setDeferredPrompt(null);
      console.log('PWA install choice:', choice.outcome);
    } catch (err) {
      console.warn('Install prompt error', err);
    }
  };

  return (
    <button
      onClick={handleInstall}
      className="md:hidden fixed right-4 bottom-20 z-50 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/8 text-white backdrop-blur"
      aria-label="Install app"
    >
      <FiDownload size={16} />
      <span className="text-sm">Install</span>
    </button>
  );
}

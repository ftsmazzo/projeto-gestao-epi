'use client';

import { useCallback, useEffect, useState } from 'react';

const DISMISS_KEY = 'prontepi.pwa.install.dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  const mq = window.matchMedia('(display-mode: standalone)');
  const iosStandalone =
    'standalone' in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return mq.matches || iosStandalone;
}

function isIosDevice() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Banner para instalar o Painel do Cliente como app (PWA).
 * Android/Chrome: beforeinstallprompt. iOS: instrucao Compartilhar → Tela de Inicio.
 */
export function InstallAppBanner() {
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch {
      // ignore
    }

    // iOS nao dispara beforeinstallprompt — so instrucao manual.
    if (isIosDevice()) {
      setIosHint(true);
      setVisible(true);
      return;
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setVisible(false);
    } catch {
      // usuario cancelou ou prompt indisponivel
    } finally {
      setBusy(false);
    }
  }, [deferred]);

  if (!visible) return null;

  return (
    <aside
      className="pwa-install-banner"
      role="region"
      aria-label="Instalar aplicativo"
    >
      <div className="pwa-install-banner__body">
        <p className="pwa-install-banner__title">Usar como app no celular</p>
        <p className="pwa-install-banner__text">
          {iosHint
            ? 'No Safari: toque em Compartilhar e depois em Adicionar a Tela de Inicio.'
            : 'Instale o ProntEPI na tela inicial para entregar EPI como app.'}
        </p>
      </div>
      <div className="pwa-install-banner__actions">
        {iosHint ? null : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void install()}
            disabled={!deferred || busy}
          >
            {busy ? 'Abrindo…' : 'Instalar app'}
          </button>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={dismiss}
        >
          Agora nao
        </button>
      </div>
    </aside>
  );
}

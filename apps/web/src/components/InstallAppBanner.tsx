'use client';

import { useCallback, useEffect, useState } from 'react';

type Audience = 'portal' | 'consultoria';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function dismissKey(audience: Audience) {
  return audience === 'consultoria'
    ? 'prontepi.pwa.consultoria.dismissed'
    : 'prontepi.pwa.install.dismissed';
}

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

function notificationSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Banner para instalar como app (PWA) e, na consultoria, ativar notificacoes.
 * Android/Chrome: beforeinstallprompt. iOS: instrucao Compartilhar → Tela de Inicio.
 */
export function InstallAppBanner({
  audience = 'portal',
}: {
  audience?: Audience;
}) {
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [installHint, setInstallHint] = useState<string | null>(null);
  const [notifyStatus, setNotifyStatus] = useState<NotificationPermission | 'unsupported'>(
    'default',
  );
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandaloneDisplay());
    if (!notificationSupported()) {
      setNotifyStatus('unsupported');
    } else {
      setNotifyStatus(Notification.permission);
    }

    try {
      if (window.localStorage.getItem(dismissKey(audience)) === '1') return;
    } catch {
      // ignore
    }

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
    // Consultoria: mostra o botao mesmo se o Chrome ainda nao disparou o prompt.
    if (audience === 'consultoria') setVisible(true);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, [audience]);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(dismissKey(audience), '1');
    } catch {
      // ignore
    }
  }, [audience]);

  const install = useCallback(async () => {
    if (deferred) {
      setBusy(true);
      setInstallHint(null);
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
      return;
    }
    setInstallHint(
      iosHint
        ? 'No Safari: toque em Compartilhar e depois em Adicionar a Tela de Inicio.'
        : 'No Chrome, abra o menu (⋮) e toque em Instalar aplicativo / Adicionar a tela inicial.',
    );
  }, [deferred, iosHint]);

  const enableNotifications = useCallback(async () => {
    if (!notificationSupported()) {
      setNotifyStatus('unsupported');
      return;
    }
    setNotifyBusy(true);
    try {
      const result = await Notification.requestPermission();
      setNotifyStatus(result);
      if (result === 'granted') {
        const registration = await navigator.serviceWorker?.ready.catch(
          () => null,
        );
        const payload = {
          body:
            audience === 'consultoria'
              ? 'Avisos do painel da consultoria podem aparecer aqui.'
              : 'Avisos do painel do cliente podem aparecer aqui.',
          icon: '/brand/prontepi-icon-192.png',
          tag: 'prontepi-notify-on',
        };
        if (registration) {
          await registration.showNotification('ProntEPI — notificacoes ativas', payload);
        } else {
          new Notification('ProntEPI — notificacoes ativas', payload);
        }
      }
    } catch {
      setNotifyStatus(Notification.permission);
    } finally {
      setNotifyBusy(false);
    }
  }, [audience]);

  const showNotify =
    audience === 'consultoria' &&
    notifyStatus !== 'unsupported' &&
    notifyStatus !== 'granted';
  const showInstall = !standalone;

  if (!visible) return null;
  if (standalone && !showNotify) return null;

  const isConsultoria = audience === 'consultoria';

  return (
    <aside
      className="pwa-install-banner"
      role="region"
      aria-label={isConsultoria ? 'App e notificacoes' : 'Instalar aplicativo'}
    >
      <div className="pwa-install-banner__body">
        <p className="pwa-install-banner__title">
          {isConsultoria ? 'Transformar em app' : 'Usar como app no celular'}
        </p>
        <p className="pwa-install-banner__text">
          {iosHint
            ? 'No Safari: toque em Compartilhar e depois em Adicionar a Tela de Inicio.'
            : isConsultoria
              ? 'Instale o painel da consultoria na tela inicial e ative as notificacoes do celular.'
              : 'Instale o ProntEPI na tela inicial para entregar EPI como app.'}
        </p>
        {installHint ? (
          <p className="pwa-install-banner__text">{installHint}</p>
        ) : null}
      </div>
      <div className="pwa-install-banner__actions">
        {showInstall ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void install()}
            disabled={busy}
          >
            {busy
              ? 'Abrindo…'
              : isConsultoria
                ? 'Transformar em app'
                : 'Instalar app'}
          </button>
        ) : null}
        {showNotify ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void enableNotifications()}
            disabled={notifyBusy || notifyStatus === 'denied'}
          >
            {notifyBusy
              ? 'Solicitando…'
              : notifyStatus === 'denied'
                ? 'Notificacoes bloqueadas'
                : 'Ativar notificacoes'}
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={dismiss}>
          Agora nao
        </button>
      </div>
    </aside>
  );
}

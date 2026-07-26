'use client';

import { WORKER_BIOMETRIC_CONSENT_TEXT } from '@gestao-epi/shared';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AUTO_CAPTURE_STABLE_MS,
  evaluateFaceFraming,
  extractFaceDescriptorFromBlob,
  FACE_ENGINE_META,
  loadFaceModels,
  scanFacesInVideo,
  type FaceFramingHint,
} from '../../../../lib/face-biometrics.client';
import {
  completeFacialEnrollment,
  unlockFacialEnrollment,
} from '../../../../lib/facial-enrollment-public';

type GuideTone =
  | 'neutral'
  | 'adjusting'
  | 'ready'
  | 'processing'
  | 'matched'
  | 'rejected';

type Phase = 'locked' | 'ready' | 'scanning' | 'processing' | 'done';

function toneForHint(hint: FaceFramingHint): GuideTone {
  if (hint === 'ready') return 'ready';
  if (hint === 'none') return 'neutral';
  return 'adjusting';
}

export default function FacialEnrollmentPage() {
  const params = useParams<{ token: string }>();
  const token = decodeURIComponent(params.token ?? '');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const stableSinceRef = useRef<number | null>(null);
  const capturingRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('locked');
  const [cpfLast4, setCpfLast4] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [consentText, setConsentText] = useState(WORKER_BIOMETRIC_CONSENT_TEXT);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guideTone, setGuideTone] = useState<GuideTone>('neutral');
  const [guideMessage, setGuideMessage] = useState('Posicione o rosto no oval');
  const [modelsReady, setModelsReady] = useState(false);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    capturingRef.current = false;
    stableSinceRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadFaceModels();
        if (!cancelled) setModelsReady(true);
      } catch {
        if (!cancelled) {
          setError('Nao foi possivel carregar o motor facial neste aparelho.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onUnlock(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setUnlocking(true);
    try {
      const result = await unlockFacialEnrollment(token, cpfLast4);
      setFirstName(result.workerFirstName);
      setConsentText(result.consentText);
      setExpiresAt(result.expiresAt);
      setPhase('ready');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel validar o acesso.',
      );
    } finally {
      setUnlocking(false);
    }
  }

  async function startScan() {
    if (!consentAccepted) {
      setError('Aceite o consentimento biometrico para continuar.');
      return;
    }
    if (!modelsReady) {
      setError('Aguarde o carregamento do motor facial.');
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Camera indisponivel.');
      video.srcObject = stream;
      await video.play();
      setPhase('scanning');
      scanningRef.current = true;
      stableSinceRef.current = null;
      capturingRef.current = false;
      void scanLoop();
    } catch {
      setError(
        'Nao foi possivel acessar a camera. Permita o uso e tente novamente.',
      );
      setPhase('ready');
    }
  }

  async function scanLoop() {
    while (scanningRef.current) {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        await new Promise((r) => setTimeout(r, 120));
        continue;
      }
      try {
        const scan = await scanFacesInVideo(video);
        const { hint, message } = evaluateFaceFraming(scan);
        setGuideTone(toneForHint(hint));
        setGuideMessage(message);

        if (hint === 'ready') {
          if (stableSinceRef.current == null) {
            stableSinceRef.current = Date.now();
          } else if (
            Date.now() - stableSinceRef.current >= AUTO_CAPTURE_STABLE_MS &&
            !capturingRef.current
          ) {
            capturingRef.current = true;
            scanningRef.current = false;
            await captureAndSubmit();
            return;
          }
        } else {
          stableSinceRef.current = null;
        }
      } catch {
        // continua tentando
      }
      await new Promise((r) => setTimeout(r, 160));
    }
  }

  async function captureAndSubmit() {
    setPhase('processing');
    setGuideTone('processing');
    setGuideMessage('Validando e salvando…');
    const video = videoRef.current;
    if (!video) {
      setError('Falha na captura.');
      setPhase('ready');
      stopCamera();
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Falha na captura.');
      setPhase('ready');
      stopCamera();
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
    );
    stopCamera();

    if (!blob) {
      setError('Falha ao gerar a imagem.');
      setPhase('ready');
      return;
    }

    try {
      const extracted = await extractFaceDescriptorFromBlob(blob);
      if (!extracted.ok) {
        setError(extracted.message);
        setGuideTone('rejected');
        setPhase('ready');
        return;
      }
      await completeFacialEnrollment(token, blob, {
        cpfLast4,
        consentAccepted: true,
        faceDescriptor: extracted.descriptor,
        faceEngine: FACE_ENGINE_META.engine,
        faceEngineVersion: FACE_ENGINE_META.version,
        qualityScore: extracted.detectionScore,
      });
      setPhase('done');
      setGuideTone('matched');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel concluir o cadastro facial.',
      );
      setGuideTone('rejected');
      setPhase('ready');
    }
  }

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleString('pt-BR')
    : null;

  return (
    <main className="enroll-page">
      <div className="enroll-page__atmosphere" aria-hidden />
      <div className="enroll-page__sheet">
        <header className="enroll-page__hero">
          <p className="enroll-page__brand">Gestao EPI</p>
          <h1 className="enroll-page__title">Cadastro facial</h1>
          <p className="enroll-page__lead">
            {phase === 'done'
              ? 'Tudo certo. Sua biometria foi registrada.'
              : phase === 'locked'
                ? 'Confirme sua identidade com os 4 ultimos digitos do CPF.'
                : `Ola${firstName ? `, ${firstName}` : ''}. Enquadre o rosto e aguarde a captura automatica.`}
          </p>
        </header>

        {error ? (
          <p className="enroll-page__error" role="alert">
            {error}
          </p>
        ) : null}

        {phase === 'locked' ? (
          <form className="enroll-page__form" onSubmit={(e) => void onUnlock(e)}>
            <label className="enroll-page__label" htmlFor="cpf-last4">
              4 ultimos digitos do CPF
            </label>
            <input
              id="cpf-last4"
              className="enroll-page__input"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              pattern="\d{4}"
              value={cpfLast4}
              onChange={(e) =>
                setCpfLast4(e.target.value.replace(/\D/g, '').slice(0, 4))
              }
              placeholder="••••"
              required
            />
            <button
              type="submit"
              className="enroll-page__btn"
              disabled={unlocking || cpfLast4.length !== 4}
            >
              {unlocking ? 'Validando…' : 'Continuar'}
            </button>
          </form>
        ) : null}

        {phase === 'done' ? (
          <div className="enroll-page__success" role="status">
            <p>Biometria cadastrada com sucesso.</p>
            <p className="enroll-page__hint">Voce ja pode fechar esta pagina.</p>
          </div>
        ) : null}

        {phase !== 'locked' && phase !== 'done' ? (
          <>
            {expiresLabel ? (
              <p className="enroll-page__hint">Link valido ate {expiresLabel}</p>
            ) : null}

            <label className="enroll-page__consent">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                disabled={phase === 'scanning' || phase === 'processing'}
              />
              <span>{consentText}</span>
            </label>

            <div
              className={`face-ux__stage face-ux__stage--enroll face-ux__stage--${guideTone} enroll-page__stage`}
            >
              <video
                ref={videoRef}
                className={`face-ux__media${phase === 'scanning' ? '' : ' is-hidden'}`}
                playsInline
                muted
                autoPlay
                aria-label="Preview da camera"
              />
              {phase !== 'scanning' ? (
                <div className="face-ux__placeholder">
                  <span className="face-ux__placeholder-icon" aria-hidden />
                  <span>
                    {phase === 'processing'
                      ? 'Processando…'
                      : 'Pronto para capturar'}
                  </span>
                </div>
              ) : null}
              <div className={`face-ux__oval face-ux__oval--${guideTone}`} aria-hidden />
              {phase === 'scanning' ? (
                <p className="face-ux__live-hint" role="status">
                  {guideMessage}
                </p>
              ) : null}
            </div>

            {phase === 'ready' ? (
              <button
                type="button"
                className="enroll-page__btn"
                onClick={() => void startScan()}
                disabled={!consentAccepted || !modelsReady}
              >
                {modelsReady ? 'Iniciar camera' : 'Carregando…'}
              </button>
            ) : null}

            {phase === 'scanning' ? (
              <button
                type="button"
                className="enroll-page__btn enroll-page__btn--ghost"
                onClick={() => {
                  stopCamera();
                  setPhase('ready');
                  setGuideTone('neutral');
                }}
              >
                Cancelar
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

'use client';

import { WORKER_BIOMETRIC_CONSENT_TEXT } from '@gestao-epi/shared';
import type { LivenessChallengeType } from '@gestao-epi/shared';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AUTO_CAPTURE_STABLE_MS,
  createLivenessTracker,
  evaluateFaceFraming,
  evaluateLiveness,
  extractFaceDescriptorFromBlob,
  FACE_ENGINE_META,
  LIVENESS_INTERVAL_MS,
  LIVENESS_MVP_NOTICE,
  loadFaceModels,
  livenessArrowSide,
  livenessChallengeLabel,
  openSelfieCamera,
  SCAN_INTERVAL_MS,
  scanFacesInVideo,
  scanFacesWithLandmarks,
  type FaceFramingHint,
  type LivenessTrackerState,
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

type Phase =
  | 'locked'
  | 'ready'
  | 'scanning'
  | 'liveness'
  | 'processing'
  | 'done';

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
  const livenessRef = useRef<LivenessTrackerState | null>(null);
  const phaseRef = useRef<Phase>('locked');

  const [phase, setPhaseState] = useState<Phase>('locked');
  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);
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
  const [activeChallenge, setActiveChallenge] =
    useState<LivenessChallengeType | null>(null);
  const [turnUiPhase, setTurnUiPhase] = useState<'turn' | 'center' | null>(
    null,
  );

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    capturingRef.current = false;
    stableSinceRef.current = null;
    livenessRef.current = null;
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
      requestAnimationFrame(() => {
        document
          .querySelector('.enroll-page__actions')
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
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
      const stream = await openSelfieCamera();
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error('Camera indisponivel.');
      video.srcObject = stream;
      await video.play();
      await new Promise((r) => setTimeout(r, 450));
      setPhase('scanning');
      scanningRef.current = true;
      stableSinceRef.current = null;
      capturingRef.current = false;
      livenessRef.current = null;
      // Mantem a camera e o botao Cancelar no viewport (mobile).
      requestAnimationFrame(() => {
        video.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
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
        const current = phaseRef.current;
        if (current === 'scanning') {
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
              const tracker = createLivenessTracker();
              livenessRef.current = tracker;
              setActiveChallenge(tracker.challenge);
              setTurnUiPhase('turn');
              setPhase('liveness');
              setGuideTone('ready');
              setGuideMessage(livenessChallengeLabel(tracker.challenge));
              stableSinceRef.current = null;
            }
          } else {
            stableSinceRef.current = null;
          }
        } else if (current === 'liveness') {
          const scan = await scanFacesWithLandmarks(video);
          let tracker = livenessRef.current;
          if (!tracker) {
            tracker = createLivenessTracker();
            livenessRef.current = tracker;
            setActiveChallenge(tracker.challenge);
            setTurnUiPhase('turn');
          }
          const { state, progress } = evaluateLiveness(scan, tracker);
          livenessRef.current = state;
          setTurnUiPhase(state.turnPhase);
          setGuideMessage(progress.message);
          setGuideTone(progress.passed ? 'ready' : 'adjusting');

          if (progress.timedOut) {
            scanningRef.current = false;
            setError(progress.message);
            setGuideTone('rejected');
            setPhase('ready');
            stopCamera();
            return;
          }
          if (progress.passed && !capturingRef.current) {
            capturingRef.current = true;
            scanningRef.current = false;
            await captureAndSubmit(state.challenge);
            return;
          }
        }
      } catch {
        // continua tentando
      }
      const delay =
        phaseRef.current === 'liveness'
          ? LIVENESS_INTERVAL_MS
          : SCAN_INTERVAL_MS;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  async function captureAndSubmit(challenge: LivenessChallengeType) {
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
        livenessPassed: true,
        livenessChallenge: challenge,
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
    <main
      className={`enroll-page${
        phase !== 'locked' && phase !== 'done' ? ' enroll-page--capture' : ''
      }${
        phase === 'scanning' || phase === 'liveness' || phase === 'processing'
          ? ' enroll-page--live'
          : ''
      }`}
    >
      <div className="enroll-page__atmosphere" aria-hidden />
      <div className="enroll-page__sheet">
        <header
          className={`enroll-page__hero${
            phase === 'scanning' || phase === 'liveness' || phase === 'processing'
              ? ' enroll-page__hero--compact'
              : ''
          }`}
        >
          <p className="enroll-page__brand">Gestao EPI</p>
          <h1 className="enroll-page__title">Cadastro facial</h1>
          {phase === 'scanning' ||
          phase === 'liveness' ||
          phase === 'processing' ? null : (
            <p className="enroll-page__lead">
              {phase === 'done'
                ? 'Tudo certo. Sua biometria foi registrada.'
                : phase === 'locked'
                  ? 'Confirme sua identidade com os 4 ultimos digitos do CPF.'
                  : `Ola${firstName ? `, ${firstName}` : ''}. Enquadre o rosto, complete o desafio de presenca e aguarde a captura.`}
            </p>
          )}
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
          <div
            className={`enroll-page__capture${
              phase === 'scanning' || phase === 'liveness' || phase === 'processing'
                ? ' enroll-page__capture--live'
                : ''
            }`}
          >
            <div className="enroll-page__capture-top">
              {expiresLabel && phase === 'ready' ? (
                <p className="enroll-page__hint">Link valido ate {expiresLabel}</p>
              ) : null}

              {phase === 'ready' ? (
                <>
                  <label className="enroll-page__consent">
                    <input
                      type="checkbox"
                      checked={consentAccepted}
                      onChange={(e) => setConsentAccepted(e.target.checked)}
                    />
                    <span>{consentText}</span>
                  </label>
                  <p className="enroll-page__hint enroll-page__hint--mvp">
                    {LIVENESS_MVP_NOTICE}
                  </p>
                </>
              ) : (
                <p className="enroll-page__live-status" role="status">
                  {phase === 'processing'
                    ? 'Validando e salvando…'
                    : guideMessage}
                </p>
              )}
            </div>

            <div
              className={`face-ux__stage face-ux__stage--enroll face-ux__stage--${guideTone} enroll-page__stage`}
            >
              <video
                ref={videoRef}
                className={`face-ux__media${
                  phase === 'scanning' || phase === 'liveness' ? '' : ' is-hidden'
                }`}
                playsInline
                muted
                autoPlay
                aria-label="Preview da camera"
              />
              {phase !== 'scanning' && phase !== 'liveness' ? (
                <div className="face-ux__placeholder">
                  <span className="face-ux__placeholder-icon" aria-hidden />
                  <span>
                    {phase === 'processing'
                      ? 'Processando…'
                      : 'Pronto para capturar'}
                  </span>
                </div>
              ) : null}
              <div
                className={`face-ux__oval face-ux__oval--${guideTone}`}
                aria-hidden
              />
              {phase === 'liveness' &&
              activeChallenge &&
              turnUiPhase === 'turn' &&
              livenessArrowSide(activeChallenge, true) ? (
                <div
                  className={`face-ux__turn-arrow face-ux__turn-arrow--${livenessArrowSide(activeChallenge, true)}`}
                  aria-hidden
                >
                  <span className="face-ux__turn-arrow-icon" />
                </div>
              ) : null}
              {phase === 'scanning' || phase === 'liveness' ? (
                <p className="face-ux__live-hint" role="status">
                  {guideMessage}
                </p>
              ) : null}
            </div>

            <div className="enroll-page__actions">
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

              {phase === 'scanning' || phase === 'liveness' ? (
                <button
                  type="button"
                  className="enroll-page__btn enroll-page__btn--ghost"
                  onClick={() => {
                    stopCamera();
                    setPhase('ready');
                    setGuideTone('neutral');
                    setGuideMessage('Posicione o rosto no oval');
                  }}
                >
                  Cancelar
                </button>
              ) : null}

              {phase === 'processing' ? (
                <button type="button" className="enroll-page__btn" disabled>
                  Salvando…
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

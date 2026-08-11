'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LivenessChallengeType } from '@gestao-epi/shared';
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
} from '../lib/face-biometrics.client';
import { previewPortalFacialMatch } from '../lib/client-auth';

export type FacialUxStatus =
  | 'idle'
  | 'capturing'
  | 'liveness'
  | 'processing'
  | 'matched'
  | 'rejected'
  | 'noFace'
  | 'multipleFaces'
  | 'needsReenrollment'
  | 'error';

export type FacialValidationResult = {
  blob: Blob;
  descriptor: number[];
  faceEngine: string;
  faceEngineVersion: string;
  consentAccepted: true;
  livenessPassed: true;
  livenessChallenge: LivenessChallengeType;
};

type Props = {
  workerId: string;
  needsReenrollment?: boolean;
  hasBiometricTemplate: boolean;
  disabled?: boolean;
  /** Inicia a camera assim que o motor estiver pronto. */
  autoStart?: boolean;
  /** Layout enxuto para overlay fullscreen. */
  compact?: boolean;
  onMatched: (result: FacialValidationResult) => void;
  onReset: () => void;
};

type GuideTone = 'neutral' | 'adjusting' | 'ready' | 'processing' | 'matched' | 'rejected';

const STATUS_COPY: Record<
  Exclude<FacialUxStatus, 'idle' | 'capturing' | 'liveness' | 'processing'>,
  { title: string; detail: string }
> = {
  matched: {
    title: 'Face validada',
    detail: 'Face validada com sucesso.',
  },
  rejected: {
    title: 'Face nao corresponde',
    detail:
      'A face capturada nao corresponde ao trabalhador selecionado. Tente novamente ou revise o cadastro biometrico.',
  },
  noFace: {
    title: 'Nenhuma face detectada',
    detail: 'Centralize o rosto na moldura e tente novamente.',
  },
  multipleFaces: {
    title: 'Mais de uma face detectada',
    detail: 'Capture apenas uma pessoa por vez.',
  },
  needsReenrollment: {
    title: 'Recadastrar biometria',
    detail:
      'Este trabalhador ainda nao possui biometria facial cadastrada ou precisa recadastrar.',
  },
  error: {
    title: 'Falha na validacao',
    detail: 'Nao foi possivel validar a face. Tente novamente.',
  },
};

function toneForHint(hint: FaceFramingHint): GuideTone {
  if (hint === 'ready') return 'ready';
  if (hint === 'none') return 'neutral';
  return 'adjusting';
}

async function waitForVideoElement(
  getVideo: () => HTMLVideoElement | null,
  attempts = 20,
): Promise<HTMLVideoElement> {
  for (let i = 0; i < attempts; i += 1) {
    const el = getVideo();
    if (el) return el;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Elemento de video indisponivel. Feche e tente de novo.');
}

async function attachStreamToVideo(
  video: HTMLVideoElement,
  stream: MediaStream,
) {
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;

  if (video.readyState < 1) {
    await Promise.race([
      new Promise<void>((resolve) => {
        const onMeta = () => {
          video.removeEventListener('loadedmetadata', onMeta);
          resolve();
        };
        video.addEventListener('loadedmetadata', onMeta);
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 2500)),
    ]);
  }

  try {
    await video.play();
  } catch {
    // Alguns browsers exigem segundo play apos metadata.
    await new Promise((r) => setTimeout(r, 120));
    await video.play();
  }
}

export function FacialValidationPanel({
  workerId,
  needsReenrollment = false,
  hasBiometricTemplate,
  disabled = false,
  autoStart = false,
  compact = false,
  onMatched,
  onReset,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const statusRef = useRef<FacialUxStatus>('idle');
  const capturingLockRef = useRef(false);
  const stableSinceRef = useRef<number | null>(null);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const livenessRef = useRef<LivenessTrackerState | null>(null);
  const livenessPassedRef = useRef<{
    challenge: LivenessChallengeType;
  } | null>(null);
  const onMatchedRef = useRef(onMatched);
  const onResetRef = useRef(onReset);
  const autoStartDoneRef = useRef(false);

  onMatchedRef.current = onMatched;
  onResetRef.current = onReset;

  const [engineReady, setEngineReady] = useState(false);
  const [status, setStatus] = useState<FacialUxStatus>(
    !hasBiometricTemplate || needsReenrollment ? 'needsReenrollment' : 'idle',
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [guideMessage, setGuideMessage] = useState(
    'Posicione o rosto no enquadramento',
  );
  const [guideTone, setGuideTone] = useState<GuideTone>('neutral');
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [capturedNote, setCapturedNote] = useState(false);
  const [livePreview, setLivePreview] = useState(false);
  const [activeChallenge, setActiveChallenge] =
    useState<LivenessChallengeType | null>(null);
  const [turnUiPhase, setTurnUiPhase] = useState<'turn' | 'center' | null>(
    null,
  );

  const setUxStatus = useCallback((next: FacialUxStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const stopLoop = useCallback(() => {
    if (loopTimerRef.current) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    stableSinceRef.current = null;
  }, []);

  const stopCamera = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLivePreview(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stopLoop]);

  useEffect(() => {
    void loadFaceModels()
      .then(() => setEngineReady(true))
      .catch(() => setEngineReady(false));
    return () => {
      stopCamera();
      setThumbUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [stopCamera]);

  useEffect(() => {
    autoStartDoneRef.current = false;
    stopCamera();
    capturingLockRef.current = false;
    setThumbUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCameraError(null);
    setStatusDetail(null);
    setCapturedNote(false);
    setGuideMessage('Posicione o rosto no enquadramento');
    setGuideTone('neutral');
    if (!hasBiometricTemplate || needsReenrollment) {
      setUxStatus('needsReenrollment');
    } else {
      setUxStatus('idle');
    }
    // Nao chamar onReset aqui — o pai controla o estado ao abrir/fechar o fluxo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId, hasBiometricTemplate, needsReenrollment]);

  const validateBlob = useCallback(
    async (blob: Blob) => {
      setGuideTone('processing');
      setGuideMessage('Validando biometria...');
      setUxStatus('processing');
      setCapturedNote(true);

      try {
        const detection = await extractFaceDescriptorFromBlob(blob);
        if (!detection.ok) {
          if (detection.reason === 'MULTIPLE_FACES') {
            setUxStatus('multipleFaces');
            setGuideTone('rejected');
            setStatusDetail(STATUS_COPY.multipleFaces.detail);
          } else if (detection.reason === 'NO_FACE') {
            setUxStatus('noFace');
            setGuideTone('rejected');
            setStatusDetail(STATUS_COPY.noFace.detail);
          } else {
            setUxStatus('error');
            setGuideTone('rejected');
            setStatusDetail(detection.message);
          }
          return;
        }

        const preview = await previewPortalFacialMatch(
          workerId,
          detection.descriptor,
        );
        if (preview.matched) {
          setUxStatus('matched');
          setGuideTone('matched');
          setGuideMessage('Face validada');
          setStatusDetail(STATUS_COPY.matched.detail);
          onMatchedRef.current({
            blob,
            descriptor: detection.descriptor,
            faceEngine: FACE_ENGINE_META.engine,
            faceEngineVersion: FACE_ENGINE_META.version,
            consentAccepted: true,
            livenessPassed: true,
            livenessChallenge:
              livenessPassedRef.current?.challenge ?? 'blink',
          });
        } else {
          setUxStatus('rejected');
          setGuideTone('rejected');
          setGuideMessage('Face nao corresponde');
          setStatusDetail(STATUS_COPY.rejected.detail);
        }
      } catch (err) {
        setUxStatus('error');
        setGuideTone('rejected');
        setStatusDetail(
          err instanceof Error ? err.message : STATUS_COPY.error.detail,
        );
      } finally {
        capturingLockRef.current = false;
      }
    },
    [setUxStatus, workerId],
  );

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || capturingLockRef.current || disabled) return;
    capturingLockRef.current = true;
    stopLoop();

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      capturingLockRef.current = false;
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (!blob) {
      setCameraError('Falha ao capturar a imagem facial.');
      capturingLockRef.current = false;
      setUxStatus('error');
      return;
    }

    stopCamera();
    setThumbUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    setGuideMessage('Captura automatica realizada');
    await validateBlob(blob);
  }, [disabled, setUxStatus, stopCamera, stopLoop, validateBlob]);

  const runScanLoop = useCallback(() => {
    stopLoop();
    livenessRef.current = null;
    livenessPassedRef.current = null;

    const tick = async () => {
      const phase = statusRef.current;
      if (
        (phase !== 'capturing' && phase !== 'liveness') ||
        capturingLockRef.current
      ) {
        return;
      }
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        loopTimerRef.current = setTimeout(() => void tick(), SCAN_INTERVAL_MS);
        return;
      }

      try {
        if (phase === 'capturing') {
          const scan = await scanFacesInVideo(video);
          if (statusRef.current !== 'capturing' || capturingLockRef.current) {
            return;
          }
          const { hint, message } = evaluateFaceFraming(scan);
          setGuideMessage(message);
          setGuideTone(toneForHint(hint));

          if (hint === 'ready') {
            const now = Date.now();
            if (stableSinceRef.current == null) {
              stableSinceRef.current = now;
            } else if (now - stableSinceRef.current >= AUTO_CAPTURE_STABLE_MS) {
              const tracker = createLivenessTracker();
              livenessRef.current = tracker;
              setActiveChallenge(tracker.challenge);
              setTurnUiPhase('turn');
              setUxStatus('liveness');
              setGuideTone('ready');
              setGuideMessage(livenessChallengeLabel(tracker.challenge));
              stableSinceRef.current = null;
            }
          } else {
            stableSinceRef.current = null;
          }
        } else if (phase === 'liveness') {
          const scan = await scanFacesWithLandmarks(video);
          if (statusRef.current !== 'liveness' || capturingLockRef.current) {
            return;
          }
          let tracker = livenessRef.current;
          if (!tracker) {
            tracker = createLivenessTracker();
            livenessRef.current = tracker;
            setActiveChallenge(tracker.challenge);
          }
          const { state, progress } = evaluateLiveness(scan, tracker);
          livenessRef.current = state;
          setTurnUiPhase(state.turnPhase);
          setGuideMessage(progress.message);
          setGuideTone(progress.passed ? 'ready' : 'adjusting');

          if (progress.timedOut) {
            setUxStatus('error');
            setGuideTone('rejected');
            setStatusDetail(progress.message);
            stopCamera();
            return;
          }
          if (progress.passed) {
            livenessPassedRef.current = { challenge: state.challenge };
            await captureFrame();
            return;
          }
        }
      } catch {
        // Mantém o loop; falhas pontuais de deteccao nao derrubam a sessao.
      }

      if (
        (statusRef.current === 'capturing' ||
          statusRef.current === 'liveness') &&
        !capturingLockRef.current
      ) {
        const delay =
          statusRef.current === 'liveness'
            ? LIVENESS_INTERVAL_MS
            : SCAN_INTERVAL_MS;
        loopTimerRef.current = setTimeout(() => void tick(), delay);
      }
    };

    loopTimerRef.current = setTimeout(() => void tick(), 200);
  }, [captureFrame, setUxStatus, stopCamera, stopLoop]);

  const startCamera = useCallback(async () => {
    if (disabled || !hasBiometricTemplate || needsReenrollment) return;
    if (starting || statusRef.current === 'capturing' || statusRef.current === 'liveness') {
      return;
    }
    setCameraError(null);
    setStarting(true);
    setStatusDetail(null);
    setCapturedNote(false);
    setThumbUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    capturingLockRef.current = false;
    livenessRef.current = null;
    livenessPassedRef.current = null;
    setActiveChallenge(null);
    setTurnUiPhase(null);
    // Mostra o video antes do getUserMedia (evita tela preta / is-hidden).
    setLivePreview(true);
    setUxStatus('capturing');
    setGuideMessage('Aguardando permissao da camera…');
    setGuideTone('neutral');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Camera indisponivel neste navegador. Use HTTPS ou um dispositivo com camera.',
        );
      }
      const stream = await openSelfieCamera();
      streamRef.current = stream;

      const video = await waitForVideoElement(() => videoRef.current);
      await attachStreamToVideo(video, stream);
      // Deixa autofoco/zoom do aparelho estabilizar antes do enquadramento.
      await new Promise((r) => setTimeout(r, 450));

      setGuideMessage('Posicione o rosto no enquadramento');
      runScanLoop();
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel acessar a camera. Verifique a permissao do navegador.',
      );
      stopCamera();
      setUxStatus('idle');
      autoStartDoneRef.current = false;
    } finally {
      setStarting(false);
    }
  }, [
    disabled,
    hasBiometricTemplate,
    needsReenrollment,
    runScanLoop,
    setUxStatus,
    starting,
    stopCamera,
  ]);

  const blocked = !hasBiometricTemplate || needsReenrollment;

  useEffect(() => {
    if (!autoStart || !engineReady || blocked || disabled) return;
    if (autoStartDoneRef.current) return;
    if (statusRef.current !== 'idle' && statusRef.current !== 'capturing') {
      return;
    }
    autoStartDoneRef.current = true;
    void startCamera();
  }, [autoStart, engineReady, blocked, disabled, startCamera, workerId]);

  function retry() {
    autoStartDoneRef.current = false;
    onResetRef.current();
    void startCamera();
  }

  const copy =
    status === 'idle' ||
    status === 'capturing' ||
    status === 'liveness' ||
    status === 'processing'
      ? null
      : STATUS_COPY[status];

  const ovalTone: GuideTone =
    status === 'processing'
      ? 'processing'
      : status === 'matched'
        ? 'matched'
        : status === 'rejected' ||
            status === 'noFace' ||
            status === 'multipleFaces' ||
            status === 'error'
          ? 'rejected'
          : guideTone;

  const showVideo =
    livePreview || status === 'capturing' || status === 'liveness';
  const arrowSide =
    status === 'liveness' &&
    activeChallenge &&
    turnUiPhase === 'turn'
      ? livenessArrowSide(activeChallenge, true)
      : null;

  return (
    <section
      className={`face-ux face-ux--panel${compact ? ' face-ux--compact' : ''}`}
      aria-labelledby="face-ux-title"
    >
      <header className="face-ux__header">
        {compact ? null : <p className="face-ux__kicker">Passo 3</p>}
        <h2 id="face-ux-title" className="face-ux__title">
          Validacao facial
        </h2>
        {compact ? null : (
          <p className="face-ux__subtitle">
            Enquadre o rosto, complete o desafio de presenca e aguarde a captura
            automatica.
          </p>
        )}
      </header>

      {!engineReady && !blocked ? (
        <p className="face-ux__hint" role="status">
          Preparando validacao...
        </p>
      ) : null}

      {cameraError ? (
        <p className="error" role="alert">
          {cameraError}
        </p>
      ) : null}

      <div className="face-ux__frame" aria-live="polite">
        <div className={`face-ux__stage face-ux__stage--${ovalTone}`}>
          <video
            ref={videoRef}
            className={`face-ux__media${showVideo ? '' : ' is-hidden'}`}
            playsInline
            muted
            autoPlay
            aria-label="Preview da camera"
          />
          {thumbUrl && !showVideo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt=""
              className="face-ux__media face-ux__media--thumb"
            />
          ) : null}
          {!showVideo && !thumbUrl ? (
            <div className="face-ux__placeholder">
              <span className="face-ux__placeholder-icon" aria-hidden />
              <span>
                {autoStart || starting
                  ? 'Abrindo camera…'
                  : 'Pronto para validar'}
              </span>
            </div>
          ) : null}
          <div className={`face-ux__oval face-ux__oval--${ovalTone}`} aria-hidden />
          {arrowSide ? (
            <div
              className={`face-ux__turn-arrow face-ux__turn-arrow--${arrowSide}`}
              aria-hidden
            >
              <span className="face-ux__turn-arrow-icon" />
            </div>
          ) : null}
          {status === 'capturing' || status === 'liveness' ? (
            <p className="face-ux__live-hint" role="status">
              {guideMessage}
            </p>
          ) : null}
          {status === 'processing' ? (
            <div className="face-ux__overlay" role="status">
              Validando biometria...
            </div>
          ) : null}
        </div>
      </div>

      {copy ? (
        <div
          className={`face-ux__status face-ux__status--${status}`}
          role="status"
        >
          <span className="face-ux__status-dot" aria-hidden />
          <div>
            <strong>{copy.title}</strong>
            <p>{statusDetail ?? copy.detail}</p>
          </div>
        </div>
      ) : null}

      {capturedNote &&
      status !== 'capturing' &&
      status !== 'liveness' &&
      status !== 'idle' &&
      !compact ? (
        <p className="face-ux__capture-note">Captura automatica realizada</p>
      ) : null}

      {compact ? null : (
        <p className="face-ux__consent">
          Ao validar a face, a imagem capturada sera registrada como evidencia
          desta entrega. {LIVENESS_MVP_NOTICE}
        </p>
      )}

      <div className="face-ux__actions face-ux__actions--stack">
        {blocked ? null : status === 'idle' && !autoStart ? (
          <button
            type="button"
            className="btn btn-primary face-ux__btn-main"
            onClick={() => void startCamera()}
            disabled={disabled || starting || !engineReady}
          >
            {starting ? 'Abrindo camera...' : 'Iniciar validacao facial'}
          </button>
        ) : null}

        {(status === 'idle' || status === 'capturing') &&
        autoStart &&
        starting ? (
          <p className="face-ux__hint" role="status">
            Autorize a camera para continuar…
          </p>
        ) : null}

        {status === 'capturing' || status === 'liveness' ? (
          <button
            type="button"
            className="btn btn-secondary face-ux__btn-main"
            onClick={() => {
              stopCamera();
              setUxStatus('idle');
              setGuideTone('neutral');
              setGuideMessage('Posicione o rosto no enquadramento');
              autoStartDoneRef.current = false;
              onResetRef.current();
            }}
            disabled={disabled || starting}
          >
            Cancelar
          </button>
        ) : null}

        {status === 'processing' ? (
          <button type="button" className="btn btn-primary face-ux__btn-main" disabled>
            Validando...
          </button>
        ) : null}

        {status === 'matched' && !compact ? (
          <p className="face-ux__ready" role="status">
            Pronto para registrar a entrega.
          </p>
        ) : null}

        {status === 'rejected' ||
        status === 'noFace' ||
        status === 'multipleFaces' ||
        status === 'error' ? (
          <button
            type="button"
            className="btn btn-primary face-ux__btn-main"
            onClick={retry}
            disabled={disabled}
          >
            Tentar novamente
          </button>
        ) : null}
      </div>
    </section>
  );
}

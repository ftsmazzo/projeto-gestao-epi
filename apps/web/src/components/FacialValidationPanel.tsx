'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AUTO_CAPTURE_STABLE_MS,
  evaluateFaceFraming,
  extractFaceDescriptorFromBlob,
  FACE_ENGINE_META,
  loadFaceModels,
  scanFacesInVideo,
  type FaceFramingHint,
} from '../lib/face-biometrics.client';
import { previewPortalFacialMatch } from '../lib/client-auth';

export type FacialUxStatus =
  | 'idle'
  | 'capturing'
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
};

type Props = {
  workerId: string;
  needsReenrollment?: boolean;
  hasBiometricTemplate: boolean;
  disabled?: boolean;
  onMatched: (result: FacialValidationResult) => void;
  onReset: () => void;
};

type GuideTone = 'neutral' | 'adjusting' | 'ready' | 'processing' | 'matched' | 'rejected';

const STATUS_COPY: Record<
  Exclude<FacialUxStatus, 'idle' | 'capturing' | 'processing'>,
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

export function FacialValidationPanel({
  workerId,
  needsReenrollment = false,
  hasBiometricTemplate,
  disabled = false,
  onMatched,
  onReset,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const statusRef = useRef<FacialUxStatus>('idle');
  const capturingLockRef = useRef(false);
  const stableSinceRef = useRef<number | null>(null);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    onReset();
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
          onMatched({
            blob,
            descriptor: detection.descriptor,
            faceEngine: FACE_ENGINE_META.engine,
            faceEngineVersion: FACE_ENGINE_META.version,
            consentAccepted: true,
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
    [onMatched, setUxStatus, workerId],
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

    const tick = async () => {
      if (statusRef.current !== 'capturing' || capturingLockRef.current) {
        return;
      }
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        loopTimerRef.current = setTimeout(() => void tick(), 280);
        return;
      }

      try {
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
            await captureFrame();
            return;
          }
        } else {
          stableSinceRef.current = null;
        }
      } catch {
        // Mantém o loop; falhas pontuais de deteccao nao derrubam a sessao.
      }

      if (statusRef.current === 'capturing' && !capturingLockRef.current) {
        loopTimerRef.current = setTimeout(() => void tick(), 280);
      }
    };

    loopTimerRef.current = setTimeout(() => void tick(), 200);
  }, [captureFrame, stopLoop]);

  async function startCamera() {
    if (disabled || !hasBiometricTemplate || needsReenrollment) return;
    setCameraError(null);
    setStarting(true);
    setStatusDetail(null);
    setCapturedNote(false);
    setThumbUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    onReset();
    capturingLockRef.current = false;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Camera indisponivel neste navegador. Use HTTPS ou um dispositivo com camera.',
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setUxStatus('capturing');
      setGuideMessage('Posicione o rosto no enquadramento');
      setGuideTone('neutral');
      runScanLoop();
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel acessar a camera. Verifique a permissao do navegador.',
      );
      stopCamera();
      setUxStatus('idle');
    } finally {
      setStarting(false);
    }
  }

  function retry() {
    onReset();
    void startCamera();
  }

  const blocked = status === 'needsReenrollment';
  const showLive = status === 'capturing' || (status === 'idle' && !thumbUrl);
  const copy =
    status === 'idle' || status === 'capturing' || status === 'processing'
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

  return (
    <section className="face-ux face-ux--panel" aria-labelledby="face-ux-title">
      <header className="face-ux__header">
        <p className="face-ux__kicker">Passo 3</p>
        <h2 id="face-ux-title" className="face-ux__title">
          Validacao facial
        </h2>
        <p className="face-ux__subtitle">
          Toque em iniciar, enquadre o rosto e aguarde a captura automatica.
        </p>
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
          {showLive ? (
            <video
              ref={videoRef}
              className="face-ux__media"
              playsInline
              muted
              autoPlay
              aria-label="Preview da camera"
            />
          ) : thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt=""
              className="face-ux__media face-ux__media--thumb"
            />
          ) : (
            <div className="face-ux__placeholder">
              <span className="face-ux__placeholder-icon" aria-hidden />
              <span>Pronto para validar</span>
            </div>
          )}
          <div className={`face-ux__oval face-ux__oval--${ovalTone}`} aria-hidden />
          {status === 'capturing' ? (
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

      {capturedNote && status !== 'capturing' && status !== 'idle' ? (
        <p className="face-ux__capture-note">Captura automatica realizada</p>
      ) : null}

      <p className="face-ux__consent">
        Ao validar a face, a imagem capturada sera registrada como evidencia
        desta entrega.
      </p>

      <div className="face-ux__actions face-ux__actions--stack">
        {blocked ? null : status === 'idle' ? (
          <button
            type="button"
            className="btn btn-primary face-ux__btn-main"
            onClick={() => void startCamera()}
            disabled={disabled || starting || !engineReady}
          >
            {starting ? 'Abrindo camera...' : 'Iniciar validacao facial'}
          </button>
        ) : null}

        {status === 'capturing' ? (
          <button
            type="button"
            className="btn btn-secondary face-ux__btn-main"
            onClick={() => {
              stopCamera();
              setUxStatus('idle');
              setGuideTone('neutral');
              setGuideMessage('Posicione o rosto no enquadramento');
              onReset();
            }}
            disabled={disabled}
          >
            Cancelar
          </button>
        ) : null}

        {status === 'processing' ? (
          <button type="button" className="btn btn-primary face-ux__btn-main" disabled>
            Validando...
          </button>
        ) : null}

        {status === 'matched' ? (
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

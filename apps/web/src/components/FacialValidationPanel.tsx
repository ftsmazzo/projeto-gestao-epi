'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  extractFaceDescriptorFromBlob,
  FACE_ENGINE_META,
  loadFaceModels,
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
  const [engineReady, setEngineReady] = useState(false);
  const [status, setStatus] = useState<FacialUxStatus>(
    !hasBiometricTemplate || needsReenrollment ? 'needsReenrollment' : 'idle',
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    void loadFaceModels()
      .then(() => setEngineReady(true))
      .catch(() => setEngineReady(false));
    return () => {
      stopCamera();
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    stopCamera();
    setThumbUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCameraError(null);
    setStatusDetail(null);
    if (!hasBiometricTemplate || needsReenrollment) {
      setStatus('needsReenrollment');
    } else {
      setStatus('idle');
    }
    onReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId, hasBiometricTemplate, needsReenrollment]);

  async function startCamera() {
    if (disabled || !hasBiometricTemplate || needsReenrollment) return;
    setCameraError(null);
    setStarting(true);
    setStatusDetail(null);
    setThumbUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    onReset();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          'Camera indisponivel neste navegador. Use HTTPS ou um dispositivo com camera.',
        );
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('capturing');
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel acessar a camera. Verifique a permissao do navegador.',
      );
      stopCamera();
      setStatus('idle');
    } finally {
      setStarting(false);
    }
  }

  async function captureAndValidate() {
    const video = videoRef.current;
    if (!video || status !== 'capturing' || disabled) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (!blob) {
      setCameraError('Falha ao capturar a imagem facial.');
      return;
    }

    stopCamera();
    setThumbUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    setStatus('processing');
    setStatusDetail(null);

    try {
      const detection = await extractFaceDescriptorFromBlob(blob);
      if (!detection.ok) {
        if (detection.reason === 'MULTIPLE_FACES') {
          setStatus('multipleFaces');
          setStatusDetail(STATUS_COPY.multipleFaces.detail);
        } else if (detection.reason === 'NO_FACE') {
          setStatus('noFace');
          setStatusDetail(STATUS_COPY.noFace.detail);
        } else {
          setStatus('error');
          setStatusDetail(detection.message);
        }
        return;
      }

      const preview = await previewPortalFacialMatch(
        workerId,
        detection.descriptor,
      );
      if (preview.matched) {
        setStatus('matched');
        setStatusDetail(STATUS_COPY.matched.detail);
        onMatched({
          blob,
          descriptor: detection.descriptor,
          faceEngine: FACE_ENGINE_META.engine,
          faceEngineVersion: FACE_ENGINE_META.version,
          consentAccepted: true,
        });
      } else {
        setStatus('rejected');
        setStatusDetail(STATUS_COPY.rejected.detail);
      }
    } catch (err) {
      setStatus('error');
      setStatusDetail(
        err instanceof Error
          ? err.message
          : STATUS_COPY.error.detail,
      );
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

  return (
    <section className="face-ux" aria-labelledby="face-ux-title">
      <header className="face-ux__header">
        <h2 id="face-ux-title" className="face-ux__title">
          Validacao facial
        </h2>
        <p className="face-ux__subtitle">
          Centralize o rosto e capture a imagem para validacao automatica.
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

      <div
        className={`face-ux__frame face-ux__frame--${status}`}
        aria-live="polite"
      >
        <div className="face-ux__stage">
          {showLive ? (
            <video
              ref={videoRef}
              className="face-ux__media"
              playsInline
              muted
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
              <span>Pronto para capturar</span>
            </div>
          )}
          <div className="face-ux__oval" aria-hidden />
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

      {thumbUrl && status !== 'capturing' && status !== 'idle' ? (
        <p className="face-ux__capture-note">Captura registrada</p>
      ) : null}

      <p className="face-ux__consent">
        Ao validar a face, a imagem capturada sera registrada como evidencia
        desta entrega.
      </p>

      <div className="face-ux__actions">
        {blocked ? null : status === 'idle' || status === 'error' ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void startCamera()}
            disabled={disabled || starting || !engineReady}
          >
            {starting ? 'Abrindo camera...' : 'Iniciar camera'}
          </button>
        ) : null}

        {status === 'capturing' ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void captureAndValidate()}
            disabled={disabled || !engineReady}
          >
            Validar face e registrar evidencia
          </button>
        ) : null}

        {status === 'processing' ? (
          <button type="button" className="btn btn-primary" disabled>
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
            className="btn btn-secondary"
            onClick={retry}
            disabled={disabled}
          >
            Tentar novamente
          </button>
        ) : null}

        {status === 'capturing' ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              stopCamera();
              setStatus('idle');
              onReset();
            }}
            disabled={disabled}
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </section>
  );
}

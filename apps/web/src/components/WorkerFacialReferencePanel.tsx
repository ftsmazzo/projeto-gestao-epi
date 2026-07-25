'use client';

import type { WorkerFacialReferenceMeta } from '@gestao-epi/shared';
import { WORKER_FACE_REFERENCE_CONSENT_TEXT } from '@gestao-epi/shared';
import { useEffect, useRef, useState } from 'react';
import {
  extractFaceDescriptorFromBlob,
  FACE_ENGINE_META,
  loadFaceModels,
} from '../lib/face-biometrics.client';
import {
  fetchWorkerFacialReferenceBlob,
  getWorkerFacialReference,
  revokeWorkerFacialReference,
  uploadWorkerFacialReference,
} from '../lib/workers';

type Props = {
  workerId: string;
  workerName: string;
};

export function WorkerFacialReferencePanel({ workerId, workerName }: Props) {
  const [meta, setMeta] = useState<WorkerFacialReferenceMeta | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [engineReady, setEngineReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectStatus, setDetectStatus] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const next = await getWorkerFacialReference(workerId);
      setMeta(next);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (next.hasActiveReference) {
        const blob = await fetchWorkerFacialReferenceBlob(workerId);
        setPreviewUrl(URL.createObjectURL(blob));
      } else {
        setPreviewUrl(null);
      }
    } catch (err) {
      setMeta(null);
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao carregar biometria facial.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    void loadFaceModels()
      .then(() => setEngineReady(true))
      .catch((err: unknown) => {
        setEngineReady(false);
        setError(
          err instanceof Error
            ? err.message
            : 'Falha ao carregar motor facial.',
        );
      });
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId]);

  function setPending(blob: Blob | null) {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingBlob(blob);
    setPendingPreview(blob ? URL.createObjectURL(blob) : null);
    setDetectStatus(null);
    setError(null);
  }

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel acessar a camera.',
      );
      stopCamera();
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !cameraOn) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('Falha ao capturar a imagem.');
          return;
        }
        setPending(blob);
        stopCamera();
      },
      'image/jpeg',
      0.92,
    );
  }

  async function saveReference() {
    if (!pendingBlob) {
      setError('Capture ou envie uma imagem antes de salvar.');
      return;
    }
    if (meta?.hasActiveReference) {
      const ok = window.confirm(
        `Substituir a biometria facial de ${workerName}? A referencia anterior sera revogada.`,
      );
      if (!ok) return;
    }

    setSaving(true);
    setError(null);
    setDetectStatus('Detectando face...');
    try {
      const detection = await extractFaceDescriptorFromBlob(pendingBlob);
      if (!detection.ok) {
        if (detection.reason === 'NO_FACE') {
          setDetectStatus(null);
          setError('Nenhuma face detectada. Use uma foto com o rosto centralizado.');
        } else if (detection.reason === 'MULTIPLE_FACES') {
          setDetectStatus(null);
          setError('Mais de uma face detectada. Capture apenas uma pessoa.');
        } else {
          setDetectStatus(null);
          setError(detection.message);
        }
        return;
      }
      setDetectStatus('Salvando biometria...');
      await uploadWorkerFacialReference(workerId, pendingBlob, {
        consentAccepted: true,
        faceDescriptor: detection.descriptor,
        faceEngine: FACE_ENGINE_META.engine,
        faceEngineVersion: FACE_ENGINE_META.version,
        qualityScore: detection.detectionScore,
      });
      setPending(null);
      setDetectStatus('Biometria cadastrada');
      await reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao salvar biometria facial.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function revoke() {
    const ok = window.confirm(
      `Revogar a biometria facial de ${workerName}? Entregas ficarao bloqueadas ate novo cadastro.`,
    );
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await revokeWorkerFacialReference(workerId);
      setDetectStatus(null);
      await reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao revogar biometria facial.',
      );
    } finally {
      setSaving(false);
    }
  }

  const enrolled =
    meta?.status === 'ACTIVE' && Boolean(meta.hasBiometricTemplate);
  const needsReenrollment =
    meta?.status === 'NEEDS_REENROLLMENT' ||
    (meta?.status === 'ACTIVE' && !meta.hasBiometricTemplate);

  const statusLabel = enrolled
    ? 'Biometria cadastrada'
    : needsReenrollment
      ? 'Precisa recadastrar'
      : meta?.status === 'REVOKED'
        ? 'Revogada'
        : 'Nao cadastrada';

  return (
    <section className="face-enroll face-enroll--panel" aria-labelledby="facial-ref-title">
      <header className="face-enroll__header">
        <h3 id="facial-ref-title" className="face-enroll__title">
          Biometria facial
        </h3>
        <p className="face-enroll__subtitle">
          Centralize o rosto na moldura. O sistema detecta a face e cadastra a
          biometria para as entregas no portal.
        </p>
      </header>

      {!engineReady ? (
        <p className="face-ux__hint" role="status">
          Preparando validacao...
        </p>
      ) : null}
      {loading ? <p className="page-lead">Carregando...</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && meta ? (
        <div
          className={`face-enroll__badge face-enroll__badge--${
            enrolled ? 'ok' : needsReenrollment ? 'warn' : 'muted'
          }`}
          role="status"
        >
          <span className="face-enroll__badge-dot" aria-hidden />
          {statusLabel}
          {enrolled && meta.reference?.uploadedAt ? (
            <span className="face-enroll__badge-meta">
              {new Date(meta.reference.uploadedAt).toLocaleString('pt-BR')}
            </span>
          ) : null}
        </div>
      ) : null}

      {detectStatus ? (
        <p className="face-ux__hint" role="status">
          {detectStatus}
        </p>
      ) : null}

      <div className="face-enroll__layout">
        {previewUrl ? (
          <figure className="face-enroll__ref">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={`Biometria cadastrada de ${workerName}`}
              className="face-enroll__img"
            />
            <figcaption>Referencia atual</figcaption>
          </figure>
        ) : null}

        <div className="face-enroll__capture">
          <div className="face-ux__stage face-ux__stage--enroll">
            {pendingPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pendingPreview}
                alt="Nova captura"
                className="face-ux__media"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  className={`face-ux__media${cameraOn ? '' : ' is-hidden'}`}
                  playsInline
                  muted
                  autoPlay
                  aria-label="Preview da camera"
                />
                {!cameraOn ? (
                  <div className="face-ux__placeholder">
                    <span className="face-ux__placeholder-icon" aria-hidden />
                    <span>Camera ou upload</span>
                  </div>
                ) : null}
              </>
            )}
            {(cameraOn || pendingPreview) && (
              <div className="face-ux__oval" aria-hidden />
            )}
          </div>
          <p className="face-enroll__caption">
            {pendingPreview
              ? 'Nova captura pronta para salvar'
              : cameraOn
                ? 'Centralize o rosto e toque em Capturar'
                : 'Abra a camera ou envie uma imagem'}
          </p>
        </div>
      </div>

      {cameraError ? (
        <p className="error" role="alert">
          {cameraError}
        </p>
      ) : null}

      <p className="face-ux__consent">{WORKER_FACE_REFERENCE_CONSENT_TEXT}</p>

      <div className="face-ux__actions face-ux__actions--stack">
        {!pendingPreview ? (
          <>
            <button
              type="button"
              className="btn btn-primary face-ux__btn-main"
              onClick={() => void startCamera()}
              disabled={cameraOn || saving || !engineReady}
            >
              {cameraOn ? 'Camera ativa' : 'Abrir camera'}
            </button>
            <button
              type="button"
              className="btn btn-primary face-ux__btn-main"
              onClick={capture}
              disabled={!cameraOn || saving}
            >
              Capturar
            </button>
            <button
              type="button"
              className="btn btn-secondary face-ux__btn-main"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving || !engineReady}
            >
              Enviar imagem
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPending(file);
                e.target.value = '';
              }}
            />
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-primary face-ux__btn-main"
              onClick={() => void saveReference()}
              disabled={saving || !engineReady}
            >
              {saving
                ? 'Processando...'
                : meta?.hasActiveReference
                  ? 'Recadastrar biometria'
                  : 'Cadastrar biometria'}
            </button>
            <button
              type="button"
              className="btn btn-secondary face-ux__btn-main"
              onClick={() => {
                setPending(null);
                void startCamera();
              }}
              disabled={saving}
            >
              Refazer
            </button>
          </>
        )}
        {meta?.hasActiveReference || meta?.status === 'NEEDS_REENROLLMENT' ? (
          <button
            type="button"
            className="btn btn-secondary face-ux__btn-main"
            onClick={() => void revoke()}
            disabled={saving}
          >
            Revogar
          </button>
        ) : null}
      </div>
    </section>
  );
}

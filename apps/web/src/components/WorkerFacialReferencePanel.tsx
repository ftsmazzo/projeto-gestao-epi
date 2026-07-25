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
  const [consentAccepted, setConsentAccepted] = useState(false);
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
    if (!consentAccepted) {
      setError('Confirme o aviso de uso da biometria facial.');
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
    setDetectStatus('Detectando face e gerando template...');
    try {
      const detection = await extractFaceDescriptorFromBlob(pendingBlob);
      if (!detection.ok) {
        setDetectStatus(detection.message);
        setError(detection.message);
        return;
      }
      setDetectStatus('Face unica detectada. Salvando biometria...');
      await uploadWorkerFacialReference(workerId, pendingBlob, {
        consentAccepted: true,
        faceDescriptor: detection.descriptor,
        faceEngine: FACE_ENGINE_META.engine,
        faceEngineVersion: FACE_ENGINE_META.version,
        qualityScore: detection.detectionScore,
      });
      setPending(null);
      setConsentAccepted(false);
      setDetectStatus('Biometria facial cadastrada.');
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

  const statusLabel =
    meta?.status === 'ACTIVE'
      ? meta.hasBiometricTemplate
        ? `Biometria cadastrada em ${
            meta.reference?.uploadedAt
              ? new Date(meta.reference.uploadedAt).toLocaleString('pt-BR')
              : '—'
          }`
        : 'Ativa sem template — recadastre'
      : meta?.status === 'NEEDS_REENROLLMENT'
        ? 'Precisa recadastrar biometria (foto antiga sem template)'
        : meta?.status === 'REVOKED'
          ? `Revogada${
              meta.reference?.revokedAt
                ? ` em ${new Date(meta.reference.revokedAt).toLocaleString('pt-BR')}`
                : ''
            }`
          : 'Nao cadastrada';

  return (
    <section className="notice notice--info" aria-labelledby="facial-ref-title">
      <h3 id="facial-ref-title" className="page-title page-title--sm">
        Biometria facial
      </h3>
      <p className="field-hint">
        Cadastre uma foto com exatamente um rosto. O sistema gera um template
        biometrico para matching automatico na entrega (motor face-api). Nao e
        confirmacao visual humana.
      </p>
      {!engineReady ? (
        <p className="table-sub">Carregando motor facial...</p>
      ) : null}
      {loading ? <p className="page-lead">Carregando...</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {detectStatus ? (
        <p className="table-sub" role="status">
          {detectStatus}
        </p>
      ) : null}
      {!loading && meta ? (
        <p>
          Status: <strong>{statusLabel}</strong>
        </p>
      ) : null}

      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={`Biometria facial de ${workerName}`}
          className="portal-facial__preview"
          style={{ maxWidth: 220, marginTop: '0.75rem' }}
        />
      ) : null}

      <div className="portal-facial__compare" style={{ marginTop: '0.75rem' }}>
        <div>
          <p className="table-sub">Nova captura / upload</p>
          {pendingPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pendingPreview}
              alt="Preview da nova biometria"
              className="portal-facial__preview"
            />
          ) : (
            <video
              ref={videoRef}
              className="portal-facial__preview"
              playsInline
              muted
              aria-label="Preview da camera"
            />
          )}
        </div>
      </div>

      {cameraError ? (
        <p className="error" role="alert">
          {cameraError}
        </p>
      ) : null}

      <p className="table-sub" style={{ marginTop: '0.75rem' }}>
        {WORKER_FACE_REFERENCE_CONSENT_TEXT}
      </p>
      <label className="portal-need-select" style={{ margin: '0.5rem 0' }}>
        <input
          type="checkbox"
          checked={consentAccepted}
          onChange={(e) => setConsentAccepted(e.target.checked)}
        />
        <span>Confirmo o cadastro desta biometria facial.</span>
      </label>

      <div className="btn-row">
        {!pendingPreview ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void startCamera()}
              disabled={cameraOn || saving || !engineReady}
            >
              {cameraOn ? 'Camera ativa' : 'Abrir camera'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={capture}
              disabled={!cameraOn || saving}
            >
              Capturar
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving || !engineReady}
            >
              Enviar imagem
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
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
              className="btn btn-primary"
              onClick={() => void saveReference()}
              disabled={saving || !consentAccepted || !engineReady}
            >
              {saving
                ? 'Processando...'
                : meta?.hasActiveReference
                  ? 'Substituir biometria'
                  : 'Salvar biometria'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
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
            className="btn btn-secondary"
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

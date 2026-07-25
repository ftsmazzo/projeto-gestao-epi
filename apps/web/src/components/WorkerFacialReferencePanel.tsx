'use client';

import type { WorkerFacialReferenceMeta } from '@gestao-epi/shared';
import { WORKER_FACE_REFERENCE_CONSENT_TEXT } from '@gestao-epi/shared';
import { useEffect, useRef, useState } from 'react';
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
          : 'Falha ao carregar referencia facial.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
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
      setError('Confirme o aviso de uso da referencia visual.');
      return;
    }
    if (meta?.hasActiveReference) {
      const ok = window.confirm(
        `Substituir a referencia facial de ${workerName}? A referencia anterior sera revogada.`,
      );
      if (!ok) return;
    }

    setSaving(true);
    setError(null);
    try {
      await uploadWorkerFacialReference(workerId, pendingBlob, {
        consentAccepted: true,
      });
      setPending(null);
      setConsentAccepted(false);
      await reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao salvar referencia facial.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function revoke() {
    const ok = window.confirm(
      `Revogar a referencia facial de ${workerName}? Entregas com facial ficarao bloqueadas ate novo cadastro.`,
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
          : 'Falha ao revogar referencia facial.',
      );
    } finally {
      setSaving(false);
    }
  }

  const statusLabel =
    meta?.status === 'ACTIVE'
      ? `Cadastrada em ${
          meta.reference?.uploadedAt
            ? new Date(meta.reference.uploadedAt).toLocaleString('pt-BR')
            : '—'
        }`
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
        Referencia facial
      </h3>
      <p className="field-hint">
        Esta imagem sera usada como referencia visual na entrega de EPI. Nao e
        reconhecimento facial automatico.
      </p>
      {loading ? <p className="page-lead">Carregando...</p> : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && meta ? (
        <p>
          Status:{' '}
          <strong>
            {meta.status === 'ACTIVE'
              ? 'Cadastrada'
              : meta.status === 'REVOKED'
                ? 'Revogada'
                : 'Nao cadastrada'}
          </strong>{' '}
          <span className="table-sub">({statusLabel})</span>
        </p>
      ) : null}

      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={`Referencia facial de ${workerName}`}
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
              alt="Preview da nova referencia"
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
        <span>Confirmo o uso desta imagem como referencia visual.</span>
      </label>

      <div className="btn-row">
        {!pendingPreview ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void startCamera()}
              disabled={cameraOn || saving}
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
              disabled={saving}
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
              disabled={saving || !consentAccepted}
            >
              {saving
                ? 'Salvando...'
                : meta?.hasActiveReference
                  ? 'Substituir referencia'
                  : 'Salvar referencia'}
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
        {meta?.hasActiveReference ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void revoke()}
            disabled={saving}
          >
            Revogar referencia
          </button>
        ) : null}
      </div>
    </section>
  );
}

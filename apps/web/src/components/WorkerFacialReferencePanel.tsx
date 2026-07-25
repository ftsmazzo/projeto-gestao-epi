'use client';

import type {
  WorkerBiometricConsentMeta,
  WorkerFacialReferenceMeta,
} from '@gestao-epi/shared';
import {
  WORKER_BIOMETRIC_CONSENT_TEXT,
  WORKER_FACE_REFERENCE_CONSENT_TEXT,
} from '@gestao-epi/shared';
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
import {
  fetchWorkerFacialReferenceBlob,
  getWorkerBiometricConsent,
  getWorkerFacialReference,
  grantWorkerBiometricConsent,
  revokeWorkerBiometricConsent,
  revokeWorkerFacialReference,
  uploadWorkerFacialReference,
} from '../lib/workers';

type Props = {
  workerId: string;
  workerName: string;
};

type GuideTone =
  | 'neutral'
  | 'adjusting'
  | 'ready'
  | 'processing'
  | 'matched'
  | 'rejected';

type Phase = 'idle' | 'scanning' | 'processing' | 'captured' | 'saved';

function toneForHint(hint: FaceFramingHint): GuideTone {
  if (hint === 'ready') return 'ready';
  if (hint === 'none') return 'neutral';
  return 'adjusting';
}

export function WorkerFacialReferencePanel({ workerId, workerName }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const capturingLockRef = useRef(false);
  const stableSinceRef = useRef<number | null>(null);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [meta, setMeta] = useState<WorkerFacialReferenceMeta | null>(null);
  const [consentMeta, setConsentMeta] =
    useState<WorkerBiometricConsentMeta | null>(null);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [engineReady, setEngineReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectStatus, setDetectStatus] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [guideMessage, setGuideMessage] = useState(
    'Posicione o rosto no enquadramento',
  );
  const [guideTone, setGuideTone] = useState<GuideTone>('neutral');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const setPhaseSafe = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
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

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const [next, consent] = await Promise.all([
        getWorkerFacialReference(workerId),
        getWorkerBiometricConsent(workerId),
      ]);
      setMeta(next);
      setConsentMeta(consent);
      setConsentAccepted(consent.status === 'GRANTED');
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (next.hasActiveReference) {
        const blob = await fetchWorkerFacialReferenceBlob(workerId);
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } catch (err) {
      setMeta(null);
      setConsentMeta(null);
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
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPendingPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId]);

  const applyPending = useCallback((blob: Blob) => {
    setPendingBlob(blob);
    setPendingPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    setError(null);
  }, []);

  const clearPending = useCallback(() => {
    setPendingBlob(null);
    setPendingPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  const saveBlob = useCallback(
    async (blob: Blob, { confirmReplace }: { confirmReplace: boolean }) => {
      if (confirmReplace && meta?.hasActiveReference) {
        const ok = window.confirm(
          `Substituir a biometria facial de ${workerName}? A referencia anterior sera revogada.`,
        );
        if (!ok) {
          setDetectStatus('Captura pronta. Confirme para salvar.');
          setPhaseSafe('captured');
          setGuideTone('ready');
          return false;
        }
      }

      setSaving(true);
      setError(null);
      setGuideTone('processing');
      setDetectStatus('Validando face e salvando biometria...');
      setPhaseSafe('processing');

      try {
        const detection = await extractFaceDescriptorFromBlob(blob);
        if (!detection.ok) {
          if (detection.reason === 'NO_FACE') {
            setError(
              'Nenhuma face detectada. Centralize o rosto e tente novamente.',
            );
          } else if (detection.reason === 'MULTIPLE_FACES') {
            setError('Mais de uma face detectada. Capture apenas uma pessoa.');
          } else {
            setError(detection.message);
          }
          setGuideTone('rejected');
          setDetectStatus(null);
          setPhaseSafe('captured');
          return false;
        }

        await uploadWorkerFacialReference(workerId, blob, {
          consentAccepted: true,
          faceDescriptor: detection.descriptor,
          faceEngine: FACE_ENGINE_META.engine,
          faceEngineVersion: FACE_ENGINE_META.version,
          qualityScore: detection.detectionScore,
        });
        clearPending();
        setDetectStatus('Biometria cadastrada');
        setGuideTone('matched');
        setGuideMessage('Biometria cadastrada');
        setPhaseSafe('saved');
        await reload();
        return true;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Falha ao salvar biometria facial.',
        );
        setGuideTone('rejected');
        setPhaseSafe('captured');
        return false;
      } finally {
        setSaving(false);
        capturingLockRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearPending, meta?.hasActiveReference, setPhaseSafe, workerId, workerName],
  );

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || capturingLockRef.current) return;
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
      setCameraError('Falha ao capturar a imagem.');
      capturingLockRef.current = false;
      return;
    }

    stopCamera();
    applyPending(blob);
    setGuideMessage('Captura automatica realizada');
    setGuideTone('processing');
    setDetectStatus('Captura automatica realizada');
    await saveBlob(blob, { confirmReplace: true });
  }, [applyPending, saveBlob, stopCamera, stopLoop]);

  const runScanLoop = useCallback(() => {
    stopLoop();

    const tick = async () => {
      if (phaseRef.current !== 'scanning' || capturingLockRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        loopTimerRef.current = setTimeout(() => void tick(), 280);
        return;
      }

      try {
        const scan = await scanFacesInVideo(video);
        if (phaseRef.current !== 'scanning' || capturingLockRef.current) return;
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
        // Falhas pontuais de deteccao nao interrompem o loop.
      }

      if (phaseRef.current === 'scanning' && !capturingLockRef.current) {
        loopTimerRef.current = setTimeout(() => void tick(), 280);
      }
    };

    loopTimerRef.current = setTimeout(() => void tick(), 200);
  }, [captureFrame, stopLoop]);

  async function startCamera() {
    if (consentMeta?.status !== 'GRANTED') {
      setError(
        'Registre o consentimento biometrico LGPD antes de cadastrar a face.',
      );
      return;
    }
    setCameraError(null);
    setError(null);
    setDetectStatus(null);
    setStarting(true);
    clearPending();
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
      setPhaseSafe('scanning');
      setGuideMessage('Posicione o rosto no enquadramento');
      setGuideTone('neutral');
      runScanLoop();
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? err.message
          : 'Nao foi possivel acessar a camera.',
      );
      stopCamera();
      setPhaseSafe('idle');
    } finally {
      setStarting(false);
    }
  }

  async function savePending() {
    if (!pendingBlob) return;
    await saveBlob(pendingBlob, { confirmReplace: true });
  }

  async function grantConsent() {
    if (!consentAccepted) {
      setError('Marque o aceite do consentimento biometrico.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await grantWorkerBiometricConsent(workerId);
      setConsentMeta(next);
      setDetectStatus('Consentimento biometrico registrado.');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao registrar consentimento biometrico.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function revokeConsent() {
    const ok = window.confirm(
      `Revogar o consentimento biometrico de ${workerName}? Novas entregas com facial serao bloqueadas. O historico de entregas permanece.`,
    );
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const next = await revokeWorkerBiometricConsent(
        workerId,
        revokeReason.trim() || null,
      );
      setConsentMeta(next);
      setRevokeReason('');
      setDetectStatus(
        'Consentimento revogado. Exclusao definitiva de arquivos/templates permanece pendente.',
      );
      stopCamera();
      setPhaseSafe('idle');
      await reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Falha ao revogar consentimento biometrico.',
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
      setPhaseSafe('idle');
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

  const ovalTone: GuideTone =
    phase === 'processing'
      ? 'processing'
      : phase === 'saved'
        ? 'matched'
        : phase === 'scanning'
          ? guideTone
          : pendingPreview
            ? guideTone
            : 'neutral';

  const showLive = phase === 'scanning' || (phase === 'idle' && !pendingPreview);

  return (
    <section
      className="face-enroll face-enroll--panel"
      aria-labelledby="facial-ref-title"
    >
      <header className="face-enroll__header">
        <h3 id="facial-ref-title" className="face-enroll__title">
          Biometria facial
        </h3>
        <p className="face-enroll__subtitle">
          Consentimento LGPD e captura automatica. Sem consentimento ativo nao
          e possivel cadastrar biometria nem entregar com facial.
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

      {!loading && consentMeta ? (
        <div
          className={`face-enroll__badge face-enroll__badge--${
            consentMeta.status === 'GRANTED'
              ? 'ok'
              : consentMeta.status === 'REVOKED'
                ? 'warn'
                : 'muted'
          }`}
          role="status"
        >
          <span className="face-enroll__badge-dot" aria-hidden />
          {consentMeta.status === 'GRANTED'
            ? 'Consentimento biometrico ativo'
            : consentMeta.status === 'REVOKED'
              ? 'Consentimento biometrico revogado'
              : 'Consentimento biometrico nao registrado'}
        </div>
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

      {consentMeta?.status !== 'GRANTED' ? (
        <div className="notice notice--info" role="group">
          <p className="face-ux__consent">
            {consentMeta?.consentTextTemplate ?? WORKER_BIOMETRIC_CONSENT_TEXT}
          </p>
          <label className="portal-need-select" style={{ margin: '0.5rem 0' }}>
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(e) => setConsentAccepted(e.target.checked)}
              disabled={saving}
            />
            <span>Confirmo o consentimento biometrico deste trabalhador.</span>
          </label>
          <button
            type="button"
            className="btn btn-primary face-ux__btn-main"
            onClick={() => void grantConsent()}
            disabled={saving || !consentAccepted}
          >
            {saving ? 'Registrando...' : 'Registrar consentimento'}
          </button>
        </div>
      ) : null}

      {detectStatus ? (
        <p className="face-ux__hint" role="status">
          {detectStatus}
        </p>
      ) : null}

      <div className="face-enroll__layout">
        {previewUrl && phase !== 'scanning' ? (
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
          <div className={`face-ux__stage face-ux__stage--enroll face-ux__stage--${ovalTone}`}>
            {pendingPreview && phase !== 'scanning' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pendingPreview}
                alt="Nova captura"
                className="face-ux__media face-ux__media--thumb"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  className={`face-ux__media${showLive && phase === 'scanning' ? '' : ' is-hidden'}`}
                  playsInline
                  muted
                  autoPlay
                  aria-label="Preview da camera"
                />
                {phase !== 'scanning' ? (
                  <div className="face-ux__placeholder">
                    <span className="face-ux__placeholder-icon" aria-hidden />
                    <span>Pronto para cadastrar</span>
                  </div>
                ) : null}
              </>
            )}
            {(phase === 'scanning' || pendingPreview) && (
              <div className={`face-ux__oval face-ux__oval--${ovalTone}`} aria-hidden />
            )}
            {phase === 'scanning' ? (
              <p className="face-ux__live-hint" role="status">
                {guideMessage}
              </p>
            ) : null}
            {phase === 'processing' ? (
              <div className="face-ux__overlay" role="status">
                Salvando biometria...
              </div>
            ) : null}
          </div>
          <p className="face-enroll__caption">
            {phase === 'scanning'
              ? 'Captura automatica ao centralizar o rosto'
              : phase === 'saved'
                ? 'Biometria cadastrada com sucesso'
                : phase === 'captured'
                  ? 'Captura pronta'
                  : 'Inicie a camera para cadastro automatico'}
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
        {(phase === 'idle' || phase === 'saved') &&
        consentMeta?.status === 'GRANTED' ? (
          <button
            type="button"
            className="btn btn-primary face-ux__btn-main"
            onClick={() => void startCamera()}
            disabled={starting || saving || !engineReady}
          >
            {starting
              ? 'Abrindo camera...'
              : enrolled || needsReenrollment
                ? 'Recadastrar com captura automatica'
                : 'Iniciar cadastro facial'}
          </button>
        ) : null}

        {phase === 'scanning' ? (
          <button
            type="button"
            className="btn btn-secondary face-ux__btn-main"
            onClick={() => {
              stopCamera();
              setPhaseSafe('idle');
              setGuideTone('neutral');
              setGuideMessage('Posicione o rosto no enquadramento');
            }}
            disabled={saving}
          >
            Cancelar
          </button>
        ) : null}

        {phase === 'captured' && pendingBlob ? (
          <>
            <button
              type="button"
              className="btn btn-primary face-ux__btn-main"
              onClick={() => void savePending()}
              disabled={saving || !engineReady}
            >
              {saving ? 'Salvando...' : 'Salvar biometria'}
            </button>
            <button
              type="button"
              className="btn btn-secondary face-ux__btn-main"
              onClick={() => {
                clearPending();
                void startCamera();
              }}
              disabled={saving}
            >
              Tentar novamente
            </button>
          </>
        ) : null}

        {phase === 'idle' || phase === 'saved' ? (
          <button
            type="button"
            className="btn btn-secondary face-ux__btn-main"
            onClick={() => fileInputRef.current?.click()}
            disabled={
              saving || !engineReady || consentMeta?.status !== 'GRANTED'
            }
          >
            Enviar imagem (opcional)
          </button>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            applyPending(file);
            setPhaseSafe('captured');
            setGuideTone('ready');
            setDetectStatus('Imagem carregada. Salvando...');
            void saveBlob(file, { confirmReplace: true });
            e.target.value = '';
          }}
        />

        {consentMeta?.status === 'GRANTED' ? (
          <>
            <div className="field" style={{ width: '100%' }}>
              <label htmlFor="biometric-revoke-reason">
                Motivo da revogacao (recomendado)
              </label>
              <input
                id="biometric-revoke-reason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                maxLength={1000}
                disabled={saving || phase === 'scanning' || phase === 'processing'}
                placeholder="Ex.: pedido do titular, desligamento..."
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary face-ux__btn-main"
              onClick={() => void revokeConsent()}
              disabled={saving || phase === 'scanning' || phase === 'processing'}
            >
              Revogar consentimento biometrico
            </button>
          </>
        ) : null}

        {meta?.hasActiveReference || meta?.status === 'NEEDS_REENROLLMENT' ? (
          <button
            type="button"
            className="btn btn-secondary face-ux__btn-main"
            onClick={() => void revoke()}
            disabled={saving || phase === 'scanning' || phase === 'processing'}
          >
            Revogar apenas referencia facial
          </button>
        ) : null}
      </div>
    </section>
  );
}

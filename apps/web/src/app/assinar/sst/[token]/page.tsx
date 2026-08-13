'use client';

import type { LivenessChallengeType, PublicSstUnlockResponse } from '@gestao-epi/shared';
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
  completeSstDocumentSign,
  sstSignedPdfUrl,
  unlockSstDocument,
} from '../../../../lib/sst-sign-public';

type GuideTone = 'neutral' | 'adjusting' | 'ready' | 'processing' | 'matched' | 'rejected';
type Phase = 'locked' | 'reading' | 'ready' | 'scanning' | 'liveness' | 'processing' | 'done';

function toneForHint(hint: FaceFramingHint): GuideTone {
  if (hint === 'ready') return 'ready';
  if (hint === 'none') return 'neutral';
  return 'adjusting';
}

export default function SstSignPage() {
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
  const [data, setData] = useState<PublicSstUnlockResponse | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guideTone, setGuideTone] = useState<GuideTone>('neutral');
  const [guideMessage, setGuideMessage] = useState('Posicione o rosto no enquadramento');
  const [modelsReady, setModelsReady] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<LivenessChallengeType | null>(null);
  const [turnUiPhase, setTurnUiPhase] = useState<'turn' | 'center' | null>(null);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    capturingRef.current = false;
    stableSinceRef.current = null;
    livenessRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(() => {
    let cancelled = false;
    void loadFaceModels()
      .then(() => {
        if (!cancelled) setModelsReady(true);
      })
      .catch(() => {
        if (!cancelled) setError('Nao foi possivel carregar o motor facial.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onUnlock(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setUnlocking(true);
    try {
      const result = await unlockSstDocument(token, cpfLast4);
      setData(result);
      setPhase('reading');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel validar.');
    } finally {
      setUnlocking(false);
    }
  }

  async function startScan() {
    if (!accepted) {
      setError('Confirme que leu o termo para continuar.');
      return;
    }
    if (!modelsReady) {
      setError('Aguarde o motor facial.');
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
      void scanLoop();
    } catch {
      setError('Permita a camera e tente novamente.');
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
          if (scan.kind === 'busy') {
            await new Promise((r) => setTimeout(r, 80));
            continue;
          }
          const { hint, message } = evaluateFaceFraming(scan);
          setGuideTone(toneForHint(hint));
          setGuideMessage(message);
          if (hint === 'ready') {
            if (stableSinceRef.current == null) stableSinceRef.current = Date.now();
            else if (
              Date.now() - stableSinceRef.current >= AUTO_CAPTURE_STABLE_MS &&
              !capturingRef.current
            ) {
              const tracker = createLivenessTracker();
              livenessRef.current = tracker;
              setActiveChallenge(tracker.challenge);
              setTurnUiPhase('turn');
              setPhase('liveness');
              setGuideMessage(livenessChallengeLabel(tracker.challenge));
              stableSinceRef.current = null;
            }
          } else {
            stableSinceRef.current = null;
          }
        } else if (current === 'liveness') {
          const scan = await scanFacesWithLandmarks(video);
          if (scan.kind === 'busy') {
            await new Promise((r) => setTimeout(r, 80));
            continue;
          }
          let tracker = livenessRef.current ?? createLivenessTracker();
          livenessRef.current = tracker;
          const { state, progress } = evaluateLiveness(scan, tracker);
          livenessRef.current = state;
          setTurnUiPhase(state.turnPhase);
          setGuideMessage(progress.message);
          if (progress.timedOut) {
            scanningRef.current = false;
            setError(progress.message);
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
        // continua
      }
      await new Promise((r) =>
        setTimeout(
          r,
          phaseRef.current === 'liveness' ? LIVENESS_INTERVAL_MS : SCAN_INTERVAL_MS,
        ),
      );
    }
  }

  async function captureAndSubmit(challenge: LivenessChallengeType) {
    setPhase('processing');
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
        setPhase('ready');
        return;
      }
      await completeSstDocumentSign(token, blob, {
        cpfLast4,
        faceDescriptor: extracted.descriptor,
        faceEngine: FACE_ENGINE_META.engine,
        livenessPassed: true,
        livenessChallenge: challenge,
      });
      setPhase('done');
      setGuideTone('matched');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel confirmar.');
      setPhase('ready');
    }
  }

  const payload = data?.payload;
  const live = phase === 'scanning' || phase === 'liveness' || phase === 'processing';

  return (
    <main className={`enroll-page${live ? ' enroll-page--capture enroll-page--live' : ''}`}>
      <div className="enroll-page__atmosphere" aria-hidden />
      <div className="enroll-page__sheet">
        <header className="enroll-page__hero">
          <p className="enroll-page__brand">ProntEPI</p>
          <h1 className="enroll-page__title">Ciencia de documento SST</h1>
          <p className="enroll-page__lead">
            {phase === 'done'
              ? 'Documento confirmado com a sua face.'
              : phase === 'locked'
                ? 'Informe os 4 ultimos digitos do CPF para ler o documento.'
                : `Ola${data ? `, ${data.workerFirstName}` : ''}. Leia e confirme com a camera.`}
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
              maxLength={4}
              value={cpfLast4}
              onChange={(e) =>
                setCpfLast4(e.target.value.replace(/\D/g, '').slice(0, 4))
              }
              required
            />
            <button
              type="submit"
              className="enroll-page__btn"
              disabled={unlocking || cpfLast4.length !== 4}
            >
              {unlocking ? 'Validando…' : 'Abrir documento'}
            </button>
          </form>
        ) : null}

        {phase === 'reading' && payload ? (
          <div className="enroll-page__form">
            <p className="enroll-page__hint">
              <strong>{data?.documentTitle}</strong>
              <br />
              {payload.company.legalName} · {payload.worker.jobFunctionName ?? '—'}
            </p>
            {payload.os ? (
              <>
                <p className="enroll-page__hint">
                  {payload.os.functionDescription || 'Funcao conforme cadastro.'}
                </p>
                {payload.os.epis.length > 0 ? (
                  <p className="enroll-page__hint">
                    EPIs: {payload.os.epis.join(', ')}
                  </p>
                ) : null}
              </>
            ) : null}
            {payload.integration ? (
              <p className="enroll-page__hint">
                Integracao de {payload.integration.durationHours}h ·{' '}
                {payload.integration.topics.length} assuntos.
              </p>
            ) : null}
            <p className="enroll-page__hint">{payload.termText}</p>
            <label className="enroll-page__consent">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>Li e estou ciente deste documento.</span>
            </label>
            <button
              type="button"
              className="enroll-page__btn"
              disabled={!accepted}
              onClick={() => setPhase('ready')}
            >
              Confirmar com a face
            </button>
          </div>
        ) : null}

        {phase === 'done' ? (
          <div className="enroll-page__success" role="status">
            <p>Ciencia registrada.</p>
            <a
              className="enroll-page__btn"
              href={sstSignedPdfUrl(token, cpfLast4)}
            >
              Baixar PDF
            </a>
          </div>
        ) : null}

        {phase !== 'locked' && phase !== 'reading' && phase !== 'done' ? (
          <div className={`enroll-page__capture${live ? ' enroll-page__capture--live' : ''}`}>
            <p className="enroll-page__live-status" role="status">
              {phase === 'processing' ? 'Validando…' : guideMessage}
            </p>
            <div className={`face-ux__stage face-ux__stage--enroll face-ux__stage--${guideTone}`}>
              <video
                ref={videoRef}
                className={`face-ux__media${
                  phase === 'scanning' || phase === 'liveness' ? '' : ' is-hidden'
                }`}
                playsInline
                muted
                autoPlay
              />
              {phase !== 'scanning' && phase !== 'liveness' ? (
                <div className="face-ux__placeholder">
                  <span>Pronto para capturar</span>
                </div>
              ) : null}
              <div className={`face-ux__oval face-ux__oval--${guideTone}`} aria-hidden />
              {phase === 'liveness' &&
              activeChallenge &&
              turnUiPhase === 'turn' &&
              livenessArrowSide(activeChallenge, true) ? (
                <div
                  className={`face-ux__turn-arrow face-ux__turn-arrow--${livenessArrowSide(activeChallenge, true)}`}
                  aria-hidden
                />
              ) : null}
            </div>
            <div className="enroll-page__actions">
              {phase === 'ready' ? (
                <button
                  type="button"
                  className="enroll-page__btn"
                  onClick={() => void startScan()}
                  disabled={!modelsReady}
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
                  }}
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

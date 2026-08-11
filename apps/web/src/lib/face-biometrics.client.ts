/**
 * Cliente do motor facial (@vladmandic/face-api via script em /vendor).
 * Roda apenas no browser. O matching definitivo ocorre no backend.
 *
 * Modelos: /public/models (TinyFaceDetector + Landmark68 + FaceRecognition).
 * Documentacao: docs/ESTADO-ATUAL-SISTEMA.md (09.1.1 / 09.1.3).
 */

import {
  FACE_DESCRIPTOR_LENGTH,
  FACE_ENGINE,
  FACE_ENGINE_VERSION,
  LIVENESS_CHALLENGE_LABELS,
  LIVENESS_MVP_NOTICE,
  type LivenessChallengeType,
} from '@gestao-epi/shared';

export type FaceDetectionOutcome =
  | { ok: true; descriptor: number[]; faceCount: 1; detectionScore: number }
  | {
      ok: false;
      reason: 'NO_FACE' | 'MULTIPLE_FACES' | 'ENGINE_ERROR';
      faceCount: number;
      message: string;
    };

export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FacePoint = { x: number; y: number };

export type LiveFaceScan =
  | { kind: 'none' }
  | { kind: 'multiple'; count: number }
  | {
      kind: 'one';
      box: FaceBox;
      score: number;
      videoWidth: number;
      videoHeight: number;
      landmarks?: FacePoint[];
    };

export type FaceFramingHint =
  | 'none'
  | 'multiple'
  | 'too_far'
  | 'off_center'
  | 'hold_still'
  | 'ready';

export type LivenessTrackerState = {
  challenge: LivenessChallengeType;
  /** EAR baixo visto (piscar). */
  blinkClosedSeen: boolean;
  /** Frames com yaw no alvo. */
  turnHoldFrames: number;
  startedAt: number;
  /** Media do EAR com olhos abertos (baseline no mobile). */
  openEarBaseline: number | null;
  openEarSamples: number;
  /** Virada: primeiro alcancar o angulo, depois voltar ao centro. */
  turnPhase: 'turn' | 'center';
  centerHoldFrames: number;
  /** Preview espelhada (camera frontal + CSS). Afeta yaw e seta. */
  previewMirrored: boolean;
};

export type LivenessProgress = {
  passed: boolean;
  message: string;
  timedOut: boolean;
};

type FaceApiGlobal = {
  nets: {
    tinyFaceDetector: { loadFromUri: (uri: string) => Promise<void> };
    faceLandmark68Net: { loadFromUri: (uri: string) => Promise<void> };
    faceRecognitionNet: { loadFromUri: (uri: string) => Promise<void> };
  };
  TinyFaceDetectorOptions: new (opts?: {
    inputSize?: number;
    scoreThreshold?: number;
  }) => unknown;
  detectAllFaces: (
    input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    options?: unknown,
  ) => {
    withFaceLandmarks: () => {
      withFaceDescriptors: () => Promise<
        Array<{
          detection: { score: number; box: FaceBox };
          landmarks: { positions: FacePoint[] };
          descriptor: Float32Array | number[];
        }>
      >;
      then: Promise<
        Array<{
          detection: { score: number; box: FaceBox };
          landmarks: { positions: FacePoint[] };
        }>
      >['then'];
    };
    then: Promise<
      Array<{
        score: number;
        box: FaceBox;
      }>
    >['then'];
  };
};

declare global {
  interface Window {
    faceapi?: FaceApiGlobal;
  }
}

let modelsReady: Promise<void> | null = null;

/** Tempo minimo de enquadramento estavel antes da captura automatica. */
export const AUTO_CAPTURE_STABLE_MS = 900;
/** Timeout do desafio de liveness (MVP). */
export const LIVENESS_TIMEOUT_MS = 20_000;
/** Intervalo do loop durante enquadramento. */
export const SCAN_INTERVAL_MS = 260;
/** Intervalo mais rapido no desafio de presenca. */
export const LIVENESS_INTERVAL_MS = 100;
/** Frames com yaw no alvo para considerar virada. */
const LIVENESS_TURN_HOLD_FRAMES = 3;
/** Frames de frente apos a virada (anti-spoof simples). */
const LIVENESS_CENTER_HOLD_FRAMES = 2;
/** Limiares absolutos (fallback); no mobile usamos queda relativa ao baseline. */
const EAR_CLOSED_ABS = 0.22;
const EAR_OPEN_ABS = 0.26;
/**
 * |yaw| minimo (espelhado: positivo = esquerda na tela do usuario).
 * Um pouco mais baixo que desktop para mobile/selfie wide.
 */
const YAW_TURN_THRESHOLD = 0.14;
const YAW_CENTER_THRESHOLD = 0.09;

/** Face precisa ocupar pelo menos esta fracao da largura do video. */
const MIN_FACE_WIDTH_RATIO = 0.22;
/** Centro da face deve ficar nesta faixa relativa do quadro. */
const CENTER_X_MIN = 0.28;
const CENTER_X_MAX = 0.72;
const CENTER_Y_MIN = 0.22;
const CENTER_Y_MAX = 0.78;

function getFaceApi(): FaceApiGlobal {
  if (typeof window === 'undefined' || !window.faceapi) {
    throw new Error('Motor facial nao carregado no navegador.');
  }
  return window.faceapi;
}

async function ensureScript(): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Motor facial so funciona no browser.');
  }
  if (window.faceapi) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-face-api="1"]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Falha ao carregar face-api.')),
      );
      if (window.faceapi) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = '/vendor/face-api.js';
    script.async = true;
    script.dataset.faceApi = '1';
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Falha ao carregar /vendor/face-api.js'));
    document.head.appendChild(script);
  });
}

export async function loadFaceModels(): Promise<void> {
  if (!modelsReady) {
    modelsReady = (async () => {
      await ensureScript();
      const faceapi = getFaceApi();
      const uri = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(uri),
        faceapi.nets.faceLandmark68Net.loadFromUri(uri),
        faceapi.nets.faceRecognitionNet.loadFromUri(uri),
      ]);
    })().catch((err) => {
      modelsReady = null;
      throw err;
    });
  }
  await modelsReady;
}

function toNumberArray(descriptor: Float32Array | number[]): number[] {
  return Array.from(descriptor).map((n) => Number(n));
}

/** Deteccao leve (sem descritor) para loop de enquadramento. */
export async function scanFacesInVideo(
  video: HTMLVideoElement,
): Promise<LiveFaceScan> {
  await loadFaceModels();
  const faceapi = getFaceApi();
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.45,
  });
  const detections = await faceapi.detectAllFaces(video, options);
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;

  if (!detections.length) return { kind: 'none' };
  if (detections.length > 1) {
    return { kind: 'multiple', count: detections.length };
  }

  const first = detections[0]!;
  return {
    kind: 'one',
    box: first.box,
    score: first.score,
    videoWidth: vw,
    videoHeight: vh,
  };
}

/** Deteccao com landmarks 68 para desafio de liveness. */
export async function scanFacesWithLandmarks(
  video: HTMLVideoElement,
): Promise<LiveFaceScan> {
  await loadFaceModels();
  const faceapi = getFaceApi();
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.4,
  });
  const detections = await faceapi
    .detectAllFaces(video, options)
    .withFaceLandmarks();
  const vw = video.videoWidth || 1;
  const vh = video.videoHeight || 1;

  if (!detections.length) return { kind: 'none' };
  if (detections.length > 1) {
    return { kind: 'multiple', count: detections.length };
  }

  const first = detections[0]!;
  return {
    kind: 'one',
    box: first.detection.box,
    score: first.detection.score,
    videoWidth: vw,
    videoHeight: vh,
    landmarks: first.landmarks.positions.map((p) => ({ x: p.x, y: p.y })),
  };
}

function eyeAspectRatio(eye: FacePoint[]): number {
  if (eye.length < 6) return 1;
  const p1 = eye[0]!;
  const p2 = eye[1]!;
  const p3 = eye[2]!;
  const p4 = eye[3]!;
  const p5 = eye[4]!;
  const p6 = eye[5]!;
  const vertical1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
  const vertical2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
  const horizontal = Math.hypot(p1.x - p4.x, p1.y - p4.y);
  if (horizontal < 1e-6) return 1;
  return (vertical1 + vertical2) / (2 * horizontal);
}

function meanEar(landmarks: FacePoint[]): number | null {
  if (landmarks.length < 48) return null;
  const left = landmarks.slice(36, 42);
  const right = landmarks.slice(42, 48);
  return (eyeAspectRatio(left) + eyeAspectRatio(right)) / 2;
}

/**
 * Yaw com semantica de tela: positivo = esquerda na preview (como o usuario ve).
 * Camera frontal + CSS scaleX(-1) = previewMirrored true.
 * Camera traseira sem espelho = previewMirrored false.
 */
function screenYaw(
  landmarks: FacePoint[],
  previewMirrored: boolean,
): number | null {
  if (landmarks.length < 31) return null;
  const jawLeft = landmarks[0]!;
  const jawRight = landmarks[16]!;
  const nose = landmarks[30]!;
  const faceWidth = Math.abs(jawRight.x - jawLeft.x);
  if (faceWidth < 1) return null;
  const centerX = (jawLeft.x + jawRight.x) / 2;
  const raw = (nose.x - centerX) / faceWidth;
  // Frame raw (frontal): virar a esquerda fisica move o nariz para a DIREITA do frame.
  // Com preview espelhada, isso aparece a ESQUERDA na tela → raw positivo = esquerda na tela.
  // Sem espelho, invertemos para manter o mesmo semantico de "esquerda na tela".
  return previewMirrored ? raw : -raw;
}

export function pickLivenessChallenge(): LivenessChallengeType {
  // Piscar falha com frequencia no mobile (EAR + taxa de amostragem).
  // Virar a cabeca e o desafio padrao; seta na UI indica o lado.
  return Math.random() < 0.5 ? 'turn_left' : 'turn_right';
}

export function createLivenessTracker(
  challenge: LivenessChallengeType = pickLivenessChallenge(),
  options?: { previewMirrored?: boolean },
): LivenessTrackerState {
  return {
    challenge,
    blinkClosedSeen: false,
    turnHoldFrames: 0,
    startedAt: Date.now(),
    openEarBaseline: null,
    openEarSamples: 0,
    turnPhase: 'turn',
    centerHoldFrames: 0,
    previewMirrored: options?.previewMirrored ?? true,
  };
}

export function livenessChallengeLabel(
  challenge: LivenessChallengeType,
): string {
  return LIVENESS_CHALLENGE_LABELS[challenge];
}

/**
 * Lado da seta na UI (coordenadas da tela).
 * Com camera frontal espelhada a seta aponta para o lado que o usuario deve virar na preview.
 * Sem espelho, inverte em relacao ao desafio bruto do frame.
 */
export function livenessArrowSide(
  challenge: LivenessChallengeType,
  previewMirrored = true,
): 'left' | 'right' | null {
  if (challenge === 'turn_left') {
    return previewMirrored ? 'left' : 'right';
  }
  if (challenge === 'turn_right') {
    return previewMirrored ? 'right' : 'left';
  }
  return null;
}

export function evaluateLiveness(
  scan: LiveFaceScan,
  state: LivenessTrackerState,
  now = Date.now(),
): { state: LivenessTrackerState; progress: LivenessProgress } {
  const elapsed = now - state.startedAt;
  if (elapsed > LIVENESS_TIMEOUT_MS) {
    return {
      state,
      progress: {
        passed: false,
        timedOut: true,
        message: 'Tempo esgotado. Tente novamente o desafio de presenca.',
      },
    };
  }

  const label = livenessChallengeLabel(state.challenge);
  if (scan.kind !== 'one' || !scan.landmarks?.length) {
    return {
      state: {
        ...state,
        turnHoldFrames: 0,
        centerHoldFrames: 0,
      },
      progress: {
        passed: false,
        timedOut: false,
        message: `${label} — mantenha o rosto no oval`,
      },
    };
  }

  if (state.challenge === 'blink') {
    const ear = meanEar(scan.landmarks);
    if (ear == null) {
      return {
        state,
        progress: {
          passed: false,
          timedOut: false,
          message: label,
        },
      };
    }

    let nextState = state;
    if (!state.blinkClosedSeen && state.openEarSamples < 5 && ear >= 0.2) {
      const n = state.openEarSamples + 1;
      const baseline =
        state.openEarBaseline == null
          ? ear
          : (state.openEarBaseline * state.openEarSamples + ear) / n;
      nextState = {
        ...state,
        openEarBaseline: baseline,
        openEarSamples: n,
      };
      if (n < 3) {
        return {
          state: nextState,
          progress: {
            passed: false,
            timedOut: false,
            message: 'Olhe para a camera…',
          },
        };
      }
    }

    const baseline = nextState.openEarBaseline ?? 0.3;
    const closedThreshold = Math.max(
      0.14,
      Math.min(EAR_CLOSED_ABS, baseline * 0.75),
    );
    const openThreshold = Math.max(EAR_OPEN_ABS, baseline * 0.9);

    if (!nextState.blinkClosedSeen && ear <= closedThreshold) {
      return {
        state: { ...nextState, blinkClosedSeen: true },
        progress: {
          passed: false,
          timedOut: false,
          message: 'Bom — abra os olhos',
        },
      };
    }
    if (nextState.blinkClosedSeen && ear >= openThreshold) {
      return {
        state: nextState,
        progress: {
          passed: true,
          timedOut: false,
          message: 'Presenca confirmada',
        },
      };
    }
    return {
      state: nextState,
      progress: {
        passed: false,
        timedOut: false,
        message: nextState.blinkClosedSeen
          ? 'Abra os olhos'
          : 'Pisque os olhos (um piscar forte)',
      },
    };
  }

  const yaw = screenYaw(scan.landmarks, state.previewMirrored);
  if (yaw == null) {
    return {
      state: { ...state, turnHoldFrames: 0, centerHoldFrames: 0 },
      progress: {
        passed: false,
        timedOut: false,
        message: label,
      },
    };
  }

  const targetOk =
    state.challenge === 'turn_left'
      ? yaw >= YAW_TURN_THRESHOLD
      : yaw <= -YAW_TURN_THRESHOLD;
  const centered = Math.abs(yaw) <= YAW_CENTER_THRESHOLD;

  if (state.turnPhase === 'turn') {
    if (targetOk) {
      const hold = state.turnHoldFrames + 1;
      if (hold >= LIVENESS_TURN_HOLD_FRAMES) {
        return {
          state: {
            ...state,
            turnHoldFrames: hold,
            turnPhase: 'center',
            centerHoldFrames: 0,
          },
          progress: {
            passed: false,
            timedOut: false,
            message: 'Otimo — olhe de frente para a camera',
          },
        };
      }
      return {
        state: { ...state, turnHoldFrames: hold },
        progress: {
          passed: false,
          timedOut: false,
          message: `${label} — mantenha`,
        },
      };
    }
    return {
      state: { ...state, turnHoldFrames: 0 },
      progress: {
        passed: false,
        timedOut: false,
        message: label,
      },
    };
  }

  // Fase: voltar ao centro (prova de movimento real, nao foto estatica).
  if (centered) {
    const hold = state.centerHoldFrames + 1;
    if (hold >= LIVENESS_CENTER_HOLD_FRAMES) {
      return {
        state: { ...state, centerHoldFrames: hold },
        progress: {
          passed: true,
          timedOut: false,
          message: 'Presenca confirmada',
        },
      };
    }
    return {
      state: { ...state, centerHoldFrames: hold },
      progress: {
        passed: false,
        timedOut: false,
        message: 'Olhe de frente — quase la',
      },
    };
  }

  return {
    state: { ...state, centerHoldFrames: 0 },
    progress: {
      passed: false,
      timedOut: false,
      message: 'Olhe de frente para a camera',
    },
  };
}

export function evaluateFaceFraming(scan: LiveFaceScan): {
  hint: FaceFramingHint;
  message: string;
} {
  if (scan.kind === 'none') {
    return {
      hint: 'none',
      message: 'Posicione o rosto no enquadramento',
    };
  }
  if (scan.kind === 'multiple') {
    return {
      hint: 'multiple',
      message: 'Capture apenas uma pessoa por vez',
    };
  }

  const { box, videoWidth, videoHeight } = scan;
  const cx = (box.x + box.width / 2) / videoWidth;
  const cy = (box.y + box.height / 2) / videoHeight;
  const widthRatio = box.width / videoWidth;

  if (widthRatio < MIN_FACE_WIDTH_RATIO) {
    return { hint: 'too_far', message: 'Aproxime o rosto' };
  }

  const centered =
    cx >= CENTER_X_MIN &&
    cx <= CENTER_X_MAX &&
    cy >= CENTER_Y_MIN &&
    cy <= CENTER_Y_MAX;

  if (!centered) {
    return { hint: 'off_center', message: 'Centralize o rosto' };
  }

  return { hint: 'ready', message: 'Mantenha o rosto parado' };
}

export async function extractFaceDescriptorFromImage(
  input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
): Promise<FaceDetectionOutcome> {
  try {
    await loadFaceModels();
    const faceapi = getFaceApi();
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 416,
      scoreThreshold: 0.5,
    });
    const detections = await faceapi
      .detectAllFaces(input, options)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!detections.length) {
      return {
        ok: false,
        reason: 'NO_FACE',
        faceCount: 0,
        message: 'Nenhuma face detectada. Centralize o rosto e tente novamente.',
      };
    }
    if (detections.length > 1) {
      return {
        ok: false,
        reason: 'MULTIPLE_FACES',
        faceCount: detections.length,
        message:
          'Mais de uma face detectada. Capture apenas o trabalhador individualmente.',
      };
    }

    const first = detections[0]!;
    const descriptor = toNumberArray(first.descriptor);
    if (descriptor.length !== FACE_DESCRIPTOR_LENGTH) {
      return {
        ok: false,
        reason: 'ENGINE_ERROR',
        faceCount: 1,
        message: 'Descritor facial invalido gerado pelo motor.',
      };
    }

    return {
      ok: true,
      descriptor,
      faceCount: 1,
      detectionScore: first.detection.score,
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'ENGINE_ERROR',
      faceCount: 0,
      message:
        err instanceof Error
          ? err.message
          : 'Falha ao processar biometria facial.',
    };
  }
}

export async function extractFaceDescriptorFromBlob(
  blob: Blob,
): Promise<FaceDetectionOutcome> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'));
      el.src = url;
    });
    return extractFaceDescriptorFromImage(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const FACE_ENGINE_META = {
  engine: FACE_ENGINE,
  version: FACE_ENGINE_VERSION,
} as const;

/**
 * Abre a camera frontal sem forcar crop/zoom tipico de ideal 640x640 no mobile.
 * Tenta zerar zoom digital quando o device expõe a capability.
 */
export async function openSelfieCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error(
      'Camera indisponivel neste navegador. Use HTTPS ou um dispositivo com camera.',
    );
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user' },
    });
  }

  await resetSelfieZoom(stream);
  return stream;
}

async function resetSelfieZoom(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  if (!track?.getCapabilities) return;
  try {
    const caps = track.getCapabilities() as MediaTrackCapabilities & {
      zoom?: { min: number; max: number; step?: number };
    };
    if (caps.zoom && typeof caps.zoom.min === 'number') {
      await track.applyConstraints({
        advanced: [{ zoom: caps.zoom.min } as MediaTrackConstraintSet],
      });
    }
  } catch {
    // Nem todo browser/device permite ajustar zoom.
  }
}

export { LIVENESS_MVP_NOTICE };

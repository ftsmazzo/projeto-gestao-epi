/**
 * Cliente do motor facial (@vladmandic/face-api via script em /vendor).
 * Roda apenas no browser. O matching definitivo ocorre no backend.
 *
 * Modelos: /public/models (TinyFaceDetector + Landmark68 + FaceRecognition).
 * Documentacao: docs/ESTADO-ATUAL-SISTEMA.md (09.1.1).
 */

import {
  FACE_DESCRIPTOR_LENGTH,
  FACE_ENGINE,
  FACE_ENGINE_VERSION,
} from '@gestao-epi/shared';

export type FaceDetectionOutcome =
  | { ok: true; descriptor: number[]; faceCount: 1; detectionScore: number }
  | {
      ok: false;
      reason: 'NO_FACE' | 'MULTIPLE_FACES' | 'ENGINE_ERROR';
      faceCount: number;
      message: string;
    };

type FaceApiGlobal = {
  nets: {
    tinyFaceDetector: { loadFromUri: (uri: string) => Promise<void> };
    faceLandmark68Net: { loadFromUri: (uri: string) => Promise<void> };
    faceRecognitionNet: { loadFromUri: (uri: string) => Promise<void> };
  };
  TinyFaceDetectorOptions: new (opts?: { inputSize?: number; scoreThreshold?: number }) => unknown;
  detectAllFaces: (
    input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
    options?: unknown,
  ) => {
    withFaceLandmarks: () => {
      withFaceDescriptors: () => Promise<
        Array<{
          detection: { score: number };
          descriptor: Float32Array | number[];
        }>
      >;
    };
  };
};

declare global {
  interface Window {
    faceapi?: FaceApiGlobal;
  }
}

let modelsReady: Promise<void> | null = null;

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

/**
 * Motor facial do MVP: @vladmandic/face-api (FaceRecognitionNet, descritor 128-d).
 * Matching por distancia euclidiana no backend — o cliente so extrai o descritor.
 * Nao e liveness; nao substitui provider biometrico certificado futuro (D03).
 */

export const FACE_ENGINE = 'vladmandic/face-api' as const;
export const FACE_ENGINE_VERSION = '1.7.x-facerecognitionnet';
export const FACE_DESCRIPTOR_LENGTH = 128;

/** Distancia maxima para considerar match (menor = mais parecido). Padrao face-api ~0.6. */
export const FACE_MATCH_THRESHOLD_DEFAULT = 0.55;

export function euclideanDistance(
  a: number[],
  b: number[],
): number {
  if (a.length !== b.length) {
    throw new Error('Descritores com tamanhos diferentes.');
  }
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i]! - b[i]!;
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function isValidFaceDescriptor(
  value: unknown,
): value is number[] {
  if (!Array.isArray(value) || value.length !== FACE_DESCRIPTOR_LENGTH) {
    return false;
  }
  return value.every(
    (n) => typeof n === 'number' && Number.isFinite(n),
  );
}

export function resolveFaceMatchThreshold(
  fromEnv?: string | null,
): number {
  if (!fromEnv?.trim()) return FACE_MATCH_THRESHOLD_DEFAULT;
  const n = Number.parseFloat(fromEnv);
  if (!Number.isFinite(n) || n <= 0 || n > 2) {
    return FACE_MATCH_THRESHOLD_DEFAULT;
  }
  return n;
}

export type FaceMatchDecision = {
  matched: boolean;
  distance: number;
  threshold: number;
};

export function decideFaceMatch(
  reference: number[],
  capture: number[],
  threshold = FACE_MATCH_THRESHOLD_DEFAULT,
): FaceMatchDecision {
  const distance = euclideanDistance(reference, capture);
  return {
    matched: distance <= threshold,
    distance,
    threshold,
  };
}

/** Desafios leves de presenca (MVP). Nao substitui biometria certificada (D03). */
export type LivenessChallengeType = 'blink' | 'turn_left' | 'turn_right';

export const LIVENESS_CHALLENGE_LABELS: Record<LivenessChallengeType, string> = {
  blink: 'Pisque os olhos',
  turn_left: 'Vire a cabeca para a esquerda',
  turn_right: 'Vire a cabeca para a direita',
};

export const LIVENESS_MVP_NOTICE =
  'Desafio de presenca (MVP). Nao substitui biometria certificada.';

export function isLivenessChallengeType(
  value: unknown,
): value is LivenessChallengeType {
  return value === 'blink' || value === 'turn_left' || value === 'turn_right';
}

/**
 * Exige liveness quando LIVENESS_REQUIRED=true/1, ou em producao se a env
 * nao estiver definida. Desliga com LIVENESS_REQUIRED=false/0.
 */
export function isLivenessRequired(
  livenessRequiredEnv?: string | null,
  nodeEnv?: string | null,
): boolean {
  const raw = livenessRequiredEnv?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'off') return false;
  if (raw === 'true' || raw === '1' || raw === 'on') return true;
  return nodeEnv === 'production';
}

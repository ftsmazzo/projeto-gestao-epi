import { existsSync } from 'fs';
import { isValidFaceDescriptor } from '@gestao-epi/shared';
import { WorkerFacialReferenceStatus } from '@prisma/client';
import { resolveWorkerFaceReferenceAbsolutePath } from './worker-face-reference.storage';

export type WorkerBiometricListStatus =
  | 'OK'
  | 'OK_MISSING_IMAGE'
  | 'NEEDS_REENROLLMENT'
  | 'REVOKED'
  | 'MISSING'
  | 'INCOMPLETE';

export function evaluateWorkerBiometrics(input: {
  status: WorkerFacialReferenceStatus | null | undefined;
  faceDescriptor: unknown;
  filePath: string | null | undefined;
}): {
  hasValidBiometrics: boolean;
  hasFaceImage: boolean;
  hasDescriptor: boolean;
  biometricStatus: WorkerBiometricListStatus;
} {
  const hasDescriptor = isValidFaceDescriptor(input.faceDescriptor);
  const hasFaceImage = Boolean(
    input.filePath &&
      existsSync(resolveWorkerFaceReferenceAbsolutePath(input.filePath)),
  );

  if (!input.status) {
    return {
      hasValidBiometrics: false,
      hasFaceImage: false,
      hasDescriptor: false,
      biometricStatus: 'MISSING',
    };
  }

  if (input.status === WorkerFacialReferenceStatus.REVOKED) {
    return {
      hasValidBiometrics: false,
      hasFaceImage,
      hasDescriptor,
      biometricStatus: 'REVOKED',
    };
  }

  if (input.status === WorkerFacialReferenceStatus.NEEDS_REENROLLMENT) {
    return {
      hasValidBiometrics: false,
      hasFaceImage,
      hasDescriptor,
      biometricStatus: 'NEEDS_REENROLLMENT',
    };
  }

  // ACTIVE
  if (hasDescriptor) {
    return {
      // Matching operacional depende do template, nao da foto de referencia.
      hasValidBiometrics: true,
      hasFaceImage,
      hasDescriptor,
      biometricStatus: hasFaceImage ? 'OK' : 'OK_MISSING_IMAGE',
    };
  }

  return {
    hasValidBiometrics: false,
    hasFaceImage,
    hasDescriptor: false,
    biometricStatus: hasFaceImage ? 'INCOMPLETE' : 'NEEDS_REENROLLMENT',
  };
}

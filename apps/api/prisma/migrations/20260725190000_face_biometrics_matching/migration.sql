-- AlterEnum (novos valores; uso em UPDATE fica na migration seguinte)
ALTER TYPE "DeliveryEvidenceVerificationStatus" ADD VALUE 'MATCHED';
ALTER TYPE "DeliveryEvidenceVerificationStatus" ADD VALUE 'REJECTED';
ALTER TYPE "DeliveryEvidenceVerificationStatus" ADD VALUE 'NO_FACE_DETECTED';
ALTER TYPE "DeliveryEvidenceVerificationStatus" ADD VALUE 'MULTIPLE_FACES_DETECTED';

ALTER TYPE "WorkerFacialReferenceStatus" ADD VALUE 'NEEDS_REENROLLMENT';

-- AlterTable WorkerFacialReference
ALTER TABLE "WorkerFacialReference" ADD COLUMN "faceDescriptor" JSONB,
ADD COLUMN "faceEngine" TEXT,
ADD COLUMN "faceEngineVersion" TEXT,
ADD COLUMN "qualityScore" DOUBLE PRECISION;

-- AlterTable DeliveryEvidence
ALTER TABLE "DeliveryEvidence" ADD COLUMN "matchDistance" DOUBLE PRECISION,
ADD COLUMN "matchThreshold" DOUBLE PRECISION,
ADD COLUMN "faceEngine" TEXT,
ADD COLUMN "verifiedAt" TIMESTAMP(3);

CREATE INDEX "DeliveryEvidence_verificationStatus_idx" ON "DeliveryEvidence"("verificationStatus");

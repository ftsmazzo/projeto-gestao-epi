-- Referencias antigas so com foto: exigir recadastro biometrico
-- (enum NEEDS_REENROLLMENT ja commitado na migration anterior)
UPDATE "WorkerFacialReference"
SET "status" = 'NEEDS_REENROLLMENT'
WHERE "status" = 'ACTIVE'
  AND "faceDescriptor" IS NULL;

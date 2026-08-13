-- AlterTable
ALTER TABLE "EpiNeed" ADD COLUMN "usefulLifeValue" INTEGER;
ALTER TABLE "EpiNeed" ADD COLUMN "usefulLifeUnit" "EpiUsefulLifeUnit";

-- Backfill known suggestion names (CAEPI does not provide product useful life).
UPDATE "EpiNeed" SET "usefulLifeValue" = 1, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'protetor auricular plug';
UPDATE "EpiNeed" SET "usefulLifeValue" = 6, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'protetor auricular concha';
UPDATE "EpiNeed" SET "usefulLifeValue" = 3, "usefulLifeUnit" = 'DIAS' WHERE lower("name") = 'respirador pff1';
UPDATE "EpiNeed" SET "usefulLifeValue" = 3, "usefulLifeUnit" = 'DIAS' WHERE lower("name") = 'respirador pff2';
UPDATE "EpiNeed" SET "usefulLifeValue" = 3, "usefulLifeUnit" = 'ANOS' WHERE lower("name") = 'respirador facial inteira';
UPDATE "EpiNeed" SET "usefulLifeValue" = 1, "usefulLifeUnit" = 'ANOS' WHERE lower("name") = 'respirador de fuga';
UPDATE "EpiNeed" SET "usefulLifeValue" = 1, "usefulLifeUnit" = 'ANOS' WHERE lower("name") = 'mascara de solda';
UPDATE "EpiNeed" SET "usefulLifeValue" = 6, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'oculos de seguranca';
UPDATE "EpiNeed" SET "usefulLifeValue" = 1, "usefulLifeUnit" = 'ANOS' WHERE lower("name") = 'oculos de ampla visao';
UPDATE "EpiNeed" SET "usefulLifeValue" = 1, "usefulLifeUnit" = 'ANOS' WHERE lower("name") = 'viseira facial';
UPDATE "EpiNeed" SET "usefulLifeValue" = 3, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'luva de vaqueta';
UPDATE "EpiNeed" SET "usefulLifeValue" = 15, "usefulLifeUnit" = 'DIAS' WHERE lower("name") = 'luva de raspa';
UPDATE "EpiNeed" SET "usefulLifeValue" = 7, "usefulLifeUnit" = 'DIAS' WHERE lower("name") = 'luva de pvc';
UPDATE "EpiNeed" SET "usefulLifeValue" = 2, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'luva nitrilica';
UPDATE "EpiNeed" SET "usefulLifeValue" = 4, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'luva anticorte';
UPDATE "EpiNeed" SET "usefulLifeValue" = 1, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'luva de malha pigmentada';
UPDATE "EpiNeed" SET "usefulLifeValue" = 1, "usefulLifeUnit" = 'ANOS' WHERE lower("name") = 'luva isolante';
UPDATE "EpiNeed" SET "usefulLifeValue" = 6, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'botina de seguranca';
UPDATE "EpiNeed" SET "usefulLifeValue" = 6, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'bota de borracha';
UPDATE "EpiNeed" SET "usefulLifeValue" = 2, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'perneira de raspa';
UPDATE "EpiNeed" SET "usefulLifeValue" = 5, "usefulLifeUnit" = 'ANOS' WHERE lower("name") = 'capacete de seguranca';
UPDATE "EpiNeed" SET "usefulLifeValue" = 5, "usefulLifeUnit" = 'ANOS' WHERE lower("name") = 'cinto de seguranca';
UPDATE "EpiNeed" SET "usefulLifeValue" = 1, "usefulLifeUnit" = 'ANOS' WHERE lower("name") = 'cinturao para vigilante';
UPDATE "EpiNeed" SET "usefulLifeValue" = 5, "usefulLifeUnit" = 'ANOS' WHERE lower("name") = 'trava-quedas';
UPDATE "EpiNeed" SET "usefulLifeValue" = 5, "usefulLifeUnit" = 'ANOS' WHERE lower("name") = 'talabarte';
UPDATE "EpiNeed" SET "usefulLifeValue" = 6, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'cinta lombar';
UPDATE "EpiNeed" SET "usefulLifeValue" = 2, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'avental de raspa';
UPDATE "EpiNeed" SET "usefulLifeValue" = 30, "usefulLifeUnit" = 'DIAS' WHERE lower("name") = 'avental de pvc';
UPDATE "EpiNeed" SET "usefulLifeValue" = 6, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'avental trevira';
UPDATE "EpiNeed" SET "usefulLifeValue" = 3, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'manga de raspa';
UPDATE "EpiNeed" SET "usefulLifeValue" = 1, "usefulLifeUnit" = 'ANOS' WHERE lower("name") = 'manga anticorte';
UPDATE "EpiNeed" SET "usefulLifeValue" = 3, "usefulLifeUnit" = 'MESES' WHERE lower("name") = 'capa de chuva';
UPDATE "EpiNeed" SET "usefulLifeValue" = 30, "usefulLifeUnit" = 'DIAS' WHERE lower("name") = 'creme protetor';

import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function resolveCorsOrigin(): boolean | string | string[] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw || raw === '*') {
    return true;
  }

  const origins = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return true;
  }

  return origins.length === 1 ? origins[0] : origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  // PGR grande (dezenas de GHE) ultrapassa o default Express de 100kb no confirm.
  const express = await import('express');
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.enableCors({
    origin: resolveCorsOrigin(),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = Number(process.env.API_PORT ?? 3001);
  const host = process.env.API_HOST ?? '0.0.0.0';

  await app.listen(port, host);
  console.log(`API listening on http://${host}:${port}`);
  try {
    const { getWorkerFaceReferenceRoot } = await import(
      './workers/worker-face-reference.storage'
    );
    const { getDeliveryEvidenceRoot } = await import(
      './portal/facial-evidence.storage'
    );
    console.log(
      `[biometric-storage] references=${getWorkerFaceReferenceRoot()} evidence=${getDeliveryEvidenceRoot()}`,
    );
  } catch (err) {
    console.warn('[biometric-storage] falha ao resolver raizes', err);
  }
}

void bootstrap();

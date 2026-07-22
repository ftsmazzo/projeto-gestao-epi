# syntax=docker/dockerfile:1

# Build context: raiz do monorepo
# EasyPanel / local:
#   docker build -f apps/api/Dockerfile -t gestao-epi-api .
#
# Nota: usamos `npm ci --ignore-scripts` para nao disparar o postinstall
# da raiz (build do @gestao-epi/shared) antes do source estar copiado.
# O shared e o Prisma Client sao gerados explicitamente no stage de build.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
RUN npm ci --ignore-scripts

FROM deps AS build
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @gestao-epi/shared \
  && npm run build -w @gestao-epi/api

FROM base AS runner
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=3001

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/package.json apps/api/package.json
# Prisma Client gerado no build (postinstall/scripts foram ignorados no npm ci)
COPY --from=build /app/node_modules/.prisma node_modules/.prisma
COPY --from=build /app/node_modules/@prisma node_modules/@prisma

WORKDIR /app/apps/api
EXPOSE 3001

# Healthcheck EasyPanel/Docker: GET /health
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]

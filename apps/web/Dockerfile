# syntax=docker/dockerfile:1

# Build context: raiz do monorepo
# EasyPanel / local:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.exemplo.com -t gestao-epi-web .
#
# Nota: usamos `npm ci --ignore-scripts` para nao disparar o postinstall
# da raiz (build do @gestao-epi/shared) antes do source estar copiado.
# O shared e buildado explicitamente no stage de build.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/
RUN npm ci --ignore-scripts

FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY packages/config packages/config
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @gestao-epi/shared \
  && npm run build -w @gestao-epi/web

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static

WORKDIR /app
EXPOSE 3000

CMD ["node", "apps/web/server.js"]

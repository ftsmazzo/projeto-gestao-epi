# syntax=docker/dockerfile:1
# Build context: raiz do monorepo
# docker build -f apps/mcp-inseg/Dockerfile -t gestao-epi-mcp-inseg .

FROM node:22-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY apps/mcp-inseg/package.json apps/mcp-inseg/
RUN cd apps/mcp-inseg && npm install

FROM deps AS build
COPY apps/mcp-inseg apps/mcp-inseg
RUN cd apps/mcp-inseg && npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV MCP_PORT=3100
WORKDIR /app/apps/mcp-inseg
COPY --from=deps /app/apps/mcp-inseg/node_modules node_modules
COPY --from=build /app/apps/mcp-inseg/dist dist
COPY apps/mcp-inseg/package.json package.json
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.MCP_PORT||3100)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]

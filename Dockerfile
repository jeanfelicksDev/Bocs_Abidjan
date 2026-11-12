# BOCS — image de l'application pour un serveur interne d'entreprise.
# Compilation : seule étape qui a besoin d'Internet (paquets npm, moteur Prisma,
# langue OCR si non fournie). L'image obtenue fonctionne ensuite sans aucun accès externe.

FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:local

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    DB_DRIVER=pg \
    PORT=3000 \
    HOST=0.0.0.0
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json /app/prisma7.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/scripts/create-admin.mjs ./scripts/create-admin.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist-server/index.mjs"]

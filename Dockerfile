# ============================================================
# Base
# ============================================================
FROM node:22-alpine AS base

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .


# ============================================================
# Builder
# ============================================================
FROM base AS builder

RUN npm run build


# ============================================================
# Production Runtime
# ============================================================
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/views ./dist/src/views
COPY --from=builder /app/src/mail/assets ./dist/mail/assets
COPY --from=builder /app/src/mail/assets ./dist/src/mail/assets

EXPOSE 3333

CMD ["node", "dist/src/main.js"]


# ============================================================
# Maintenance
# Used for migrations and seeders
# ============================================================
FROM base AS maintenance

ENV NODE_ENV=production

CMD ["sh", "-c", "npm run migration:baseline && npm run migration:run && npm run seed:master"]

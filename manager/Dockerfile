# MAS3D Manager · imagen de producción
# Se compila en GitHub Actions (no en el VPS) y Coolify solo la descarga y ejecuta.

# ---------- 1. Dependencias ----------
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

# ---------- 2. Compilación ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Las variables NEXT_PUBLIC_* quedan incrustadas en el código del navegador al compilar.
# Son públicas por diseño (la seguridad la aplica la base de datos con RLS).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG APP_VERSION=dev
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------- 3. Ejecución (imagen mínima, usuario sin privilegios) ----------
FROM node:22-alpine AS run
WORKDIR /app
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    APP_VERSION=$APP_VERSION \
    NODE_OPTIONS=--max-old-space-size=256
RUN addgroup -S -g 1001 mas3d && adduser -S -u 1001 -G mas3d mas3d
COPY --from=build --chown=mas3d:mas3d /app/.next/standalone ./
COPY --from=build --chown=mas3d:mas3d /app/.next/static ./.next/static
COPY --from=build --chown=mas3d:mas3d /app/public ./public
USER mas3d
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/salud >/dev/null || exit 1
CMD ["node", "server.js"]

#!/usr/bin/env bash
# MAS3D Manager · Respaldo de TODOS los datos (complementa los respaldos de Supabase)
#
# Uso:  DATABASE_URL="postgresql://postgres.xxxx:CLAVE@aws-0-....pooler.supabase.com:5432/postgres" ./scripts/respaldo.sh
# (Supabase → Project Settings → Database → Connection string → "Session pooler")
#
# Genera en respaldos/:
#   mas3d-AAAA-MM-DD_HHMM-datos.sql.gz      clientes, pedidos, contabilidad… (esquema public)
#   mas3d-AAAA-MM-DD_HHMM-usuarios.sql.gz   cuentas de acceso (auth.users, identidades, 2FA)
#   mas3d-AAAA-MM-DD_HHMM-huella.txt        totales de control para verificar una restauración
# La estructura (tablas, funciones, permisos) vive en supabase/migrations y no necesita respaldo.
set -euo pipefail
: "${DATABASE_URL:?Define DATABASE_URL con la cadena de conexión de Supabase}"
DESTINO="${DESTINO:-respaldos}"
mkdir -p "$DESTINO"
BASE="$DESTINO/mas3d-$(date -u +%Y-%m-%d_%H%M)"
# Las advertencias de "circular foreign-key" son normales: la restauración desactiva esas validaciones.
pg_dump "$DATABASE_URL" --data-only --no-owner --no-privileges --schema=public 2> >(grep -v -i "circular\|detail:\|hint:" >&2) | gzip -9 > "$BASE-datos.sql.gz"
pg_dump "$DATABASE_URL" --data-only --no-owner --no-privileges \
  --table=auth.users --table=auth.identities --table=auth.mfa_factors | gzip -9 > "$BASE-usuarios.sql.gz"
psql "$DATABASE_URL" -At -f "$(dirname "$0")/huella.sql" > "$BASE-huella.txt"
echo "$BASE"

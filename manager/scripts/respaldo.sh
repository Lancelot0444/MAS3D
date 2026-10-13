#!/usr/bin/env bash
# MAS3D Manager · Respaldo de TODOS los datos (complementa los respaldos automáticos de Supabase)
#
# Uso:  DATABASE_URL="postgresql://postgres.xxxx:CLAVE@aws-0-....pooler.supabase.com:5432/postgres" ./scripts/respaldo.sh
# (Supabase → Project Settings → Database → Connection string → "Session pooler")
#
# Genera:
#   respaldos/mas3d-AAAA-MM-DD_HHMM.sql.gz   datos de la app + usuarios
#   respaldos/mas3d-AAAA-MM-DD_HHMM.huella.txt  totales de control para verificar una restauración
# La estructura (tablas, funciones, permisos) vive en supabase/migrations y no necesita respaldo.
set -euo pipefail
: "${DATABASE_URL:?Define DATABASE_URL con la cadena de conexión de Supabase}"
DESTINO="${DESTINO:-respaldos}"
mkdir -p "$DESTINO"
NOMBRE="$DESTINO/mas3d-$(date +%Y-%m-%d_%H%M)"
{
  pg_dump "$DATABASE_URL" --data-only --no-owner --no-privileges --schema=public
  pg_dump "$DATABASE_URL" --data-only --no-owner --no-privileges --table=auth.users --table=auth.identities --table=auth.mfa_factors
} | gzip -9 > "$NOMBRE.sql.gz"
psql "$DATABASE_URL" -At -f "$(dirname "$0")/huella.sql" > "$NOMBRE.huella.txt"
echo "Respaldo listo: $NOMBRE.sql.gz"
echo "Totales de control: $NOMBRE.huella.txt"
echo "Contiene datos financieros y personales: guárdalo cifrado o en un Drive privado de la empresa."

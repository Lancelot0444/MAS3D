#!/usr/bin/env bash
# MAS3D Manager · Restaurar un respaldo
#
# Procedimiento ante un desastre:
#  1. Crear un proyecto NUEVO en Supabase (no restaurar encima del que tiene problemas).
#  2. Aplicar las migraciones:  supabase link --project-ref <ref> && supabase db push
#  3. Ejecutar:  DATABASE_URL="postgresql://...proyecto-nuevo..." ./scripts/restaurar.sh respaldos/mas3d-....sql.gz
#  4. Comparar la huella que se imprime con el archivo .huella.txt del respaldo.
#  5. Cambiar en Vercel las variables de Supabase al proyecto nuevo.
set -euo pipefail
: "${DATABASE_URL:?Define DATABASE_URL de la base destino}"
ARCHIVO="${1:?Indica el archivo .sql.gz}"
USUARIOS=$(psql "$DATABASE_URL" -At -c "select count(*) from auth.users")
if [ "$USUARIOS" != "0" ]; then
  echo "La base destino ya tiene usuarios. Por seguridad solo se restaura en un proyecto nuevo y vacío." >&2
  exit 1
fi
# Las migraciones crean datos iniciales (configuración, plan de cuentas, categorías):
# se reemplazan por los del respaldo. Los disparadores se desactivan durante la carga
# para conservar códigos, fechas y la auditoría originales.
{
  echo "set session_replication_role = replica;"
  echo "do \$\$ declare t text; begin for t in select tablename from pg_tables where schemaname = 'public' loop execute format('truncate table public.%I cascade', t); end loop; end \$\$;"
  gunzip -c "$ARCHIVO"
} | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -q
echo "Restaurado. Totales de control:"
psql "$DATABASE_URL" -At -f "$(dirname "$0")/huella.sql"

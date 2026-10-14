#!/usr/bin/env bash
# MAS3D Manager · Restaurar un respaldo
#
# Procedimiento ante un desastre:
#  1. Crear un proyecto NUEVO en Supabase (no restaurar encima del que tiene problemas).
#  2. Aplicar las migraciones:  supabase link --project-ref <ref> && supabase db push
#  3. Ejecutar:  DATABASE_URL="postgresql://...proyecto-nuevo..." ./scripts/restaurar.sh respaldos/mas3d-AAAA-MM-DD_HHMM
#     (el prefijo común de los archivos -datos.sql.gz y -usuarios.sql.gz)
#  4. Comparar la huella que se imprime con el archivo -huella.txt del respaldo.
#  5. Cambiar en Coolify las variables de Supabase al proyecto nuevo y volver a desplegar.
#
# Variable opcional SOLO_DATOS=1: restaura únicamente los datos del negocio (se usa en la verificación automática).
set -euo pipefail
: "${DATABASE_URL:?Define DATABASE_URL de la base destino}"
BASE="${1:?Indica el prefijo del respaldo, ej. respaldos/mas3d-2026-11-01_0815}"
BASE="${BASE%-datos.sql.gz}"
[ -f "$BASE-datos.sql.gz" ] || { echo "No existe $BASE-datos.sql.gz" >&2; exit 1; }
if [ "${SOLO_DATOS:-0}" != "1" ]; then
  USUARIOS=$(psql "$DATABASE_URL" -At -c "select count(*) from auth.users")
  if [ "$USUARIOS" != "0" ]; then
    echo "La base destino ya tiene usuarios. Por seguridad solo se restaura en un proyecto nuevo y vacío." >&2
    exit 1
  fi
fi
# Las migraciones crean datos iniciales (configuración, plan de cuentas, categorías): se reemplazan
# por los del respaldo. Los disparadores se desactivan durante la carga para conservar códigos,
# fechas y auditoría originales; las validaciones ya se cumplieron cuando se registraron los datos.
{
  echo "set client_min_messages = warning;"
  echo "set session_replication_role = replica;"
  echo "do \$\$ declare t text; begin for t in select tablename from pg_tables where schemaname = 'public' loop execute format('truncate table public.%I cascade', t); end loop; end \$\$;"
  [ "${SOLO_DATOS:-0}" = "1" ] || gunzip -c "$BASE-usuarios.sql.gz"
  gunzip -c "$BASE-datos.sql.gz"
} | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -q -o /dev/null
psql "$DATABASE_URL" -At -f "$(dirname "$0")/huella.sql"

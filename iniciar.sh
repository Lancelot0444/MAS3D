#!/usr/bin/env bash
# MAS3D — Iniciar la app en tu computadora (Mac / Linux)
set -e
cd "$(dirname "$0")"
command -v php >/dev/null || { echo "Falta PHP. Instálalo (Mac: brew install php)."; exit 1; }
[ -f config.php ] || cp config.local.sample.php config.php
mkdir -p data
PORT="${PORT:-8000}"
echo "MAS3D en http://localhost:$PORT  (Ctrl+C para cerrar)"
[ -f data/mas3d.sqlite ] || echo "Primera vez: abre http://localhost:$PORT/install.php para crear los usuarios."
( sleep 1; (command -v open >/dev/null && open "http://localhost:$PORT") || (command -v xdg-open >/dev/null && xdg-open "http://localhost:$PORT") || true ) &
exec php -S "localhost:$PORT" router.php

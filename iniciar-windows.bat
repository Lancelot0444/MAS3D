@echo off
REM MAS3D - Iniciar la app en tu PC con Windows
cd /d "%~dp0"
chcp 65001 >nul

where php >nul 2>nul
if errorlevel 1 (
  echo Falta PHP. Ejecuta primero instalar-pc.ps1 ^(clic derecho - Ejecutar con PowerShell^).
  pause
  exit /b 1
)

if not exist config.php copy config.local.sample.php config.php >nul
if not exist data mkdir data

echo.
echo   MAS3D funcionando en http://localhost:8000
echo   No cierres esta ventana mientras uses la app.
if not exist data\mas3d.sqlite echo   Primera vez: se abrira install.php para crear los usuarios.
echo.

if not exist data\mas3d.sqlite (start "" http://localhost:8000/install.php) else (start "" http://localhost:8000)
php -S localhost:8000 router.php

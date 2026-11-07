# MAS3D — guía para Claude

MAS3D es una empresa de impresión 3D (Brian y Mayra). Este repo es su app web de
pedidos, cotizaciones y contabilidad. Responde siempre en **español**.

## Stack
- PHP 8.1+ sin frameworks ni Composer. PDO con **MySQL** (Hostinger) o **SQLite** (PC local).
- `app/bootstrap.php` (config, sesión, `db()`, `q()`, catálogos), `app/schema.php` (tablas),
  `app/layout.php` (HTML común), `app/calendar.php` (Google Calendar vía Apps Script).
- Páginas en la raíz: `index.php`, `pedidos.php`, `pedido.php`, `ingresos.php`, `gastos.php`,
  `reportes.php`, `calculadora.php` (+ `calculator.js`), `cuenta.php`, `login.php`, `install.php`.
- `apps-script/Code.gs`: se pega en script.google.com (no corre en el servidor).

## Correr en local
- Windows: `iniciar-windows.bat` · Mac/Linux: `./iniciar.sh`
- O manual: `cp config.local.sample.php config.php && mkdir -p data && php -S localhost:8000 router.php`
- Primera vez: abrir `/install.php` para crear usuarios. La base queda en `data/mas3d.sqlite`.
- `router.php` reemplaza a `.htaccess` en el servidor de PHP: si agregas carpetas internas, bloquéalas en los dos.

## Reglas
- Todo SQL debe funcionar en MySQL **y** SQLite; usa `q()` con parámetros, nunca concatenes datos.
- Escapa la salida con `e()`; formularios POST con `csrf_field()` / `csrf_check()`.
- Nunca subas `config.php` ni `data/` (están en `.gitignore`).
- Moneda por defecto `$` (USD), zona horaria `America/Guayaquil`.

## Skills instaladas (`.claude/skills/`, de github.com/anthropics/skills, Apache-2.0)
`pdf`, `xlsx`, `docx`, `pptx` (cotizaciones, reportes, catálogos), `frontend-design`,
`webapp-testing` (probar la app con Playwright), `canvas-design`, `theme-factory`, `skill-creator`.
Dependencias: `.claude/requirements-skills.txt` (Windows: `instalar-pc.ps1` las instala todas).

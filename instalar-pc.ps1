# MAS3D - Preparar una PC con Windows 10/11
# Instala: PHP (para la app), Git, Python, Node.js, LibreOffice, Pandoc,
# Claude Code, REA y las dependencias de las skills de .claude/skills.
# Uso: clic derecho -> "Ejecutar con PowerShell" (o en PowerShell: .\instalar-pc.ps1)
$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot

function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' +
                [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Install-Winget($id, $name) {
    Write-Host "`n==> $name" -ForegroundColor Cyan
    winget install --id $id -e --accept-source-agreements --accept-package-agreements --silent
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Host 'Falta winget. Instala "App Installer" desde Microsoft Store y vuelve a ejecutar.' -ForegroundColor Red
    pause; exit 1
}

Install-Winget 'PHP.PHP.8.3'                     'PHP 8.3 (app MAS3D)'
Install-Winget 'Git.Git'                         'Git'
Install-Winget 'Python.Python.3.12'              'Python 3.12 (skills)'
Install-Winget 'OpenJS.NodeJS.LTS'               'Node.js LTS (skills docx/pptx)'
Install-Winget 'TheDocumentFoundation.LibreOffice' 'LibreOffice (recalcular Excel, convertir a PDF)'
Install-Winget 'JohnMacFarlane.Pandoc'           'Pandoc (Word)'
Install-Winget 'QPDF.QPDF'                       'QPDF (PDF)'
Refresh-Path

# --- PHP: activar las extensiones que usa la app (SQLite, MySQL, mbstring) ---
$php = Get-Command php -ErrorAction SilentlyContinue
if ($php) {
    $phpDir = Split-Path $php.Source
    $ini = Join-Path $phpDir 'php.ini'
    if (-not (Test-Path $ini)) {
        $tpl = Join-Path $phpDir 'php.ini-development'
        if (Test-Path $tpl) { Copy-Item $tpl $ini }
    }
    if (Test-Path $ini) {
        $c = Get-Content $ini
        $c = $c -replace '^;\s*extension_dir\s*=\s*"ext"', 'extension_dir = "ext"'
        foreach ($ext in 'pdo_sqlite','sqlite3','pdo_mysql','mbstring','openssl','curl','fileinfo','intl') {
            $c = $c -replace "^;\s*extension=$ext\s*$", "extension=$ext"
        }
        try { Set-Content $ini $c -ErrorAction Stop; Write-Host "php.ini listo: $ini" -ForegroundColor Green }
        catch { Write-Host "No pude escribir $ini. Ejecuta PowerShell como administrador." -ForegroundColor Yellow }
    }
    php -m | Select-String -Pattern 'pdo_sqlite|mbstring'
} else {
    Write-Host 'PHP no quedo en el PATH. Cierra y abre PowerShell y ejecuta este script otra vez.' -ForegroundColor Yellow
}

# --- Claude Code (instalador oficial) ---
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Host "`n==> Claude Code" -ForegroundColor Cyan
    Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression
}

# --- Dependencias de las skills ---
Refresh-Path
if (Get-Command python -ErrorAction SilentlyContinue) {
    Write-Host "`n==> Paquetes de Python para las skills" -ForegroundColor Cyan
    python -m pip install --upgrade pip
    python -m pip install -r .claude\requirements-skills.txt
    python -m playwright install chromium
}
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Host "`n==> Paquetes de Node para las skills" -ForegroundColor Cyan
    npm install -g docx pptxgenjs

    # --- REA: Reverse Engineer Anything (github.com/morluto/rea) ---
    # La skill ya esta en .claude/skills/reverse-engineer-anything; aqui se instala
    # el programa "rea" y se registra su servidor MCP en Claude Code.
    Write-Host "`n==> REA (Reverse Engineer Anything)" -ForegroundColor Cyan
    npm install --global rea-agents
    Refresh-Path
    if (Get-Command rea -ErrorAction SilentlyContinue) {
        rea setup --client claude_code --skill=false --yes
        rea doctor --client claude_code
    }
}

Write-Host "`nListo. Para abrir la app: doble clic en iniciar-windows.bat" -ForegroundColor Green
Write-Host 'Para usar Claude Code: abre PowerShell en esta carpeta y escribe: claude' -ForegroundColor Green
pause

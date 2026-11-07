<?php
/*
 * MAS3D — Router para el servidor local de PHP (php -S).
 * El servidor de PHP no lee .htaccess, así que aquí se bloquean
 * las carpetas y archivos internos. En Hostinger este archivo no se usa.
 */
if (PHP_SAPI !== 'cli-server') {
    http_response_code(404);
    exit;
}

$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');

if (preg_match('#^/(app|apps-script|data|\.claude|\.git)(/|$)#', $path)
    || preg_match('#(^|/)(config(\.local)?(\.sample)?\.php|router\.php|[^/]*\.(md|sqlite|sql|bat|sh|ps1|txt)|\.[^/]+)$#', $path)) {
    http_response_code(403);
    echo 'Acceso denegado';
    return true;
}

if (str_ends_with($path, '.webmanifest')) {
    header('Content-Type: application/manifest+json');
    readfile(__DIR__ . $path);
    return true;
}

return false; // deja que PHP sirva el archivo o el .php pedido

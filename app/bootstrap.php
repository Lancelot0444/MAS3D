<?php
declare(strict_types=1);

define('APP_ROOT', dirname(__DIR__));

$configFile = APP_ROOT . '/config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    echo '<!doctype html><meta charset="utf-8"><title>MAS3D</title>'
       . '<p style="font-family:sans-serif;padding:24px">Falta el archivo <b>config.php</b>. '
       . 'Copia <b>config.sample.php</b> como <b>config.php</b> y llena los datos de tu base de datos.</p>';
    exit;
}
$CONFIG = require $configFile;

date_default_timezone_set($CONFIG['timezone'] ?? 'America/Guayaquil');

/* ===== Catálogos ===== */
const ORDER_STATUSES = [
    'cotizado'      => 'Cotizado',
    'confirmado'    => 'Confirmado',
    'imprimiendo'   => 'Imprimiendo',
    'postprocesado' => 'Post-procesado',
    'listo'         => 'Listo para entregar',
    'entregado'     => 'Entregado',
    'cancelado'     => 'Cancelado',
];
const ACTIVE_STATUSES = ['cotizado', 'confirmado', 'imprimiendo', 'postprocesado', 'listo'];

const CHANNELS = ['WhatsApp', 'Instagram', 'TikTok', 'Facebook', 'Tienda física', 'Referido', 'Otro'];
const PAY_METHODS = ['Efectivo', 'Transferencia', 'Deuna', 'Tarjeta', 'PayPal', 'Otro'];
const DELIVERY_METHODS = ['Retira en local', 'Entrega personal', 'Envío / courier'];
const MATERIALS = ['PLA Normal', 'PLA Silk', 'PLA Especial', 'TPU / Flexible', 'Técnico (Nylon/FC/ASA)', 'ABS', 'PETG', 'Resina', 'Otro'];
const EXPENSE_CATEGORIES = [
    'Filamento', 'Electricidad', 'Repuestos y mantenimiento', 'Pintura e insumos',
    'Envíos', 'Publicidad', 'Herramientas', 'Impresoras (inversión)', 'Internet / software', 'Otros',
];
const INCOME_CATEGORIES = ['Pago de pedido', 'Anticipo', 'Otro ingreso'];

/* ===== Sesión ===== */
$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
      || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_name('mas3d_sid');
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => $https,
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

header('X-Frame-Options: SAMEORIGIN');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

/* ===== Base de datos ===== */
function db(): PDO
{
    static $pdo = null;
    global $CONFIG;
    if ($pdo) return $pdo;
    $c = $CONFIG['db'];
    $opts = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    if (($c['driver'] ?? 'mysql') === 'sqlite') {
        $pdo = new PDO('sqlite:' . $c['path'], null, null, $opts);
        $pdo->exec('PRAGMA foreign_keys = ON');
    } else {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $c['host'], $c['name']);
        $pdo = new PDO($dsn, $c['user'], $c['password'], $opts);
    }
    return $pdo;
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function now(): string { return date('Y-m-d H:i:s'); }
function today(): string { return date('Y-m-d'); }

/* ===== Utilidades ===== */
function e($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

function money($n): string
{
    global $CONFIG;
    $n = (float)$n;
    return ($n < 0 ? '-' : '') . ($CONFIG['currency'] ?? '$') . number_format(abs($n), 2, '.', ',');
}

function post(string $key, string $default = ''): string
{
    $v = $_POST[$key] ?? $default;
    return is_string($v) ? trim($v) : $default;
}

function num($v): float
{
    $v = str_replace([' ', '$'], '', (string)$v);
    if (str_contains($v, ',') && !str_contains($v, '.')) $v = str_replace(',', '.', $v);
    $v = str_replace(',', '', $v);
    return is_numeric($v) ? round((float)$v, 2) : 0.0;
}

function valid_date(string $s): bool
{
    $d = DateTime::createFromFormat('Y-m-d', $s);
    return $d && $d->format('Y-m-d') === $s;
}

function valid_time(string $s): bool
{
    return (bool)preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $s);
}

function pick(string $value, array $allowed, string $fallback): string
{
    return in_array($value, $allowed, true) ? $value : $fallback;
}

function fmt_date(?string $d): string
{
    if (!$d) return '—';
    $ts = strtotime($d);
    if (!$ts) return e($d);
    $dias  = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    $meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return $dias[(int)date('w', $ts)] . ' ' . date('j', $ts) . ' ' . $meses[(int)date('n', $ts) - 1] . ' ' . date('Y', $ts);
}

function month_name(int $m): string
{
    return ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
            'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][$m - 1] ?? '';
}

function redirect(string $url): never
{
    header('Location: ' . $url);
    exit;
}

/* ===== Mensajes flash ===== */
function flash(string $msg, string $type = 'ok'): void { $_SESSION['flash'][] = [$type, $msg]; }
function take_flashes(): array { $f = $_SESSION['flash'] ?? []; unset($_SESSION['flash']); return $f; }

/* ===== CSRF ===== */
function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
function csrf_field(): string { return '<input type="hidden" name="csrf" value="' . csrf_token() . '">'; }
function csrf_check(): void
{
    if (!hash_equals($_SESSION['csrf'] ?? '', (string)($_POST['csrf'] ?? ''))) {
        http_response_code(400);
        exit('La sesión expiró. Vuelve atrás y recarga la página.');
    }
}

/* ===== Autenticación ===== */
function current_user(): ?array
{
    static $user = false;
    if ($user !== false) return $user;
    $id = $_SESSION['uid'] ?? null;
    $user = $id ? (q('SELECT id, username, name FROM users WHERE id = ?', [$id])->fetch() ?: null) : null;
    return $user;
}

function require_login(): array
{
    $u = current_user();
    if (!$u) {
        $back = $_SERVER['REQUEST_URI'] ?? 'index.php';
        redirect('login.php?next=' . urlencode($back));
    }
    // Cierre de sesión por inactividad (12 horas)
    if (isset($_SESSION['last']) && time() - $_SESSION['last'] > 43200) {
        session_unset();
        redirect('login.php');
    }
    $_SESSION['last'] = time();
    return $u;
}

function client_ip(): string { return substr($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0', 0, 45); }

function too_many_attempts(): bool
{
    $since = date('Y-m-d H:i:s', time() - 900);
    $n = (int)q('SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND attempted_at > ?', [client_ip(), $since])->fetchColumn();
    return $n >= 8;
}

function attempt_login(string $username, string $password): bool
{
    q('INSERT INTO login_attempts (ip, username, attempted_at) VALUES (?, ?, ?)', [client_ip(), substr($username, 0, 50), now()]);
    $u = q('SELECT * FROM users WHERE username = ?', [mb_strtolower($username)])->fetch();
    if (!$u || !password_verify($password, $u['password_hash'])) return false;
    if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
        q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $u['id']]);
    }
    q('DELETE FROM login_attempts WHERE ip = ?', [client_ip()]);
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$u['id'];
    $_SESSION['last'] = time();
    return true;
}

/* ===== Pedidos ===== */
function order_with_balance(int $id): ?array
{
    $o = q('SELECT o.*, COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id), 0) AS paid
            FROM orders o WHERE o.id = ?', [$id])->fetch();
    if (!$o) return null;
    $o['balance'] = round((float)$o['price_total'] - (float)$o['paid'], 2);
    return $o;
}

function status_badge(string $status): string
{
    return '<span class="badge st-' . e($status) . '">' . e(ORDER_STATUSES[$status] ?? $status) . '</span>';
}

function days_until(string $date): int
{
    return (int)floor((strtotime($date) - strtotime(today())) / 86400);
}

function due_label(string $date): string
{
    $d = days_until($date);
    if ($d < 0)  return '<span class="due late">Atrasado ' . (-$d) . ' d</span>';
    if ($d === 0) return '<span class="due today">Hoy</span>';
    if ($d === 1) return '<span class="due soon">Mañana</span>';
    if ($d <= 3) return '<span class="due soon">En ' . $d . ' días</span>';
    return '<span class="due">En ' . $d . ' días</span>';
}

function options(array $items, string $selected, bool $assoc = false): string
{
    $html = '';
    foreach ($items as $k => $label) {
        $value = $assoc ? (string)$k : (string)$label;
        $html .= '<option value="' . e($value) . '"' . ($value === $selected ? ' selected' : '') . '>' . e($label) . '</option>';
    }
    return $html;
}

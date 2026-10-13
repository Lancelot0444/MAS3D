<?php
declare(strict_types=1);

/*
 * Sincroniza los pedidos con Google Calendar a través de un Google Apps Script
 * publicado como aplicación web (ver apps-script/Code.gs e INSTALACION.md).
 */

function calendar_enabled(): bool
{
    global $CONFIG;
    $g = $CONFIG['google_calendar'] ?? [];
    return !empty($g['script_url']) && !empty($g['secret']);
}

function calendar_call(array $payload): array
{
    global $CONFIG;
    $g = $CONFIG['google_calendar'];
    $payload['secret'] = $g['secret'];
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE);

    if (function_exists('curl_init')) {
        $ch = curl_init($g['script_url']);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $body,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,   // Apps Script responde con una redirección
            CURLOPT_TIMEOUT        => 20,
        ]);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);
        if ($raw === false) return ['ok' => false, 'error' => 'Sin conexión con Google: ' . $err];
    } else {
        $ctx = stream_context_create(['http' => [
            'method' => 'POST', 'header' => "Content-Type: application/json\r\n",
            'content' => $body, 'timeout' => 20, 'follow_location' => 1,
        ]]);
        $raw = @file_get_contents($g['script_url'], false, $ctx);
        if ($raw === false) return ['ok' => false, 'error' => 'Sin conexión con Google'];
    }

    $res = json_decode((string)$raw, true);
    if (!is_array($res)) return ['ok' => false, 'error' => 'Respuesta inesperada de Google Apps Script (revisa que esté publicado con acceso "Cualquier usuario")'];
    return $res;
}

function calendar_event_payload(array $o): array
{
    global $CONFIG;
    $g = $CONFIG['google_calendar'];
    $time = $o['delivery_time'] ?: ($g['event_hour'] ?? '10:00');
    $start = $o['delivery_date'] . 'T' . $time . ':00';
    $end = date('Y-m-d\TH:i:s', strtotime($start) + 60 * (int)($g['duration_minutes'] ?? 60));

    $prefix = $o['status'] === 'entregado' ? '✅ ' : '📦 ';
    $title = $prefix . 'Entrega #' . $o['id'] . ' · ' . $o['client_name'] . ' · ' . mb_strimwidth($o['description'], 0, 50, '…');

    $lines = [
        'Cliente: ' . $o['client_name'] . ($o['client_phone'] ? ' · ' . $o['client_phone'] : ''),
        'Pedido: ' . $o['description'],
        'Cantidad: ' . $o['quantity'] . ($o['material'] ? ' · ' . $o['material'] : '') . ($o['color'] ? ' · ' . $o['color'] : ''),
        'Estado: ' . (ORDER_STATUSES[$o['status']] ?? $o['status']),
        'Total: ' . money($o['price_total']) . ' · Saldo por cobrar: ' . money($o['balance']),
        'Entrega: ' . $o['delivery_method'] . ($o['address'] ? ' · ' . $o['address'] : ''),
    ];
    if ($o['notes']) $lines[] = 'Notas: ' . $o['notes'];
    if (!empty($CONFIG['base_url'])) {
        $lines[] = '';
        $lines[] = 'Ver en la app: ' . rtrim($CONFIG['base_url'], '/') . '/pedido.php?id=' . $o['id'];
    }

    return [
        'title'       => $title,
        'start'       => $start,
        'end'         => $end,
        'description' => implode("\n", $lines),
        'location'    => $o['address'] ?? '',
    ];
}

/** Crea, actualiza o borra el evento del pedido. Devuelve un mensaje de error o null. */
function calendar_sync_order(int $orderId): ?string
{
    if (!calendar_enabled()) return null;
    $o = order_with_balance($orderId);
    if (!$o) return null;

    $hasEvent = !empty($o['calendar_event_id']);
    $shouldExist = $o['status'] !== 'cancelado' && valid_date((string)$o['delivery_date']);

    if (!$shouldExist) {
        if (!$hasEvent) return null;
        $res = calendar_call(['action' => 'delete', 'eventId' => $o['calendar_event_id']]);
        if (!empty($res['ok'])) {
            q('UPDATE orders SET calendar_event_id = NULL, calendar_error = NULL, calendar_synced_at = ? WHERE id = ?', [now(), $orderId]);
            return null;
        }
    } else {
        $res = calendar_call(['action' => 'upsert', 'eventId' => $o['calendar_event_id'] ?: null] + calendar_event_payload($o));
        if (!empty($res['ok'])) {
            q('UPDATE orders SET calendar_event_id = ?, calendar_error = NULL, calendar_synced_at = ? WHERE id = ?', [$res['eventId'], now(), $orderId]);
            return null;
        }
    }
    $err = mb_substr((string)($res['error'] ?? 'Error desconocido'), 0, 250);
    q('UPDATE orders SET calendar_error = ? WHERE id = ?', [$err, $orderId]);
    return $err;
}

function calendar_delete_event(?string $eventId): void
{
    if ($eventId && calendar_enabled()) calendar_call(['action' => 'delete', 'eventId' => $eventId]);
}

/** Enlace manual "Agregar a Google Calendar" (sirve aunque la sincronización no esté configurada). */
function calendar_template_link(array $o): string
{
    $p = calendar_event_payload($o);
    $fmt = fn($s) => date('Ymd\THis', strtotime($s));
    global $CONFIG;
    return 'https://calendar.google.com/calendar/render?' . http_build_query([
        'action'   => 'TEMPLATE',
        'text'     => $p['title'],
        'dates'    => $fmt($p['start']) . '/' . $fmt($p['end']),
        'details'  => $p['description'],
        'location' => $p['location'],
        'ctz'      => $CONFIG['timezone'] ?? 'America/Guayaquil',
    ]);
}

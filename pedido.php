<?php
declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/layout.php';
require __DIR__ . '/app/calendar.php';
$user = require_login();

$id = (int)($_GET['id'] ?? 0);
$order = $id ? order_with_balance($id) : null;
if ($id && !$order) {
    flash('Ese pedido no existe.', 'err');
    redirect('pedidos.php');
}

function read_order_form(): array
{
    $date = post('delivery_date');
    $time = post('delivery_time');
    return [
        'client_name'     => mb_substr(post('client_name'), 0, 120),
        'client_phone'    => mb_substr(post('client_phone'), 0, 40),
        'channel'         => pick(post('channel'), CHANNELS, ''),
        'description'     => mb_substr(post('description'), 0, 255),
        'quantity'        => max(1, (int)post('quantity', '1')),
        'material'        => mb_substr(post('material'), 0, 60),
        'color'           => mb_substr(post('color'), 0, 60),
        'price_total'     => max(0, num(post('price_total'))),
        'cost_estimate'   => max(0, num(post('cost_estimate'))),
        'order_date'      => valid_date(post('order_date')) ? post('order_date') : today(),
        'delivery_date'   => valid_date($date) ? $date : null,
        'delivery_time'   => valid_time($time) ? $time : '',
        'delivery_method' => pick(post('delivery_method'), DELIVERY_METHODS, ''),
        'address'         => mb_substr(post('address'), 0, 255),
        'status'          => pick(post('status'), array_keys(ORDER_STATUSES), 'confirmado'),
        'notes'           => mb_substr(post('notes'), 0, 5000),
    ];
}

function after_change(int $orderId, string $okMsg): never
{
    $err = calendar_sync_order($orderId);
    flash($okMsg);
    if ($err) flash('No se pudo actualizar Google Calendar: ' . $err, 'warn');
    redirect('pedido.php?id=' . $orderId);
}

/* ===== Acciones ===== */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = post('action');

    if ($action === 'save') {
        $f = read_order_form();
        if ($f['client_name'] === '' || $f['description'] === '') {
            flash('El nombre del cliente y la descripción son obligatorios.', 'err');
            redirect($order ? 'pedido.php?id=' . $id . '&editar=1' : 'pedido.php');
        }
        if ($order) {
            $sets = implode(', ', array_map(fn($k) => "$k = ?", array_keys($f)));
            q("UPDATE orders SET $sets, updated_at = ? WHERE id = ?", [...array_values($f), now(), $id]);
            after_change($id, 'Pedido actualizado.');
        }
        $cols = array_keys($f);
        q('INSERT INTO orders (' . implode(', ', $cols) . ', created_by, created_at, updated_at) VALUES ('
          . implode(', ', array_fill(0, count($cols) + 3, '?')) . ')',
          [...array_values($f), $user['id'], now(), now()]);
        $newId = (int)db()->lastInsertId();
        $deposit = max(0, num(post('deposit')));
        if ($deposit > 0) {
            q('INSERT INTO payments (order_id, pay_date, amount, method, category, concept, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [$newId, today(), $deposit, pick(post('deposit_method'), PAY_METHODS, 'Efectivo'), 'Anticipo', 'Anticipo pedido #' . $newId, $user['id'], now()]);
        }
        after_change($newId, 'Pedido #' . $newId . ' creado.');
    }

    if (!$order) redirect('pedidos.php');

    if ($action === 'status') {
        $st = pick(post('status'), array_keys(ORDER_STATUSES), $order['status']);
        q('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [$st, now(), $id]);
        after_change($id, 'Estado cambiado a “' . ORDER_STATUSES[$st] . '”.');
    }

    if ($action === 'add_payment') {
        $amount = num(post('amount'));
        if ($amount <= 0) {
            flash('Escribe un monto mayor a cero.', 'err');
            redirect('pedido.php?id=' . $id);
        }
        $date = valid_date(post('pay_date')) ? post('pay_date') : today();
        $cat = pick(post('category'), INCOME_CATEGORIES, 'Pago de pedido');
        q('INSERT INTO payments (order_id, pay_date, amount, method, category, concept, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [$id, $date, $amount, pick(post('method'), PAY_METHODS, 'Efectivo'), $cat, mb_substr(post('concept') ?: $cat . ' pedido #' . $id, 0, 255), $user['id'], now()]);
        after_change($id, 'Pago de ' . money($amount) . ' registrado.');
    }

    if ($action === 'delete_payment') {
        q('DELETE FROM payments WHERE id = ? AND order_id = ?', [(int)post('payment_id'), $id]);
        after_change($id, 'Pago eliminado.');
    }

    if ($action === 'sync') {
        $err = calendar_sync_order($id);
        $err ? flash('Google Calendar: ' . $err, 'err') : flash('Sincronizado con Google Calendar.');
        redirect('pedido.php?id=' . $id);
    }

    if ($action === 'delete') {
        calendar_delete_event($order['calendar_event_id']);
        q('DELETE FROM payments WHERE order_id = ?', [$id]);
        q('UPDATE expenses SET order_id = NULL WHERE order_id = ?', [$id]);
        q('DELETE FROM orders WHERE id = ?', [$id]);
        flash('Pedido #' . $id . ' eliminado junto con sus pagos.');
        redirect('pedidos.php');
    }
    redirect('pedido.php?id=' . $id);
}

/* ===== Vista ===== */
$editing = !$order || isset($_GET['editar']);

if (!$order) {
    // Valores iniciales (pueden venir de la calculadora)
    $g = fn($k, $d = '') => is_string($_GET[$k] ?? null) ? trim($_GET[$k]) : $d;
    $form = [
        'client_name' => $g('client'), 'client_phone' => '', 'channel' => 'WhatsApp',
        'description' => $g('desc'), 'quantity' => max(1, (int)$g('qty', '1')),
        'material' => $g('material'), 'color' => $g('color'),
        'price_total' => $g('price'), 'cost_estimate' => $g('cost'),
        'order_date' => today(), 'delivery_date' => '', 'delivery_time' => '',
        'delivery_method' => 'Retira en local', 'address' => '', 'status' => 'confirmado', 'notes' => $g('notes'),
    ];
} else {
    $form = $order;
}

page_head($order ? 'Pedido #' . $id : 'Nuevo pedido', 'pedidos');

if ($editing): ?>
<div class="page-title">
  <h1><?= $order ? 'Editar pedido #' . $id : 'Nuevo pedido' ?></h1>
  <a class="btn" href="<?= $order ? 'pedido.php?id=' . $id : 'pedidos.php' ?>">Cancelar</a>
</div>
<form method="post" class="card form">
  <?= csrf_field() ?>
  <input type="hidden" name="action" value="save">

  <h2>Cliente</h2>
  <div class="row3">
    <label>Nombre *<input name="client_name" value="<?= e($form['client_name']) ?>" required></label>
    <label>Teléfono / WhatsApp<input name="client_phone" type="tel" value="<?= e($form['client_phone']) ?>" placeholder="0991234567"></label>
    <label>Canal<select name="channel"><option value="">—</option><?= options(CHANNELS, (string)$form['channel']) ?></select></label>
  </div>

  <h2>Pedido</h2>
  <label>Descripción *<input name="description" value="<?= e($form['description']) ?>" placeholder="Ej: Figura Goku SSJ4 — 20 cm" required></label>
  <div class="row3">
    <label>Cantidad<input name="quantity" type="number" min="1" value="<?= (int)$form['quantity'] ?>"></label>
    <label>Material<input name="material" list="materials" value="<?= e($form['material']) ?>"></label>
    <label>Color<input name="color" value="<?= e($form['color']) ?>"></label>
  </div>
  <datalist id="materials"><?= options(MATERIALS, '') ?></datalist>
  <div class="row3">
    <label>Precio total de venta<input name="price_total" inputmode="decimal" value="<?= e($form['price_total']) ?>" placeholder="0.00"></label>
    <label>Costo estimado <small class="muted">(material, máquina…)</small><input name="cost_estimate" inputmode="decimal" value="<?= e($form['cost_estimate']) ?>" placeholder="0.00"></label>
    <label>Estado<select name="status"><?= options(ORDER_STATUSES, (string)$form['status'], true) ?></select></label>
  </div>
  <?php if (!$order): ?>
  <div class="row3">
    <label>Anticipo recibido<input name="deposit" inputmode="decimal" placeholder="0.00"></label>
    <label>Forma de pago del anticipo<select name="deposit_method"><?= options(PAY_METHODS, 'Transferencia') ?></select></label>
    <span></span>
  </div>
  <?php endif; ?>

  <h2>Entrega</h2>
  <div class="row3">
    <label>Fecha del pedido<input name="order_date" type="date" value="<?= e($form['order_date']) ?>"></label>
    <label>Fecha de entrega<input name="delivery_date" type="date" value="<?= e((string)$form['delivery_date']) ?>"></label>
    <label>Hora de entrega <small class="muted">(opcional)</small><input name="delivery_time" type="time" value="<?= e($form['delivery_time']) ?>"></label>
  </div>
  <div class="row2">
    <label>Forma de entrega<select name="delivery_method"><?= options(DELIVERY_METHODS, (string)$form['delivery_method']) ?></select></label>
    <label>Dirección<input name="address" value="<?= e($form['address']) ?>"></label>
  </div>
  <label>Notas<textarea name="notes" rows="3"><?= e((string)$form['notes']) ?></textarea></label>
  <?php if (calendar_enabled()): ?><p class="muted small">📅 Al guardar, la entrega se agenda en Google Calendar con recordatorios.</p><?php endif; ?>
  <button class="btn btn-primary" type="submit">💾 Guardar pedido</button>
</form>
<?php page_foot(); exit; endif;

/* ===== Ficha del pedido ===== */
$payments = q('SELECT p.*, u.name AS user_name FROM payments p LEFT JOIN users u ON u.id = p.created_by WHERE p.order_id = ? ORDER BY p.pay_date, p.id', [$id])->fetchAll();
$profit = (float)$order['price_total'] - (float)$order['cost_estimate'];
$phone = preg_replace('/\D+/', '', $order['client_phone']);
if (str_starts_with($phone, '0')) $phone = '593' . substr($phone, 1);
$creator = $order['created_by'] ? q('SELECT name FROM users WHERE id = ?', [$order['created_by']])->fetchColumn() : null;
?>
<div class="page-title">
  <h1>Pedido #<?= $id ?> <?= status_badge($order['status']) ?></h1>
  <div class="btns">
    <a class="btn" href="pedido.php?id=<?= $id ?>&editar=1">✏️ Editar</a>
  </div>
</div>

<div class="grid2">
  <div class="card">
    <h2><?= e($order['client_name']) ?></h2>
    <?php if ($order['client_phone']): ?>
      <p>📞 <a href="tel:<?= e($order['client_phone']) ?>"><?= e($order['client_phone']) ?></a>
      <?php if ($phone): ?> · <a href="https://wa.me/<?= e($phone) ?>" target="_blank" rel="noopener">💬 WhatsApp</a><?php endif; ?></p>
    <?php endif; ?>
    <p class="big"><?= e($order['description']) ?></p>
    <dl class="dl">
      <dt>Cantidad</dt><dd><?= (int)$order['quantity'] ?></dd>
      <dt>Material</dt><dd><?= e($order['material'] ?: '—') ?><?= $order['color'] ? ' · ' . e($order['color']) : '' ?></dd>
      <dt>Canal</dt><dd><?= e($order['channel'] ?: '—') ?></dd>
      <dt>Fecha del pedido</dt><dd><?= fmt_date($order['order_date']) ?></dd>
      <dt>Entrega</dt><dd><?= $order['delivery_date'] ? fmt_date($order['delivery_date']) . ($order['delivery_time'] ? ' · ' . e($order['delivery_time']) : '') : 'Sin fecha' ?>
        <?php if ($order['delivery_date'] && in_array($order['status'], ACTIVE_STATUSES, true)) echo due_label($order['delivery_date']); ?></dd>
      <dt>Forma de entrega</dt><dd><?= e($order['delivery_method'] ?: '—') ?><?= $order['address'] ? '<br>' . e($order['address']) : '' ?></dd>
      <?php if ($order['notes']): ?><dt>Notas</dt><dd class="pre"><?= e($order['notes']) ?></dd><?php endif; ?>
      <dt>Registrado por</dt><dd><?= e($creator ?: '—') ?></dd>
    </dl>
  </div>

  <div>
    <div class="card">
      <h2>Dinero</h2>
      <dl class="dl money-dl">
        <dt>Precio de venta</dt><dd><?= money($order['price_total']) ?></dd>
        <dt>Pagado</dt><dd class="pos"><?= money($order['paid']) ?></dd>
        <dt>Saldo por cobrar</dt><dd class="<?= $order['balance'] > 0.009 ? 'neg' : 'pos' ?>"><b><?= money($order['balance']) ?></b></dd>
        <dt>Costo estimado</dt><dd><?= money($order['cost_estimate']) ?></dd>
        <dt>Utilidad estimada</dt><dd class="<?= $profit >= 0 ? 'pos' : 'neg' ?>"><?= money($profit) ?><?= (float)$order['price_total'] > 0 ? ' <small>(' . round($profit / (float)$order['price_total'] * 100) . '%)</small>' : '' ?></dd>
      </dl>
    </div>

    <div class="card">
      <h2>Cambiar estado</h2>
      <form method="post" class="status-btns">
        <?= csrf_field() ?><input type="hidden" name="action" value="status">
        <?php foreach (ORDER_STATUSES as $k => $label): if ($k === $order['status']) continue; ?>
          <button class="btn btn-sm st-btn-<?= e($k) ?>" name="status" value="<?= e($k) ?>"><?= e($label) ?></button>
        <?php endforeach; ?>
      </form>
    </div>

    <div class="card">
      <h2>📅 Google Calendar</h2>
      <?php if (!calendar_enabled()): ?>
        <p class="muted small">La sincronización automática no está configurada (ver INSTALACION.md, paso 4).</p>
      <?php elseif ($order['calendar_error']): ?>
        <p class="neg small">Error: <?= e($order['calendar_error']) ?></p>
      <?php elseif ($order['calendar_event_id']): ?>
        <p class="pos small">✔ Agendado<?= $order['calendar_synced_at'] ? ' · actualizado ' . e(date('d/m H:i', strtotime($order['calendar_synced_at']))) : '' ?></p>
      <?php elseif (!$order['delivery_date']): ?>
        <p class="muted small">Ponle fecha de entrega para agendarlo.</p>
      <?php endif; ?>
      <div class="btns">
        <?php if (calendar_enabled() && $order['delivery_date'] && $order['status'] !== 'cancelado'): ?>
          <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="sync"><button class="btn btn-sm">🔄 Sincronizar ahora</button></form>
        <?php endif; ?>
        <?php if ($order['delivery_date']): ?>
          <a class="btn btn-sm" target="_blank" rel="noopener" href="<?= e(calendar_template_link($order)) ?>">➕ Agregar manualmente</a>
        <?php endif; ?>
      </div>
    </div>
  </div>
</div>

<div class="card">
  <h2>Pagos recibidos</h2>
  <?php if ($payments): ?>
  <div class="table-wrap"><table class="table">
    <thead><tr><th>Fecha</th><th>Tipo</th><th>Forma</th><th>Registró</th><th class="r">Monto</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($payments as $p): ?>
      <tr>
        <td><?= fmt_date($p['pay_date']) ?></td><td><?= e($p['category']) ?></td><td><?= e($p['method']) ?></td><td><?= e($p['user_name'] ?? '') ?></td>
        <td class="r"><?= money($p['amount']) ?></td>
        <td class="r"><form method="post" data-confirm="¿Eliminar este pago?"><?= csrf_field() ?><input type="hidden" name="action" value="delete_payment"><input type="hidden" name="payment_id" value="<?= (int)$p['id'] ?>"><button class="btn-x" title="Eliminar">✕</button></form></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
  <?php else: ?><p class="muted">Todavía no hay pagos para este pedido.</p><?php endif; ?>

  <form method="post" class="inline-form">
    <?= csrf_field() ?><input type="hidden" name="action" value="add_payment">
    <label>Monto<input name="amount" inputmode="decimal" value="<?= $order['balance'] > 0 ? e(number_format((float)$order['balance'], 2, '.', '')) : '' ?>" required></label>
    <label>Fecha<input type="date" name="pay_date" value="<?= today() ?>"></label>
    <label>Forma<select name="method"><?= options(PAY_METHODS, 'Transferencia') ?></select></label>
    <label>Tipo<select name="category"><?= options(INCOME_CATEGORIES, $payments ? 'Pago de pedido' : 'Anticipo') ?></select></label>
    <button class="btn btn-primary" type="submit">➕ Registrar pago</button>
  </form>
</div>

<form method="post" class="danger-zone" data-confirm="¿Eliminar el pedido #<?= $id ?> y todos sus pagos? Esto no se puede deshacer.">
  <?= csrf_field() ?><input type="hidden" name="action" value="delete">
  <button class="btn btn-danger btn-sm">🗑 Eliminar pedido</button>
</form>
<?php page_foot();

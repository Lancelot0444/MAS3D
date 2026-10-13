<?php
declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/layout.php';
require __DIR__ . '/app/calendar.php';
require __DIR__ . '/app/month.php';
$user = require_login();
[$m, $start, $end, $prev, $next, $label] = selected_month();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = post('action');
    if ($action === 'add') {
        $amount = num(post('amount'));
        $orderId = (int)post('order_id') ?: null;
        if ($orderId && !q('SELECT id FROM orders WHERE id = ?', [$orderId])->fetch()) $orderId = null;
        if ($amount <= 0) {
            flash('Escribe un monto mayor a cero.', 'err');
        } else {
            $date = valid_date(post('pay_date')) ? post('pay_date') : today();
            $cat = pick(post('category'), INCOME_CATEGORIES, $orderId ? 'Pago de pedido' : 'Otro ingreso');
            q('INSERT INTO payments (order_id, pay_date, amount, method, category, concept, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [$orderId, $date, $amount, pick(post('method'), PAY_METHODS, 'Efectivo'), $cat,
               mb_substr(post('concept') ?: ($orderId ? "$cat pedido #$orderId" : $cat), 0, 255), $user['id'], now()]);
            flash('Ingreso de ' . money($amount) . ' registrado.');
            if ($orderId && ($err = calendar_sync_order($orderId))) flash('Google Calendar: ' . $err, 'warn');
            $m = substr($date, 0, 7);
        }
    } elseif ($action === 'delete') {
        $p = q('SELECT order_id FROM payments WHERE id = ?', [(int)post('id')])->fetch();
        if ($p) {
            q('DELETE FROM payments WHERE id = ?', [(int)post('id')]);
            flash('Ingreso eliminado.');
            if ($p['order_id']) calendar_sync_order((int)$p['order_id']);
        }
    }
    redirect('ingresos.php?mes=' . $m);
}

$rows = q('SELECT p.*, o.client_name, u.name AS user_name FROM payments p
           LEFT JOIN orders o ON o.id = p.order_id LEFT JOIN users u ON u.id = p.created_by
           WHERE p.pay_date BETWEEN ? AND ? ORDER BY p.pay_date DESC, p.id DESC', [$start, $end])->fetchAll();
$total = array_sum(array_column($rows, 'amount'));
$byMethod = [];
foreach ($rows as $r) $byMethod[$r['method'] ?: '—'] = ($byMethod[$r['method'] ?: '—'] ?? 0) + (float)$r['amount'];
arsort($byMethod);
$openOrders = q("SELECT id, client_name, description FROM orders WHERE status <> 'cancelado' ORDER BY id DESC LIMIT 200")->fetchAll();

page_head('Ingresos', 'ingresos');
?>
<div class="page-title">
  <h1>Ingresos</h1>
  <?= month_switcher($prev, $next, $label) ?>
</div>

<div class="kpis">
  <div class="kpi"><span>Total del mes</span><b class="pos"><?= money($total) ?></b></div>
  <?php foreach ($byMethod as $method => $sum): ?>
    <div class="kpi"><span><?= e($method) ?></span><b><?= money($sum) ?></b></div>
  <?php endforeach; ?>
</div>

<details class="card" <?= $rows ? '' : 'open' ?>>
  <summary><b>➕ Registrar ingreso</b> <span class="muted small">(los pagos de pedidos también se pueden registrar desde la ficha del pedido)</span></summary>
  <form method="post" class="inline-form">
    <?= csrf_field() ?><input type="hidden" name="action" value="add">
    <label>Monto<input name="amount" inputmode="decimal" required></label>
    <label>Fecha<input type="date" name="pay_date" value="<?= today() ?>"></label>
    <label>Forma<select name="method"><?= options(PAY_METHODS, 'Transferencia') ?></select></label>
    <label>Tipo<select name="category"><?= options(INCOME_CATEGORIES, 'Pago de pedido') ?></select></label>
    <label class="grow">Pedido <small class="muted">(opcional)</small><select name="order_id"><option value="">— Sin pedido —</option>
      <?php foreach ($openOrders as $o): ?><option value="<?= (int)$o['id'] ?>">#<?= (int)$o['id'] ?> · <?= e($o['client_name']) ?> · <?= e(mb_strimwidth($o['description'], 0, 40, '…')) ?></option><?php endforeach; ?>
    </select></label>
    <label class="grow">Detalle<input name="concept" placeholder="Opcional"></label>
    <button class="btn btn-primary" type="submit">Guardar</button>
  </form>
</details>

<div class="card">
  <?php if (!$rows): ?><p class="muted">No hay ingresos en <?= e($label) ?>.</p><?php else: ?>
  <div class="table-wrap"><table class="table">
    <thead><tr><th>Fecha</th><th>Detalle</th><th>Pedido</th><th>Forma</th><th>Registró</th><th class="r">Monto</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($rows as $r): ?>
      <tr>
        <td class="nowrap"><?= fmt_date($r['pay_date']) ?></td>
        <td><?= e($r['concept'] ?: $r['category']) ?></td>
        <td><?= $r['order_id'] ? '<a href="pedido.php?id=' . (int)$r['order_id'] . '">#' . (int)$r['order_id'] . ' ' . e($r['client_name'] ?? '') . '</a>' : '—' ?></td>
        <td><?= e($r['method']) ?></td><td><?= e($r['user_name'] ?? '') ?></td>
        <td class="r pos"><?= money($r['amount']) ?></td>
        <td class="r"><form method="post" data-confirm="¿Eliminar este ingreso?"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>"><button class="btn-x" title="Eliminar">✕</button></form></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
  <?php endif; ?>
</div>
<?php page_foot();

<?php
declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/layout.php';
require_login();

$filter = (string)($_GET['estado'] ?? 'activos');
$search = trim((string)($_GET['q'] ?? ''));

$where = [];
$params = [];
if ($filter === 'activos') {
    $where[] = "o.status IN ('" . implode("','", ACTIVE_STATUSES) . "')";
} elseif ($filter === 'por_cobrar') {
    $where[] = "o.status <> 'cancelado'";
} elseif (isset(ORDER_STATUSES[$filter])) {
    $where[] = 'o.status = ?';
    $params[] = $filter;
} else {
    $filter = 'todos';
}
if ($search !== '') {
    $where[] = '(o.client_name LIKE ? OR o.description LIKE ? OR o.client_phone LIKE ? OR CAST(o.id AS CHAR) = ?)';
    array_push($params, "%$search%", "%$search%", "%$search%", ltrim($search, '#'));
}
$sql = 'SELECT o.*, COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id), 0) AS paid FROM orders o'
     . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
     . ($filter === 'activos'
        ? ' ORDER BY CASE WHEN o.delivery_date IS NULL THEN 1 ELSE 0 END, o.delivery_date, o.delivery_time, o.id'
        : ' ORDER BY o.id DESC');
$orders = q($sql, $params)->fetchAll();
if ($filter === 'por_cobrar') {
    $orders = array_values(array_filter($orders, fn($o) => (float)$o['price_total'] - (float)$o['paid'] > 0.009));
}

$tabs = ['activos' => 'En curso', 'por_cobrar' => 'Por cobrar'] + ORDER_STATUSES + ['todos' => 'Todos'];

page_head('Pedidos', 'pedidos');
?>
<div class="page-title">
  <h1>Pedidos</h1>
  <a class="btn btn-primary" href="pedido.php">➕ Nuevo pedido</a>
</div>

<form class="toolbar" method="get">
  <input type="hidden" name="estado" value="<?= e($filter) ?>">
  <input type="search" name="q" value="<?= e($search) ?>" placeholder="Buscar cliente, descripción, teléfono o #">
  <button class="btn" type="submit">Buscar</button>
</form>

<div class="chips">
  <?php foreach ($tabs as $key => $label): ?>
    <a class="chip <?= $filter === $key ? 'on' : '' ?>" href="?estado=<?= e($key) ?>&q=<?= urlencode($search) ?>"><?= e($label) ?></a>
  <?php endforeach; ?>
</div>

<?php if (!$orders): ?>
  <div class="card empty">No hay pedidos en esta vista.</div>
<?php else: ?>
  <div class="list">
  <?php foreach ($orders as $o): $bal = (float)$o['price_total'] - (float)$o['paid']; ?>
    <a class="card order-row" href="pedido.php?id=<?= (int)$o['id'] ?>">
      <div class="or-main">
        <div class="or-top"><b>#<?= (int)$o['id'] ?> · <?= e($o['client_name']) ?></b> <?= status_badge($o['status']) ?></div>
        <div class="or-desc"><?= e($o['description']) ?><?= (int)$o['quantity'] > 1 ? ' · x' . (int)$o['quantity'] : '' ?></div>
        <div class="or-meta">
          📅 <?= $o['delivery_date'] ? fmt_date($o['delivery_date']) . ($o['delivery_time'] ? ' ' . e($o['delivery_time']) : '') : 'Sin fecha' ?>
          <?php if ($o['delivery_date'] && in_array($o['status'], ACTIVE_STATUSES, true)) echo due_label($o['delivery_date']); ?>
        </div>
      </div>
      <div class="or-money">
        <div><?= money($o['price_total']) ?></div>
        <?php if ($o['status'] !== 'cancelado' && $bal > 0.009): ?><div class="neg small">Debe <?= money($bal) ?></div>
        <?php elseif ($o['status'] !== 'cancelado'): ?><div class="pos small">Pagado</div><?php endif; ?>
      </div>
    </a>
  <?php endforeach; ?>
  </div>
<?php endif;
page_foot();

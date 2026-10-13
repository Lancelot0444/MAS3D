<?php
declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/layout.php';
$user = require_login();

$start = date('Y-m-01');
$end = date('Y-m-t');
$income = (float)q('SELECT COALESCE(SUM(amount), 0) FROM payments WHERE pay_date BETWEEN ? AND ?', [$start, $end])->fetchColumn();
$expense = (float)q('SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE exp_date BETWEEN ? AND ?', [$start, $end])->fetchColumn();

$active = "'" . implode("','", ACTIVE_STATUSES) . "'";
$receivable = (float)q("SELECT COALESCE(SUM(o.price_total - COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id), 0)), 0)
                        FROM orders o WHERE o.status <> 'cancelado'
                        AND o.price_total > COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id), 0)")->fetchColumn();

$upcoming = q("SELECT o.*, COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id), 0) AS paid
               FROM orders o WHERE o.status IN ($active) AND o.delivery_date IS NOT NULL AND o.delivery_date <= ?
               ORDER BY o.delivery_date, o.delivery_time", [date('Y-m-d', strtotime('+14 days'))])->fetchAll();
$noDate = (int)q("SELECT COUNT(*) FROM orders WHERE status IN ($active) AND delivery_date IS NULL")->fetchColumn();

$counts = [];
foreach (q("SELECT status, COUNT(*) AS n FROM orders WHERE status IN ($active) GROUP BY status")->fetchAll() as $r) $counts[$r['status']] = (int)$r['n'];

page_head('Inicio', 'inicio');
?>
<div class="page-title">
  <h1>Hola, <?= e($user['name']) ?> 👋</h1>
  <div class="btns">
    <a class="btn btn-primary" href="pedido.php">➕ Pedido</a>
    <a class="btn" href="ingresos.php">💵 Ingreso</a>
    <a class="btn" href="gastos.php">🧾 Gasto</a>
  </div>
</div>

<p class="muted"><?= month_name((int)date('n')) . ' ' . date('Y') ?></p>
<div class="kpis">
  <a class="kpi" href="ingresos.php"><span>Ingresos del mes</span><b class="pos"><?= money($income) ?></b></a>
  <a class="kpi" href="gastos.php"><span>Gastos del mes</span><b class="neg"><?= money($expense) ?></b></a>
  <a class="kpi" href="reportes.php"><span>Utilidad del mes</span><b class="<?= $income - $expense >= 0 ? 'pos' : 'neg' ?>"><?= money($income - $expense) ?></b></a>
  <a class="kpi" href="pedidos.php?estado=por_cobrar"><span>Por cobrar</span><b class="warn"><?= money($receivable) ?></b></a>
</div>

<div class="chips">
  <?php foreach (ACTIVE_STATUSES as $s): ?>
    <a class="chip" href="pedidos.php?estado=<?= $s ?>"><?= e(ORDER_STATUSES[$s]) ?> <b><?= $counts[$s] ?? 0 ?></b></a>
  <?php endforeach; ?>
</div>

<div class="card">
  <h2>📅 Próximas entregas <small class="muted">(atrasadas y próximos 14 días)</small></h2>
  <?php if (!$upcoming): ?>
    <p class="muted">No hay entregas pendientes en los próximos 14 días.</p>
  <?php else: ?>
    <div class="list">
    <?php foreach ($upcoming as $o): $bal = (float)$o['price_total'] - (float)$o['paid']; ?>
      <a class="order-row flat" href="pedido.php?id=<?= (int)$o['id'] ?>">
        <div class="or-main">
          <div class="or-top"><b>#<?= (int)$o['id'] ?> · <?= e($o['client_name']) ?></b> <?= status_badge($o['status']) ?></div>
          <div class="or-desc"><?= e($o['description']) ?></div>
          <div class="or-meta"><?= fmt_date($o['delivery_date']) ?><?= $o['delivery_time'] ? ' ' . e($o['delivery_time']) : '' ?> <?= due_label($o['delivery_date']) ?></div>
        </div>
        <div class="or-money"><?= $bal > 0.009 ? '<span class="neg small">Debe ' . money($bal) . '</span>' : '<span class="pos small">Pagado</span>' ?></div>
      </a>
    <?php endforeach; ?>
    </div>
  <?php endif; ?>
  <?php if ($noDate): ?><p class="muted small">⚠️ Hay <a href="pedidos.php"><?= $noDate ?> pedido(s) en curso sin fecha de entrega</a>.</p><?php endif; ?>
</div>
<?php page_foot();

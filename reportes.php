<?php
declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/layout.php';
require_login();

$year = (int)($_GET['anio'] ?? date('Y'));
if ($year < 2000 || $year > 2100) $year = (int)date('Y');
$start = "$year-01-01";
$end = "$year-12-31";

/* ===== Exportar CSV (se abre en Excel o Google Sheets) ===== */
if (isset($_GET['exportar'])) {
    $type = (string)$_GET['exportar'];
    $sets = [
        'ingresos' => ['SELECT p.pay_date AS fecha, p.amount AS monto, p.method AS forma_pago, p.category AS tipo, p.concept AS detalle, p.order_id AS pedido, o.client_name AS cliente
                        FROM payments p LEFT JOIN orders o ON o.id = p.order_id WHERE p.pay_date BETWEEN ? AND ? ORDER BY p.pay_date', [$start, $end]],
        'gastos'   => ['SELECT exp_date AS fecha, amount AS monto, category AS categoria, description AS descripcion, method AS forma_pago
                        FROM expenses WHERE exp_date BETWEEN ? AND ? ORDER BY exp_date', [$start, $end]],
        'pedidos'  => ['SELECT o.id AS pedido, o.order_date AS fecha_pedido, o.delivery_date AS fecha_entrega, o.client_name AS cliente, o.client_phone AS telefono,
                        o.channel AS canal, o.description AS descripcion, o.quantity AS cantidad, o.material, o.color, o.status AS estado,
                        o.price_total AS precio, o.cost_estimate AS costo_estimado,
                        COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id), 0) AS pagado
                        FROM orders o WHERE o.order_date BETWEEN ? AND ? ORDER BY o.id', [$start, $end]],
    ];
    if (isset($sets[$type])) {
        [$sql, $params] = $sets[$type];
        $rows = q($sql, $params)->fetchAll();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="mas3d-' . $type . '-' . $year . '.csv"');
        $out = fopen('php://output', 'w');
        fwrite($out, "\xEF\xBB\xBF"); // BOM para que Excel lea las tildes
        if ($rows) fputcsv($out, array_keys($rows[0]), ';');
        foreach ($rows as $r) {
            // Evita que Excel interprete textos como fórmulas
            $r = array_map(fn($v) => is_string($v) && preg_match('/^[=+\-@]/', $v) && !is_numeric($v) ? "'" . $v : $v, $r);
            fputcsv($out, $r, ';');
        }
        exit;
    }
}

$months = array_fill(1, 12, ['in' => 0.0, 'out' => 0.0]);
foreach (q('SELECT SUBSTR(pay_date, 6, 2) AS m, SUM(amount) AS s FROM payments WHERE pay_date BETWEEN ? AND ? GROUP BY SUBSTR(pay_date, 6, 2)', [$start, $end])->fetchAll() as $r) $months[(int)$r['m']]['in'] = (float)$r['s'];
foreach (q('SELECT SUBSTR(exp_date, 6, 2) AS m, SUM(amount) AS s FROM expenses WHERE exp_date BETWEEN ? AND ? GROUP BY SUBSTR(exp_date, 6, 2)', [$start, $end])->fetchAll() as $r) $months[(int)$r['m']]['out'] = (float)$r['s'];
$totIn = array_sum(array_column($months, 'in'));
$totOut = array_sum(array_column($months, 'out'));
$maxBar = max(0.01, ...array_map(fn($x) => max($x['in'], $x['out']), $months));

$byCat = q('SELECT category, SUM(amount) AS s FROM expenses WHERE exp_date BETWEEN ? AND ? GROUP BY category ORDER BY s DESC', [$start, $end])->fetchAll();
$byChannel = q("SELECT COALESCE(NULLIF(o.channel, ''), 'Sin canal') AS channel, SUM(p.amount) AS s FROM payments p JOIN orders o ON o.id = p.order_id
                WHERE p.pay_date BETWEEN ? AND ? GROUP BY COALESCE(NULLIF(o.channel, ''), 'Sin canal') ORDER BY s DESC", [$start, $end])->fetchAll();
$topClients = q("SELECT o.client_name, COUNT(DISTINCT o.id) AS n, SUM(p.amount) AS s FROM payments p JOIN orders o ON o.id = p.order_id
                 WHERE p.pay_date BETWEEN ? AND ? GROUP BY o.client_name ORDER BY s DESC LIMIT 10", [$start, $end])->fetchAll();
$ordersStats = q("SELECT COUNT(*) AS n, COALESCE(SUM(price_total), 0) AS sales, COALESCE(SUM(cost_estimate), 0) AS cost
                  FROM orders WHERE status <> 'cancelado' AND order_date BETWEEN ? AND ?", [$start, $end])->fetch();

page_head('Reportes', 'reportes');
?>
<div class="page-title">
  <h1>Reportes <?= $year ?></h1>
  <div class="month-sw"><a class="btn btn-sm" href="?anio=<?= $year - 1 ?>">‹</a><b><?= $year ?></b><a class="btn btn-sm" href="?anio=<?= $year + 1 ?>">›</a></div>
</div>

<div class="kpis">
  <div class="kpi"><span>Ingresos del año</span><b class="pos"><?= money($totIn) ?></b></div>
  <div class="kpi"><span>Gastos del año</span><b class="neg"><?= money($totOut) ?></b></div>
  <div class="kpi"><span>Utilidad del año</span><b class="<?= $totIn - $totOut >= 0 ? 'pos' : 'neg' ?>"><?= money($totIn - $totOut) ?></b></div>
  <div class="kpi"><span>Margen</span><b><?= $totIn > 0 ? round(($totIn - $totOut) / $totIn * 100) . '%' : '—' ?></b></div>
</div>

<div class="card">
  <h2>Mes a mes</h2>
  <div class="legend"><span><i class="bar-pos"></i> Ingresos</span><span><i class="bar-neg"></i> Gastos</span></div>
  <div class="table-wrap"><table class="table">
    <thead><tr><th>Mes</th><th class="w40"></th><th class="r">Ingresos</th><th class="r">Gastos</th><th class="r">Utilidad</th></tr></thead>
    <tbody>
    <?php foreach ($months as $i => $x): $u = $x['in'] - $x['out']; ?>
      <tr>
        <td><a href="ingresos.php?mes=<?= sprintf('%d-%02d', $year, $i) ?>"><?= month_name($i) ?></a></td>
        <td><div class="bar"><i class="bar-pos" style="width:<?= round($x['in'] / $maxBar * 100) ?>%"></i></div><div class="bar"><i class="bar-neg" style="width:<?= round($x['out'] / $maxBar * 100) ?>%"></i></div></td>
        <td class="r"><?= money($x['in']) ?></td><td class="r"><?= money($x['out']) ?></td>
        <td class="r <?= $u >= 0 ? 'pos' : 'neg' ?>"><b><?= money($u) ?></b></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
    <tfoot><tr><th>Total</th><th></th><th class="r"><?= money($totIn) ?></th><th class="r"><?= money($totOut) ?></th><th class="r"><?= money($totIn - $totOut) ?></th></tr></tfoot>
  </table></div>
</div>

<div class="grid2">
  <div class="card">
    <h2>Gastos por categoría</h2>
    <?php if (!$byCat): ?><p class="muted">Sin gastos.</p><?php endif; ?>
    <?php foreach ($byCat as $r): ?>
      <div class="bar-row"><span><?= e($r['category']) ?></span><div class="bar"><i class="bar-neg" style="width:<?= max(2, round($r['s'] / max($totOut, 0.01) * 100)) ?>%"></i></div><b><?= money($r['s']) ?></b></div>
    <?php endforeach; ?>
  </div>
  <div class="card">
    <h2>Ventas por canal</h2>
    <?php $chTot = array_sum(array_column($byChannel, 's')); if (!$byChannel): ?><p class="muted">Sin datos.</p><?php endif; ?>
    <?php foreach ($byChannel as $r): ?>
      <div class="bar-row"><span><?= e($r['channel']) ?></span><div class="bar"><i class="bar-pos" style="width:<?= max(2, round($r['s'] / max($chTot, 0.01) * 100)) ?>%"></i></div><b><?= money($r['s']) ?></b></div>
    <?php endforeach; ?>
  </div>
</div>

<div class="grid2">
  <div class="card">
    <h2>Mejores clientes</h2>
    <?php if (!$topClients): ?><p class="muted">Sin datos.</p><?php else: ?>
    <table class="table"><thead><tr><th>Cliente</th><th class="r">Pedidos</th><th class="r">Pagado</th></tr></thead><tbody>
      <?php foreach ($topClients as $r): ?><tr><td><?= e($r['client_name']) ?></td><td class="r"><?= (int)$r['n'] ?></td><td class="r"><?= money($r['s']) ?></td></tr><?php endforeach; ?>
    </tbody></table><?php endif; ?>
  </div>
  <div class="card">
    <h2>Pedidos del año</h2>
    <dl class="dl money-dl">
      <dt>Pedidos (sin cancelados)</dt><dd><?= (int)$ordersStats['n'] ?></dd>
      <dt>Ventas pactadas</dt><dd><?= money($ordersStats['sales']) ?></dd>
      <dt>Costo estimado</dt><dd><?= money($ordersStats['cost']) ?></dd>
      <dt>Utilidad estimada</dt><dd class="pos"><?= money($ordersStats['sales'] - $ordersStats['cost']) ?></dd>
      <dt>Ticket promedio</dt><dd><?= $ordersStats['n'] ? money($ordersStats['sales'] / $ordersStats['n']) : '—' ?></dd>
    </dl>
  </div>
</div>

<div class="card">
  <h2>Exportar <?= $year ?> a Excel</h2>
  <div class="btns">
    <a class="btn" href="?anio=<?= $year ?>&exportar=ingresos">⬇️ Ingresos</a>
    <a class="btn" href="?anio=<?= $year ?>&exportar=gastos">⬇️ Gastos</a>
    <a class="btn" href="?anio=<?= $year ?>&exportar=pedidos">⬇️ Pedidos</a>
  </div>
</div>
<?php page_foot();

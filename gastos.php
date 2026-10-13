<?php
declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/layout.php';
require __DIR__ . '/app/month.php';
$user = require_login();
[$m, $start, $end, $prev, $next, $label] = selected_month();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = post('action');
    if ($action === 'save') {
        $amount = num(post('amount'));
        $date = valid_date(post('exp_date')) ? post('exp_date') : today();
        $data = [$date, pick(post('category'), EXPENSE_CATEGORIES, 'Otros'), mb_substr(post('description'), 0, 255),
                 $amount, pick(post('method'), PAY_METHODS, 'Efectivo')];
        if ($amount <= 0) {
            flash('Escribe un monto mayor a cero.', 'err');
        } elseif ($eid = (int)post('id')) {
            q('UPDATE expenses SET exp_date = ?, category = ?, description = ?, amount = ?, method = ? WHERE id = ?', [...$data, $eid]);
            flash('Gasto actualizado.');
            $m = substr($date, 0, 7);
        } else {
            q('INSERT INTO expenses (exp_date, category, description, amount, method, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [...$data, $user['id'], now()]);
            flash('Gasto de ' . money($amount) . ' registrado.');
            $m = substr($date, 0, 7);
        }
    } elseif ($action === 'delete') {
        q('DELETE FROM expenses WHERE id = ?', [(int)post('id')]);
        flash('Gasto eliminado.');
    }
    redirect('gastos.php?mes=' . $m);
}

$edit = isset($_GET['editar']) ? q('SELECT * FROM expenses WHERE id = ?', [(int)$_GET['editar']])->fetch() : null;
$rows = q('SELECT x.*, u.name AS user_name FROM expenses x LEFT JOIN users u ON u.id = x.created_by
           WHERE x.exp_date BETWEEN ? AND ? ORDER BY x.exp_date DESC, x.id DESC', [$start, $end])->fetchAll();
$total = array_sum(array_column($rows, 'amount'));
$byCat = [];
foreach ($rows as $r) $byCat[$r['category']] = ($byCat[$r['category']] ?? 0) + (float)$r['amount'];
arsort($byCat);

page_head('Gastos', 'gastos');
?>
<div class="page-title">
  <h1>Gastos</h1>
  <?= month_switcher($prev, $next, $label) ?>
</div>

<div class="kpis">
  <div class="kpi"><span>Total del mes</span><b class="neg"><?= money($total) ?></b></div>
</div>

<?php if ($byCat): ?>
<div class="card">
  <h2>Por categoría</h2>
  <?php foreach ($byCat as $cat => $sum): ?>
    <div class="bar-row"><span><?= e($cat) ?></span><div class="bar"><i class="bar-neg" style="width:<?= max(2, round($sum / max($total, 0.01) * 100)) ?>%"></i></div><b><?= money($sum) ?></b></div>
  <?php endforeach; ?>
</div>
<?php endif; ?>

<details class="card" <?= $edit || !$rows ? 'open' : '' ?> id="form">
  <summary><b><?= $edit ? '✏️ Editar gasto' : '➕ Registrar gasto' ?></b></summary>
  <form method="post" class="inline-form">
    <?= csrf_field() ?><input type="hidden" name="action" value="save">
    <?php if ($edit): ?><input type="hidden" name="id" value="<?= (int)$edit['id'] ?>"><?php endif; ?>
    <label>Monto<input name="amount" inputmode="decimal" value="<?= $edit ? e($edit['amount']) : '' ?>" required></label>
    <label>Fecha<input type="date" name="exp_date" value="<?= e($edit['exp_date'] ?? today()) ?>"></label>
    <label>Categoría<select name="category"><?= options(EXPENSE_CATEGORIES, $edit['category'] ?? 'Filamento') ?></select></label>
    <label>Forma de pago<select name="method"><?= options(PAY_METHODS, $edit['method'] ?? 'Efectivo') ?></select></label>
    <label class="grow">Descripción<input name="description" value="<?= e($edit['description'] ?? '') ?>" placeholder="Ej: 3 rollos PLA Silk 3DTRONIX"></label>
    <button class="btn btn-primary" type="submit">Guardar</button>
    <?php if ($edit): ?><a class="btn" href="gastos.php?mes=<?= e(substr($edit['exp_date'], 0, 7)) ?>">Cancelar</a><?php endif; ?>
  </form>
</details>

<div class="card">
  <?php if (!$rows): ?><p class="muted">No hay gastos en <?= e($label) ?>.</p><?php else: ?>
  <div class="table-wrap"><table class="table">
    <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Forma</th><th>Registró</th><th class="r">Monto</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($rows as $r): ?>
      <tr>
        <td class="nowrap"><?= fmt_date($r['exp_date']) ?></td><td><?= e($r['category']) ?></td><td><?= e($r['description']) ?></td>
        <td><?= e($r['method']) ?></td><td><?= e($r['user_name'] ?? '') ?></td>
        <td class="r neg"><?= money($r['amount']) ?></td>
        <td class="r nowrap"><a class="btn-x" href="?mes=<?= e($m) ?>&editar=<?= (int)$r['id'] ?>#form" title="Editar">✏️</a>
          <form method="post" data-confirm="¿Eliminar este gasto?" style="display:inline"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= (int)$r['id'] ?>"><button class="btn-x" title="Eliminar">✕</button></form></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
  <?php endif; ?>
</div>
<?php page_foot();

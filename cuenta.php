<?php
declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/layout.php';
$u = require_login();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $row = q('SELECT password_hash FROM users WHERE id = ?', [$u['id']])->fetch();
    $cur = (string)($_POST['current'] ?? '');
    $p1 = (string)($_POST['new'] ?? '');
    $p2 = (string)($_POST['confirm'] ?? '');
    if (!password_verify($cur, $row['password_hash'])) {
        flash('La contraseña actual no es correcta.', 'err');
    } elseif (mb_strlen($p1) < 8) {
        flash('La nueva contraseña debe tener al menos 8 caracteres.', 'err');
    } elseif ($p1 !== $p2) {
        flash('Las contraseñas nuevas no coinciden.', 'err');
    } else {
        q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($p1, PASSWORD_DEFAULT), $u['id']]);
        session_regenerate_id(true);
        flash('Contraseña actualizada.');
    }
    redirect('cuenta.php');
}

page_head('Mi cuenta');
?>
<h1>Mi cuenta</h1>
<div class="card narrow">
  <p><b><?= e($u['name']) ?></b> · usuario <code><?= e($u['username']) ?></code></p>
  <h2>Cambiar contraseña</h2>
  <form method="post">
    <?= csrf_field() ?>
    <label>Contraseña actual<input type="password" name="current" required autocomplete="current-password"></label>
    <label>Nueva contraseña<input type="password" name="new" minlength="8" required autocomplete="new-password"></label>
    <label>Repetir nueva contraseña<input type="password" name="confirm" minlength="8" required autocomplete="new-password"></label>
    <button class="btn btn-primary" type="submit">Guardar</button>
  </form>
</div>
<?php page_foot();

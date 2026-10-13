<?php
declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/layout.php';
require __DIR__ . '/app/schema.php';

if (!schema_installed()) redirect('install.php');
if (current_user()) redirect('index.php');

$next = (string)($_GET['next'] ?? $_POST['next'] ?? 'index.php');
// Solo redirecciones internas
if (!preg_match('#^/?[a-zA-Z0-9_./?=&%-]*$#', $next) || str_starts_with($next, '//')) $next = 'index.php';

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (too_many_attempts()) {
        $error = 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.';
    } elseif (attempt_login(post('username'), (string)($_POST['password'] ?? ''))) {
        redirect($next);
    } else {
        $error = 'Usuario o contraseña incorrectos.';
    }
}

page_head('Iniciar sesión');
?>
<div class="login">
  <div class="card">
    <div class="login-logo"><img src="assets/icon.svg" alt="" width="56" height="56"><span>MAS<b>3D</b></span></div>
    <p class="muted center">Pedidos · Contabilidad · Entregas</p>
    <?php if ($error): ?><div class="flash flash-err"><?= e($error) ?></div><?php endif; ?>
    <form method="post">
      <?= csrf_field() ?>
      <input type="hidden" name="next" value="<?= e($next) ?>">
      <label>Usuario<input name="username" value="<?= e(post('username')) ?>" autocapitalize="none" autocorrect="off" autocomplete="username" required autofocus></label>
      <label>Contraseña<input type="password" name="password" autocomplete="current-password" required></label>
      <button class="btn btn-primary btn-block" type="submit">Entrar</button>
    </form>
  </div>
</div>
<?php page_foot();

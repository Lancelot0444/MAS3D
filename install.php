<?php
declare(strict_types=1);
require __DIR__ . '/app/bootstrap.php';
require __DIR__ . '/app/schema.php';
require __DIR__ . '/app/layout.php';

$installed = false;
try {
    $installed = schema_installed() && (int)q('SELECT COUNT(*) FROM users')->fetchColumn() > 0;
} catch (PDOException $e) {
    page_head('Instalación');
    echo '<div class="card narrow"><h1>No se pudo conectar a la base de datos</h1><p>Revisa los datos en <b>config.php</b>.</p><pre class="err">'
       . e($e->getMessage()) . '</pre></div>';
    page_foot();
    exit;
}

if ($installed) {
    page_head('Instalación');
    echo '<div class="card narrow"><h1>✅ La app ya está instalada</h1><p>Por seguridad, <b>borra el archivo install.php</b> del servidor.</p><p><a class="btn" href="login.php">Ir a iniciar sesión</a></p></div>';
    page_foot();
    exit;
}

$errors = [];
$defaults = [['brian', 'Brian'], ['mayra', 'Mayra']];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $users = [];
    foreach ([0, 1] as $i) {
        $username = mb_strtolower(post("u$i"));
        $name = post("n$i");
        $p1 = (string)($_POST["p$i"] ?? '');
        $p2 = (string)($_POST["c$i"] ?? '');
        if (!preg_match('/^[a-z0-9._-]{3,30}$/', $username)) $errors[] = "Usuario " . ($i + 1) . ": usa solo letras minúsculas, números, punto o guion (3 a 30 caracteres).";
        if ($name === '') $errors[] = "Usuario " . ($i + 1) . ": falta el nombre.";
        if (mb_strlen($p1) < 8) $errors[] = "Usuario " . ($i + 1) . ": la contraseña debe tener al menos 8 caracteres.";
        if ($p1 !== $p2) $errors[] = "Usuario " . ($i + 1) . ": las contraseñas no coinciden.";
        $users[] = [$username, $name, $p1];
    }
    if ($users[0][0] === $users[1][0]) $errors[] = 'Los dos usuarios deben ser distintos.';
    if (!$errors) {
        create_schema();
        foreach ($users as [$username, $name, $pass]) {
            q('INSERT INTO users (username, name, password_hash, created_at) VALUES (?, ?, ?, ?)',
              [$username, $name, password_hash($pass, PASSWORD_DEFAULT), now()]);
        }
        flash('Instalación completa. Ya pueden iniciar sesión. Recuerda borrar install.php del servidor.');
        redirect('login.php');
    }
}

page_head('Instalación');
?>
<div class="card narrow">
  <h1>Instalar MAS3D</h1>
  <p class="muted">Se crearán las tablas en la base de datos y las cuentas de acceso. Cada persona puede cambiar su contraseña después desde “Mi cuenta”.</p>
  <?php foreach ($errors as $err): ?><div class="flash flash-err"><?= e($err) ?></div><?php endforeach; ?>
  <form method="post" autocomplete="off">
    <?= csrf_field() ?>
    <?php foreach ($defaults as $i => [$du, $dn]): ?>
      <fieldset>
        <legend>Usuario <?= $i + 1 ?></legend>
        <div class="row2">
          <label>Nombre<input name="n<?= $i ?>" value="<?= e(post("n$i", $dn)) ?>" required></label>
          <label>Usuario<input name="u<?= $i ?>" value="<?= e(post("u$i", $du)) ?>" autocapitalize="none" required></label>
        </div>
        <div class="row2">
          <label>Contraseña<input type="password" name="p<?= $i ?>" minlength="8" required autocomplete="new-password"></label>
          <label>Repetir contraseña<input type="password" name="c<?= $i ?>" minlength="8" required autocomplete="new-password"></label>
        </div>
      </fieldset>
    <?php endforeach; ?>
    <button class="btn btn-primary" type="submit">Instalar</button>
  </form>
</div>
<?php page_foot();

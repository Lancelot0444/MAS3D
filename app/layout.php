<?php
declare(strict_types=1);

function page_head(string $title, string $active = '', array $extraCss = [], string $wrapClass = 'm3-wrap'): void
{
    $u = current_user();
    $nav = [
        'inicio'      => ['index.php', '🏠', 'Inicio'],
        'pedidos'     => ['pedidos.php', '📦', 'Pedidos'],
        'ingresos'    => ['ingresos.php', '💵', 'Ingresos'],
        'gastos'      => ['gastos.php', '🧾', 'Gastos'],
        'reportes'    => ['reportes.php', '📊', 'Reportes'],
        'calculadora' => ['calculadora.php', '🧮', 'Cotizar'],
    ];
    ?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0d0d1a">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="MAS3D">
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" href="assets/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
  <title><?= e($title) ?> · MAS3D</title>
  <link rel="stylesheet" href="assets/app.css">
  <?php foreach ($extraCss as $css): ?><link rel="stylesheet" href="<?= e($css) ?>"><?php endforeach; ?>
</head>
<body class="m3">
<?php if ($u): ?>
  <nav class="m3-top">
    <a class="m3-brand" href="index.php">
      <img src="assets/icon.svg" alt="" width="28" height="28"><span>MAS<b>3D</b></span>
    </a>
    <div class="m3-links">
      <?php foreach ($nav as $key => [$href, $icon, $label]): ?>
        <a href="<?= $href ?>" class="<?= $active === $key ? 'on' : '' ?>"><span><?= $icon ?></span><?= $label ?></a>
      <?php endforeach; ?>
    </div>
    <div class="m3-user">
      <a href="cuenta.php" title="Mi cuenta">👤 <?= e($u['name']) ?></a>
      <a href="logout.php" class="m3-out">Salir</a>
    </div>
  </nav>
<?php endif; ?>
  <div class="<?= e($wrapClass) ?>">
<?php foreach (take_flashes() as [$type, $msg]): ?>
    <div class="flash flash-<?= e($type) ?>"><?= e($msg) ?></div>
<?php endforeach;
}

function page_foot(array $scripts = []): void
{
    ?>
  </div>
<?php foreach ($scripts as $js): ?>  <script src="<?= e($js) ?>"></script>
<?php endforeach; ?>
  <script>
    document.querySelectorAll('[data-confirm]').forEach(el => el.addEventListener('submit', ev => {
      if (!confirm(el.dataset.confirm)) ev.preventDefault();
    }));
  </script>
</body>
</html>
<?php
}

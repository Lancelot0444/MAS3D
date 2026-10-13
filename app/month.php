<?php
declare(strict_types=1);

/** Mes seleccionado (?mes=YYYY-MM) y sus límites. */
function selected_month(): array
{
    $m = (string)($_GET['mes'] ?? date('Y-m'));
    if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $m)) $m = date('Y-m');
    $start = $m . '-01';
    $end = date('Y-m-t', strtotime($start));
    $prev = date('Y-m', strtotime($start . ' -1 month'));
    $next = date('Y-m', strtotime($start . ' +1 month'));
    $label = month_name((int)substr($m, 5, 2)) . ' ' . substr($m, 0, 4);
    return [$m, $start, $end, $prev, $next, $label];
}

function month_switcher(string $prev, string $next, string $label): string
{
    return '<div class="month-sw"><a class="btn btn-sm" href="?mes=' . $prev . '">‹</a><b>' . e($label)
         . '</b><a class="btn btn-sm" href="?mes=' . $next . '">›</a></div>';
}

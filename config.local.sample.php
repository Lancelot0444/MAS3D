<?php
/*
 * MAS3D — Configuración para usar la app EN TU PC (sin hosting).
 * Los scripts iniciar-windows.bat / iniciar.sh copian este archivo como
 * "config.php" automáticamente si todavía no existe.
 * Usa SQLite: la base de datos es un solo archivo en data/mas3d.sqlite.
 */
return [
    'db' => [
        'driver' => 'sqlite',
        'path'   => __DIR__ . '/data/mas3d.sqlite',
    ],

    'base_url' => 'http://localhost:8000',

    'timezone' => 'America/Guayaquil',
    'currency' => '$',

    'google_calendar' => [
        'script_url' => '',
        'secret'     => '',
        'event_hour' => '10:00',
        'duration_minutes' => 60,
    ],
];

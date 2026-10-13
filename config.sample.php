<?php
/*
 * MAS3D — Configuración
 * 1) Copia este archivo como "config.php" (en la misma carpeta).
 * 2) Llena los datos de tu base de datos MySQL de Hostinger.
 * 3) Nunca subas config.php a GitHub (ya está en .gitignore).
 */
return [
    // Base de datos (hPanel → Bases de datos → Administración de MySQL)
    'db' => [
        'driver'   => 'mysql',
        'host'     => 'localhost',
        'name'     => 'u000000000_mas3d',   // nombre de la base de datos
        'user'     => 'u000000000_mas3d',   // usuario de la base de datos
        'password' => 'CAMBIAR_ESTA_CLAVE',
    ],

    // Dirección pública de la app, sin "/" al final (se usa en los eventos del calendario)
    'base_url' => 'https://tudominio.com',

    'timezone' => 'America/Guayaquil',
    'currency' => '$',

    // Google Calendar (ver INSTALACION.md, paso 4). Déjalo vacío para desactivarlo.
    'google_calendar' => [
        'script_url' => '',                 // URL del Apps Script publicado (termina en /exec)
        'secret'     => '',                 // la misma clave que pusiste en Code.gs
        'event_hour' => '10:00',            // hora del evento si el pedido no tiene hora de entrega
        'duration_minutes' => 60,
    ],
];

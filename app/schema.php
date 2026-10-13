<?php
declare(strict_types=1);

/** Crea las tablas si no existen. Compatible con MySQL (Hostinger) y SQLite (pruebas). */
function create_schema(): void
{
    global $CONFIG;
    $sqlite = ($CONFIG['db']['driver'] ?? 'mysql') === 'sqlite';
    $pk = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY';
    $fk = $sqlite ? 'INTEGER' : 'INT UNSIGNED';
    $tail = $sqlite ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

    $tables = [
        "CREATE TABLE IF NOT EXISTS users (
            id $pk,
            username VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(100) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at DATETIME NOT NULL
        )$tail",
        "CREATE TABLE IF NOT EXISTS login_attempts (
            id $pk,
            ip VARCHAR(45) NOT NULL,
            username VARCHAR(50) NOT NULL,
            attempted_at DATETIME NOT NULL
        )$tail",
        "CREATE TABLE IF NOT EXISTS orders (
            id $pk,
            client_name VARCHAR(120) NOT NULL,
            client_phone VARCHAR(40) NOT NULL DEFAULT '',
            channel VARCHAR(40) NOT NULL DEFAULT '',
            description VARCHAR(255) NOT NULL,
            quantity INT NOT NULL DEFAULT 1,
            material VARCHAR(60) NOT NULL DEFAULT '',
            color VARCHAR(60) NOT NULL DEFAULT '',
            price_total DECIMAL(10,2) NOT NULL DEFAULT 0,
            cost_estimate DECIMAL(10,2) NOT NULL DEFAULT 0,
            order_date DATE NOT NULL,
            delivery_date DATE NULL,
            delivery_time VARCHAR(5) NOT NULL DEFAULT '',
            delivery_method VARCHAR(40) NOT NULL DEFAULT '',
            address VARCHAR(255) NOT NULL DEFAULT '',
            status VARCHAR(20) NOT NULL DEFAULT 'confirmado',
            notes TEXT NULL,
            calendar_event_id VARCHAR(255) NULL,
            calendar_synced_at DATETIME NULL,
            calendar_error VARCHAR(255) NULL,
            created_by $fk NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL
        )$tail",
        "CREATE TABLE IF NOT EXISTS payments (
            id $pk,
            order_id $fk NULL,
            pay_date DATE NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            method VARCHAR(40) NOT NULL DEFAULT '',
            category VARCHAR(40) NOT NULL DEFAULT '',
            concept VARCHAR(255) NOT NULL DEFAULT '',
            created_by $fk NULL,
            created_at DATETIME NOT NULL
        )$tail",
        "CREATE TABLE IF NOT EXISTS expenses (
            id $pk,
            exp_date DATE NOT NULL,
            category VARCHAR(60) NOT NULL,
            description VARCHAR(255) NOT NULL DEFAULT '',
            amount DECIMAL(10,2) NOT NULL,
            method VARCHAR(40) NOT NULL DEFAULT '',
            order_id $fk NULL,
            created_by $fk NULL,
            created_at DATETIME NOT NULL
        )$tail",
    ];
    foreach ($tables as $sql) db()->exec($sql);

    $indexes = [
        'idx_orders_status'   => 'orders (status)',
        'idx_orders_delivery' => 'orders (delivery_date)',
        'idx_payments_order'  => 'payments (order_id)',
        'idx_payments_date'   => 'payments (pay_date)',
        'idx_expenses_date'   => 'expenses (exp_date)',
        'idx_attempts_ip'     => 'login_attempts (ip, attempted_at)',
    ];
    foreach ($indexes as $name => $def) {
        try {
            db()->exec(($sqlite ? "CREATE INDEX IF NOT EXISTS $name ON " : "CREATE INDEX $name ON ") . $def);
        } catch (PDOException $e) {
            // El índice ya existe (MySQL no soporta IF NOT EXISTS en índices)
        }
    }
}

function schema_installed(): bool
{
    try {
        db()->query('SELECT 1 FROM users LIMIT 1');
        return true;
    } catch (PDOException $e) {
        return false;
    }
}

<?php

declare(strict_types=1);

/**
 * Конфигурация gs2.
 *
 * Секретов в этом файле НЕТ и они не должны здесь появляться: файл лежит в
 * публичном репозитории. Реальные значения берутся в таком порядке:
 *
 *   1. переменные окружения GS_DB_HOST / GS_DB_PORT / GS_DB_NAME /
 *      GS_DB_USER / GS_DB_PASSWORD;
 *   2. локальный файл с секретами (по умолчанию /etc/gs2/config.local.php,
 *      можно переопределить через GS2_CONFIG_FILE). Файл должен лежать вне
 *      веб-корня и вне репозитория, права 640 root:www-data.
 *
 * Пример /etc/gs2/config.local.php:
 *
 *   <?php
 *   return [
 *       'db' => [
 *           'host' => 'localhost',
 *           'port' => 3306,
 *           'database' => 'gs2',
 *           'user' => 'gs2',
 *           'password' => '...',
 *       ],
 *   ];
 */

$localFile = getenv('GS2_CONFIG_FILE') ?: '/etc/gs2/config.local.php';
$local = is_file($localFile) ? require $localFile : [];
$localDb = is_array($local['db'] ?? null) ? $local['db'] : [];

$defaults = [
    'host' => 'localhost',
    'port' => 3306,
    'database' => 'CHANGE_ME_DB_NAME',
    'user' => 'CHANGE_ME_DB_USER',
    'password' => 'CHANGE_ME_DB_PASSWORD',
];

$pick = static function (string $envName, string $key) use ($localDb, $defaults): string {
    $fromEnv = getenv($envName);
    if ($fromEnv !== false && $fromEnv !== '') {
        return $fromEnv;
    }

    if (isset($localDb[$key]) && $localDb[$key] !== '') {
        return (string) $localDb[$key];
    }

    return $defaults[$key];
};

$roomDefaults = [
    'player_timeout_seconds' => 35,
    'signal_retention_hours' => 12,
    'max_players' => 4,
];

$room = $roomDefaults;
foreach (is_array($local['room'] ?? null) ? $local['room'] : [] as $key => $value) {
    $room[$key] = $value;
}

return [
    'db' => [
        'host' => $pick('GS_DB_HOST', 'host'),
        'port' => (int) $pick('GS_DB_PORT', 'port'),
        'database' => $pick('GS_DB_NAME', 'database'),
        'user' => $pick('GS_DB_USER', 'user'),
        'password' => $pick('GS_DB_PASSWORD', 'password'),
    ],
    'room' => $room,
];

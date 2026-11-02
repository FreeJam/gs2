<?php
declare(strict_types=1);

function gs_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function gs_fail(string $message, int $status = 400, array $extra = []): void
{
    gs_json_response(array_merge([
        'ok' => false,
        'error' => $message,
    ], $extra), $status);
}

function gs_config(): array
{
    static $config;

    if ($config !== null) {
        return $config;
    }

    $config = require __DIR__ . '/config.php';
    return $config;
}

function gs_require_config(): array
{
    $config = gs_config();
    $db = $config['db'] ?? [];

    if (
        ($db['database'] ?? '') === 'CHANGE_ME_DB_NAME' ||
        ($db['user'] ?? '') === 'CHANGE_ME_DB_USER' ||
        ($db['password'] ?? '') === 'CHANGE_ME_DB_PASSWORD'
    ) {
        gs_fail('Configure api/config.php before using multiplayer.', 500);
    }

    return $config;
}

function gs_db(): PDO
{
    static $pdo;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = gs_require_config();
    $db = $config['db'];

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $db['host'],
        (int) $db['port'],
        $db['database']
    );

    try {
        $pdo = new PDO($dsn, $db['user'], $db['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $exception) {
        gs_fail('Database connection failed: ' . $exception->getMessage(), 500);
    }

    return $pdo;
}

function gs_json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return $_POST ?: [];
    }

    $decoded = json_decode($raw, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        return $decoded;
    }

    parse_str($raw, $parsed);
    return is_array($parsed) ? $parsed : [];
}

function gs_require_fields(array $data, array $fields): void
{
    foreach ($fields as $field) {
        if (!array_key_exists($field, $data) || $data[$field] === '' || $data[$field] === null) {
            gs_fail('Missing field: ' . $field, 422);
        }
    }
}

function gs_str_limit(string $value, int $limit): string
{
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $limit);
    }

    return substr($value, 0, $limit);
}

function gs_uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

    $hex = bin2hex($bytes);
    return sprintf(
        '%s-%s-%s-%s-%s',
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 12, 4),
        substr($hex, 16, 4),
        substr($hex, 20, 12)
    );
}

function gs_secret(): string
{
    return bin2hex(random_bytes(24));
}

function gs_cleanup(PDO $pdo): void
{
    $config = gs_config();
    $timeoutSeconds = max(10, (int) ($config['room']['player_timeout_seconds'] ?? 35));
    $signalRetentionHours = max(1, (int) ($config['room']['signal_retention_hours'] ?? 12));

    $pdo->exec(
        "UPDATE gs_players
         SET connected = 0, status = 'left'
         WHERE connected = 1
           AND last_seen_at < (UTC_TIMESTAMP() - INTERVAL {$timeoutSeconds} SECOND)"
    );

    $staleRoomsStmt = $pdo->query(
        "SELECT r.id
         FROM gs_rooms r
         LEFT JOIN gs_players hp ON hp.room_id = r.id AND hp.is_host = 1 AND hp.connected = 1
         WHERE hp.id IS NULL"
    );
    $staleRooms = array_column($staleRoomsStmt->fetchAll(), 'id');

    if ($staleRooms) {
        $placeholders = implode(', ', array_fill(0, count($staleRooms), '?'));
        $deleteRoomsStmt = $pdo->prepare("DELETE FROM gs_rooms WHERE id IN ({$placeholders})");
        $deleteRoomsStmt->execute($staleRooms);
    }

    $pdo->exec(
        "DELETE FROM gs_signals
         WHERE created_at < (UTC_TIMESTAMP() - INTERVAL {$signalRetentionHours} HOUR)"
    );
}

function gs_touch_player(PDO $pdo, string $roomId, string $playerId): void
{
    $stmt = $pdo->prepare(
        'UPDATE gs_players
         SET connected = 1, last_seen_at = UTC_TIMESTAMP()
         WHERE id = :player_id AND room_id = :room_id'
    );
    $stmt->execute([
        'player_id' => $playerId,
        'room_id' => $roomId,
    ]);
}

function gs_touch_room_if_host(PDO $pdo, array $player): void
{
    if ((int) ($player['is_host'] ?? 0) !== 1) {
        return;
    }

    $stmt = $pdo->prepare(
        'UPDATE gs_rooms SET updated_at = UTC_TIMESTAMP() WHERE id = :room_id'
    );
    $stmt->execute([
        'room_id' => $player['room_id'],
    ]);
}

function gs_auth_player(PDO $pdo, string $roomId, string $playerId, string $playerSecret): array
{
    $stmt = $pdo->prepare(
        'SELECT id, room_id, name, is_host, connected, slot_index
         FROM gs_players
         WHERE room_id = :room_id
           AND id = :player_id
           AND secret = :secret
           AND status <> :left_status
         LIMIT 1'
    );
    $stmt->execute([
        'room_id' => $roomId,
        'player_id' => $playerId,
        'secret' => $playerSecret,
        'left_status' => 'left',
    ]);

    $player = $stmt->fetch();
    if (!$player) {
        gs_fail('Player authorization failed.', 403);
    }

    return $player;
}

function gs_room_exists(PDO $pdo, string $roomId): bool
{
    $stmt = $pdo->prepare('SELECT id FROM gs_rooms WHERE id = :room_id LIMIT 1');
    $stmt->execute(['room_id' => $roomId]);
    return (bool) $stmt->fetchColumn();
}

function gs_fetch_room(PDO $pdo, string $roomId): ?array
{
    $stmt = $pdo->prepare(
        'SELECT id, name, max_players, status, created_at, updated_at
         FROM gs_rooms
         WHERE id = :room_id
         LIMIT 1'
    );
    $stmt->execute(['room_id' => $roomId]);
    $room = $stmt->fetch();

    return $room ?: null;
}

function gs_fetch_room_players(PDO $pdo, string $roomId): array
{
    $stmt = $pdo->prepare(
        'SELECT id, name, is_host, connected, slot_index
         FROM gs_players
         WHERE room_id = :room_id AND status <> :left_status
         ORDER BY is_host DESC, slot_index ASC, created_at ASC'
    );
    $stmt->execute([
        'room_id' => $roomId,
        'left_status' => 'left',
    ]);

    return array_map(static function (array $row): array {
        return [
            'id' => $row['id'],
            'name' => $row['name'],
            'isHost' => (bool) $row['is_host'],
            'connected' => (bool) $row['connected'],
            'slotIndex' => (int) $row['slot_index'],
        ];
    }, $stmt->fetchAll());
}

function gs_room_payload(PDO $pdo, string $roomId): array
{
    $room = gs_fetch_room($pdo, $roomId);
    if (!$room) {
        gs_fail('Room not found.', 404);
    }

    return [
        'room' => [
            'id' => $room['id'],
            'name' => $room['name'],
            'maxPlayers' => (int) $room['max_players'],
            'status' => $room['status'],
        ],
        'players' => gs_fetch_room_players($pdo, $roomId),
    ];
}

function gs_first_open_slot(PDO $pdo, string $roomId, int $maxPlayers): int
{
    $stmt = $pdo->prepare(
        'SELECT slot_index
         FROM gs_players
         WHERE room_id = :room_id AND status <> :left_status
         ORDER BY slot_index ASC'
    );
    $stmt->execute([
        'room_id' => $roomId,
        'left_status' => 'left',
    ]);

    $used = array_map('intval', array_column($stmt->fetchAll(), 'slot_index'));

    for ($slot = 1; $slot < $maxPlayers; $slot++) {
        if (!in_array($slot, $used, true)) {
            return $slot;
        }
    }

    gs_fail('Room is full.', 409);
}

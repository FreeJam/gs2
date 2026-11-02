<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$pdo = gs_db();
gs_cleanup($pdo);

$stmt = $pdo->query(
    "SELECT
        r.id,
        r.name,
        r.max_players,
        r.status,
        COUNT(p.id) AS player_count
     FROM gs_rooms r
     INNER JOIN gs_players hp
        ON hp.room_id = r.id AND hp.is_host = 1 AND hp.connected = 1
     LEFT JOIN gs_players p
        ON p.room_id = r.id AND p.connected = 1 AND p.status <> 'left'
     WHERE r.status = 'waiting'
     GROUP BY r.id, r.name, r.max_players, r.status, r.created_at
     HAVING player_count < r.max_players
     ORDER BY r.created_at DESC"
);

$rooms = array_map(static function (array $row): array {
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'players' => (int) $row['player_count'],
        'maxPlayers' => (int) $row['max_players'],
        'state' => $row['status'],
    ];
}, $stmt->fetchAll());

gs_json_response([
    'ok' => true,
    'rooms' => $rooms,
]);

<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$data = $_SERVER['REQUEST_METHOD'] === 'GET' ? $_GET : gs_json_input();
gs_require_fields($data, ['roomId', 'playerId', 'playerSecret']);

$pdo = gs_db();
gs_cleanup($pdo);

$roomId = (string) $data['roomId'];
$playerId = (string) $data['playerId'];
$playerSecret = (string) $data['playerSecret'];
$afterId = max(0, (int) ($data['afterId'] ?? 0));

gs_auth_player($pdo, $roomId, $playerId, $playerSecret);
gs_touch_player($pdo, $roomId, $playerId);

$stmt = $pdo->prepare(
    'SELECT id, from_player_id, type, payload, created_at
     FROM gs_signals
     WHERE room_id = :room_id AND to_player_id = :to_player_id AND id > :after_id
     ORDER BY id ASC
     LIMIT 100'
);
$stmt->bindValue(':room_id', $roomId, PDO::PARAM_STR);
$stmt->bindValue(':to_player_id', $playerId, PDO::PARAM_STR);
$stmt->bindValue(':after_id', $afterId, PDO::PARAM_INT);
$stmt->execute();

$signals = array_map(static function (array $row): array {
    return [
        'id' => (int) $row['id'],
        'fromPlayerId' => $row['from_player_id'],
        'type' => $row['type'],
        'payload' => json_decode($row['payload'], true),
        'createdAt' => $row['created_at'],
    ];
}, $stmt->fetchAll());

gs_json_response([
    'ok' => true,
    'signals' => $signals,
]);

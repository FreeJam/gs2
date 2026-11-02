<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$data = gs_json_input();
gs_require_fields($data, ['roomId', 'playerId', 'playerSecret', 'toPlayerId', 'type', 'payload']);

$pdo = gs_db();
gs_cleanup($pdo);

$roomId = (string) $data['roomId'];
$playerId = (string) $data['playerId'];
$playerSecret = (string) $data['playerSecret'];
$toPlayerId = (string) $data['toPlayerId'];
$type = gs_str_limit(trim((string) $data['type']), 32);
$payload = $data['payload'];

gs_auth_player($pdo, $roomId, $playerId, $playerSecret);
gs_touch_player($pdo, $roomId, $playerId);

$targetStmt = $pdo->prepare(
    'SELECT id FROM gs_players
     WHERE room_id = :room_id AND id = :player_id AND status <> :left_status
     LIMIT 1'
);
$targetStmt->execute([
    'room_id' => $roomId,
    'player_id' => $toPlayerId,
    'left_status' => 'left',
]);

if (!$targetStmt->fetchColumn()) {
    gs_fail('Signal target not found.', 404);
}

$insert = $pdo->prepare(
    'INSERT INTO gs_signals (room_id, from_player_id, to_player_id, type, payload, created_at)
     VALUES (:room_id, :from_player_id, :to_player_id, :type, :payload, UTC_TIMESTAMP())'
);
$insert->execute([
    'room_id' => $roomId,
    'from_player_id' => $playerId,
    'to_player_id' => $toPlayerId,
    'type' => $type,
    'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
]);

gs_json_response(['ok' => true]);

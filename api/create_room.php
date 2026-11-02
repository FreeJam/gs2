<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$data = gs_json_input();
gs_require_fields($data, ['playerName']);

$pdo = gs_db();
gs_cleanup($pdo);

$roomName = trim((string) ($data['roomName'] ?? ''));
$playerName = trim((string) $data['playerName']);
$maxPlayers = (int) ($data['maxPlayers'] ?? 2);
$maxPlayers = max(2, min((int) (gs_config()['room']['max_players'] ?? 4), $maxPlayers));

if ($playerName === '') {
    $playerName = 'Игрок';
}

if ($roomName === '') {
    $roomName = 'Комната';
}

$roomId = gs_uuid();
$playerId = gs_uuid();
$playerSecret = gs_secret();

$pdo->beginTransaction();

$roomStmt = $pdo->prepare(
    'INSERT INTO gs_rooms (id, name, max_players, status, created_at, updated_at)
     VALUES (:id, :name, :max_players, :status, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
);
$roomStmt->execute([
    'id' => $roomId,
    'name' => gs_str_limit($roomName, 64),
    'max_players' => $maxPlayers,
    'status' => 'waiting',
]);

$playerStmt = $pdo->prepare(
    'INSERT INTO gs_players (id, room_id, secret, name, is_host, slot_index, status, connected, created_at, last_seen_at)
     VALUES (:id, :room_id, :secret, :name, 1, 0, :status, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
);
$playerStmt->execute([
    'id' => $playerId,
    'room_id' => $roomId,
    'secret' => $playerSecret,
    'name' => gs_str_limit($playerName, 32),
    'status' => 'lobby',
]);

$pdo->commit();

gs_json_response(array_merge([
    'ok' => true,
    'me' => [
        'id' => $playerId,
        'name' => $playerName,
        'secret' => $playerSecret,
        'isHost' => true,
    ],
], gs_room_payload($pdo, $roomId)));

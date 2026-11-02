<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$data = gs_json_input();
gs_require_fields($data, ['roomId', 'playerName']);

$pdo = gs_db();
gs_cleanup($pdo);

$roomId = (string) $data['roomId'];
$playerName = trim((string) $data['playerName']);
$room = gs_fetch_room($pdo, $roomId);

if (!$room) {
    gs_fail('Room not found.', 404);
}

if ($room['status'] !== 'waiting') {
    gs_fail('The room is no longer accepting players.', 409);
}

$countStmt = $pdo->prepare(
    'SELECT COUNT(*) FROM gs_players
     WHERE room_id = :room_id AND connected = 1 AND status <> :left_status'
);
$countStmt->execute([
    'room_id' => $roomId,
    'left_status' => 'left',
]);

$activePlayers = (int) $countStmt->fetchColumn();
if ($activePlayers >= (int) $room['max_players']) {
    gs_fail('Room is full.', 409);
}

if ($playerName === '') {
    $playerName = 'Игрок';
}

$playerId = gs_uuid();
$playerSecret = gs_secret();
$slotIndex = gs_first_open_slot($pdo, $roomId, (int) $room['max_players']);

$stmt = $pdo->prepare(
    'INSERT INTO gs_players (id, room_id, secret, name, is_host, slot_index, status, connected, created_at, last_seen_at)
     VALUES (:id, :room_id, :secret, :name, 0, :slot_index, :status, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())'
);
$stmt->execute([
    'id' => $playerId,
    'room_id' => $roomId,
    'secret' => $playerSecret,
    'name' => gs_str_limit($playerName, 32),
    'slot_index' => $slotIndex,
    'status' => 'lobby',
]);

gs_json_response(array_merge([
    'ok' => true,
    'me' => [
        'id' => $playerId,
        'name' => $playerName,
        'secret' => $playerSecret,
        'isHost' => false,
    ],
], gs_room_payload($pdo, $roomId)));

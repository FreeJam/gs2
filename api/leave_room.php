<?php
declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$data = gs_json_input();
gs_require_fields($data, ['roomId', 'playerId', 'playerSecret']);

$pdo = gs_db();
gs_cleanup($pdo);

$roomId = (string) $data['roomId'];
$playerId = (string) $data['playerId'];
$playerSecret = (string) $data['playerSecret'];

$player = gs_auth_player($pdo, $roomId, $playerId, $playerSecret);

if ((int) $player['is_host'] === 1) {
    $stmt = $pdo->prepare('DELETE FROM gs_rooms WHERE id = :room_id');
    $stmt->execute(['room_id' => $roomId]);

    gs_json_response([
        'ok' => true,
        'roomClosed' => true,
    ]);
}

$stmt = $pdo->prepare(
    "UPDATE gs_players
     SET connected = 0, status = 'left', last_seen_at = UTC_TIMESTAMP()
     WHERE id = :player_id AND room_id = :room_id"
);
$stmt->execute([
    'player_id' => $playerId,
    'room_id' => $roomId,
]);

gs_json_response([
    'ok' => true,
    'roomClosed' => false,
]);

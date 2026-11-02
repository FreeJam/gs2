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
if ((int) $player['is_host'] !== 1) {
    gs_fail('Only the host can start the match.', 403);
}

$stmt = $pdo->prepare(
    "UPDATE gs_rooms
     SET status = 'playing', updated_at = UTC_TIMESTAMP()
     WHERE id = :room_id"
);
$stmt->execute(['room_id' => $roomId]);

$stmt = $pdo->prepare(
    "UPDATE gs_players
     SET status = 'playing', connected = connected, last_seen_at = last_seen_at
     WHERE room_id = :room_id AND status <> 'left'"
);
$stmt->execute(['room_id' => $roomId]);

gs_json_response(array_merge([
    'ok' => true,
], gs_room_payload($pdo, $roomId)));

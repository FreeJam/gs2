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
gs_touch_player($pdo, $roomId, $playerId);
gs_touch_room_if_host($pdo, $player);

gs_json_response(['ok' => true]);

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

$player = gs_auth_player($pdo, $roomId, $playerId, $playerSecret);
gs_touch_player($pdo, $roomId, $playerId);
gs_touch_room_if_host($pdo, $player);

gs_json_response(array_merge([
    'ok' => true,
], gs_room_payload($pdo, $roomId)));

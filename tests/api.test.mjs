/**
 * Тесты PHP/MySQL API мультиплеера GS2.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { api, uniqueName } from './helpers.mjs';

test('API: список комнат отвечает ok', async () => {
  const res = await api('list_rooms.php');
  assert.equal(res.status, 200);
  assert.equal(res.json.ok, true);
  assert.ok(Array.isArray(res.json.rooms));
});

test('API: создание комнаты требует playerName', async () => {
  const res = await api('create_room.php', { roomName: 'без имени' });
  assert.equal(res.status, 422);
  assert.equal(res.json.ok, false);
});

test('API: полный жизненный цикл комнаты и сигналинга', async () => {
  // 1. Создание комнаты хостом
  const create = await api('create_room.php', {
    playerName: 'Хост',
    roomName: uniqueName('test'),
    maxPlayers: 2
  });
  assert.equal(create.status, 200);
  assert.equal(create.json.ok, true);

  const { room, me } = create.json;
  assert.equal(create.json.players.length, 1);
  assert.equal(me.isHost, true);
  assert.ok(me.secret && me.secret.length > 0);
  assert.equal(room.maxPlayers, 2);

  const hostAuth = { roomId: room.id, playerId: me.id, playerSecret: me.secret };

  // 2. Комната видна в списке
  const list = await api('list_rooms.php');
  assert.ok(list.json.rooms.some((r) => r.id === room.id), 'комната должна быть в списке');

  // 3. Вход гостя, слот = 1
  const join = await api('join_room.php', { roomId: room.id, playerName: 'Гость' });
  assert.equal(join.json.ok, true);
  assert.equal(join.json.me.isHost, false);
  const joinedPlayer = join.json.players.find((p) => p.id === join.json.me.id);
  assert.equal(joinedPlayer.slotIndex, 1);
  const guestAuth = { roomId: room.id, playerId: join.json.me.id, playerSecret: join.json.me.secret };

  // 4. Комната заполнена -> 409
  const full = await api('join_room.php', { roomId: room.id, playerName: 'Третий' });
  assert.equal(full.status, 409);

  // 5. Состояние комнаты: 2 игрока, слоты 0 и 1
  const state = await api('room_state.php', hostAuth);
  assert.equal(state.json.ok, true);
  assert.equal(state.json.players.length, 2);
  const slots = state.json.players.map((p) => p.slotIndex).sort();
  assert.deepEqual(slots, [0, 1]);

  // 6. Heartbeat
  const heartbeat = await api('heartbeat.php', guestAuth);
  assert.equal(heartbeat.json.ok, true);

  // 7. Неверный секрет -> 403
  const badAuth = await api('room_state.php', {
    roomId: room.id,
    playerId: me.id,
    playerSecret: 'x'.repeat(48)
  });
  assert.equal(badAuth.status, 403);

  // 8. Сигналинг: offer от хоста доходит до гостя через MySQL
  const send = await api('send_signal.php', {
    ...hostAuth,
    toPlayerId: join.json.me.id,
    type: 'offer',
    payload: { sdp: 'test-offer' }
  });
  assert.equal(send.json.ok, true);

  const poll = await api('poll_signals.php', { ...guestAuth, afterId: 0 });
  assert.equal(poll.json.ok, true);
  assert.equal(poll.json.signals.length, 1);
  assert.equal(poll.json.signals[0].type, 'offer');
  assert.deepEqual(poll.json.signals[0].payload, { sdp: 'test-offer' });

  // 9. Гость не может начать матч -> 403
  const guestStart = await api('start_game.php', guestAuth);
  assert.equal(guestStart.status, 403);

  // 10. Хост начинает матч
  const start = await api('start_game.php', hostAuth);
  assert.equal(start.json.ok, true);
  assert.equal(start.json.room.status, 'playing');

  // 11. Гость выходит — комната остаётся
  const leaveGuest = await api('leave_room.php', guestAuth);
  assert.equal(leaveGuest.json.ok, true);
  assert.equal(leaveGuest.json.roomClosed, false);

  // 12. Хост выходит — комната закрывается и удаляется
  const leaveHost = await api('leave_room.php', hostAuth);
  assert.equal(leaveHost.json.ok, true);
  assert.equal(leaveHost.json.roomClosed, true);

  const listAfter = await api('list_rooms.php');
  assert.ok(!listAfter.json.rooms.some((r) => r.id === room.id), 'комната не должна остаться в списке');
});

test('API: вход в несуществующую комнату -> 404', async () => {
  const res = await api('join_room.php', {
    roomId: '00000000-0000-4000-8000-000000000000',
    playerName: 'Гость'
  });
  assert.equal(res.status, 404);
});

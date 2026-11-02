/**
 * E2E-тест онлайн-боя: хост + гость, WebRTC DataChannel, старт матча, команды флотов.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { launchBrowser, BASE_URL } from './helpers.mjs';

let browser;

test.before(async () => {
  browser = await launchBrowser();
});

test.after(async () => {
  if (browser) await browser.close();
});

test('мультиплеер: комната, WebRTC, матч и передача команд', async () => {
  const hostCtx = await browser.newContext();
  const guestCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await guestCtx.newPage();

  const errors = [];
  for (const [name, page] of [['host', host], ['guest', guest]]) {
    page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`);
    });
  }

  try {
    await Promise.all([
      host.goto(`${BASE_URL}/`, { waitUntil: 'load', timeout: 30000 }),
      guest.goto(`${BASE_URL}/`, { waitUntil: 'load', timeout: 30000 })
    ]);
    await host.waitForTimeout(600);
    await guest.waitForTimeout(600);

    // Хост создаёт комнату
    await host.evaluate(() => menu.showScreen('multiplayer'));
    await host.fill('#playerName', 'Хост');
    await host.evaluate(() => multiplayer.createRoom());
    await host.waitForFunction(() => !!multiplayer.roomId, null, { timeout: 20000 });
    const roomId = await host.evaluate(() => multiplayer.roomId);
    assert.ok(roomId, 'хост должен получить roomId');

    // Гость входит в комнату
    await guest.evaluate(() => menu.showScreen('multiplayer'));
    await guest.fill('#playerName', 'Гость');
    await guest.evaluate((id) => multiplayer.joinRoom(id), roomId);
    await guest.waitForFunction(() => !!multiplayer.roomId, null, { timeout: 20000 });

    // Хост видит двух игроков
    await host.waitForFunction(() => multiplayer.connectedPlayers().length >= 2, null, { timeout: 30000 });

    // WebRTC-соединение установлено в обе стороны
    await host.waitForFunction(() => multiplayer.canStartGame(), null, { timeout: 40000 });
    await guest.waitForFunction(() => !!multiplayer.guestPeer?.open, null, { timeout: 40000 });

    // Хост начинает матч
    await host.evaluate(() => multiplayer.startGame());
    await host.waitForFunction(() => game.state === 'playing' && game.planets.length > 0, null, { timeout: 20000 });
    await guest.waitForFunction(() => game.state === 'playing' && game.planets.length > 0, null, { timeout: 20000 });

    const hostState = await host.evaluate(() => ({
      mode: game.mode,
      isHost: multiplayer.isHost,
      hasId: !!game.myPlayerId,
      planets: game.planets.length,
      players: game.players.length
    }));
    const guestState = await guest.evaluate(() => ({
      mode: game.mode,
      isHost: multiplayer.isHost,
      hasId: !!game.myPlayerId,
      planets: game.planets.length,
      players: game.players.length
    }));

    assert.equal(hostState.mode, 'multiplayer');
    assert.equal(guestState.mode, 'multiplayer');
    assert.equal(hostState.players, 2);
    assert.equal(guestState.players, 2);
    assert.equal(hostState.planets, guestState.planets, 'карта должна совпадать по числу планет');
    assert.ok(hostState.planets >= 6);

    // Команда флота от гостя доходит до хоста по DataChannel
    const sent = await guest.evaluate(() => {
      const mine = game.planets.find((p) => p.owner === game.myPlayerId);
      const target = game.planets.find((p) => p.owner === null);
      if (!mine || !target) return null;
      multiplayer.sendFleet(mine.id, target.id, 0.5);
      return { from: mine.id, to: target.id };
    });
    assert.ok(sent, 'у гостя должна быть своя планета и нейтральная цель');

    await host.waitForFunction(() => game.fleets.length > 0, null, { timeout: 10000 });
    const hostFleets = await host.evaluate(() => game.fleets.length);
    assert.ok(hostFleets > 0, 'хост должен получить флот гостя');

    // Хост выходит — гость мягко возвращается в лобби, без ошибок
    await host.evaluate(() => multiplayer.leaveRoom());
    await guest.waitForFunction(() => multiplayer.roomId === null, null, { timeout: 20000 });
    const guestAfter = await guest.evaluate(() => ({
      roomId: multiplayer.roomId,
      screen: document.querySelector('.menu-screen.active')?.id || null
    }));
    assert.equal(guestAfter.roomId, null);
    assert.equal(guestAfter.screen, 'multiplayerMenu');

    const meaningfulErrors = errors.filter((e) => !/Failed to load resource/i.test(e));
    assert.deepEqual(meaningfulErrors, []);
  } finally {
    await host.evaluate(() => multiplayer.leaveRoom?.()).catch(() => {});
    await guest.evaluate(() => multiplayer.leaveRoom?.()).catch(() => {});
    await hostCtx.close();
    await guestCtx.close();
  }
});

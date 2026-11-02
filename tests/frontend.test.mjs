/**
 * Тесты клиента: меню, neon-оформление, одиночная игра, эффекты, пауза.
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

async function newPage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE_URL}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1200);
  return { page, errors };
}

test('клиент: меню в стиле «мыльные пузыри» загружается без ошибок', async () => {
  const { page, errors } = await newPage();

  assert.equal(await page.isVisible('#mainMenu'), true);

  // Пузыри в меню появляются
  const particles = await page.$$eval('#menuParticles .particle', (els) => els.length);
  assert.ok(particles > 0, `пузырей: ${particles}`);

  // Цвета фракций остались неоновыми
  const colors = await page.evaluate(() => ({
    you: CONFIG.COLORS.YOU.core,
    ai: CONFIG.COLORS.AI.core,
    palette: CONFIG.PLAYER_PALETTE.length
  }));
  assert.match(colors.you, /0,\s*240,\s*255/); // cyan
  assert.match(colors.ai, /255,\s*45,\s*149/); // pink
  assert.equal(colors.palette, 4);

  // Анимации логотипа и кнопок подключены
  const animationNames = await page.evaluate(() => ({
    logo: getComputedStyle(document.querySelector('.logo h1')).animationName,
    button: getComputedStyle(document.querySelector('.menu-btn.primary')).animationName
  }));
  assert.match(animationNames.logo, /logoFloat/);
  assert.match(animationNames.button, /btnGlowPulse/);

  // Пузырьковая форма: скругления и стеклянный фон
  const shape = await page.evaluate(() => {
    const btn = getComputedStyle(document.querySelector('.menu-btn'));
    const bg = getComputedStyle(document.querySelector('.menu-bg'));
    return {
      radius: parseFloat(btn.borderRadius),
      blur: btn.backdropFilter || btn.webkitBackdropFilter,
      bgImage: bg.backgroundImage
    };
  });
  assert.ok(shape.radius >= 100, `кнопка должна быть скруглённой, radius=${shape.radius}`);
  assert.match(shape.blur, /blur/, 'у кнопки должно быть стеклянное размытие');
  assert.match(shape.bgImage, /radial-gradient/);

  assert.deepEqual(errors, []);
  await page.close();
});

test('клиент: одиночная игра запускается, эффекты живут и затухают, пауза работает', async () => {
  const { page, errors } = await newPage();

  await page.click('button:has-text("Одиночная игра")');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Легко")');

  await page.waitForFunction(() => game.state === 'playing' && game.planets.length > 0, null, { timeout: 15000 });

  const started = await page.evaluate(() => ({
    state: game.state,
    mode: game.mode,
    planets: game.planets.length,
    own: game.planets.filter((p) => p.owner === CONFIG.OWNER.YOU).length,
    ai: game.planets.filter((p) => p.owner === CONFIG.OWNER.AI).length
  }));
  assert.equal(started.mode, 'singleplayer');
  assert.ok(started.planets >= 5, `планет: ${started.planets}`);
  assert.equal(started.own, 1);
  assert.ok(started.ai >= 1);

  // Спавн neon-взрыва
  const spawned = await page.evaluate(() => {
    const target = game.planets.find((p) => p.owner !== CONFIG.OWNER.YOU);
    game.spawnExplosion(target.x, target.y, game.ownerColor(target.owner), true);
    return game.effects.length;
  });
  assert.ok(spawned >= 5, `эффектов: ${spawned}`);

  // Эффекты затухают
  await page.waitForTimeout(1800);
  const remaining = await page.evaluate(() => game.effects.length);
  assert.ok(remaining < spawned, `осталось ${remaining} из ${spawned}`);

  // Симуляция идёт: производство кораблей растёт
  const before = await page.evaluate(() => game.planets.find((p) => p.owner === CONFIG.OWNER.YOU).ships);
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => game.planets.find((p) => p.owner === CONFIG.OWNER.YOU).ships);
  assert.ok(after > before, `производство: ${before} -> ${after}`);

  // Пауза / продолжение
  await page.evaluate(() => game.pause());
  assert.equal(await page.evaluate(() => game.state), 'paused');
  await page.evaluate(() => game.resume());
  assert.equal(await page.evaluate(() => game.state), 'playing');

  // Выход в меню
  await page.evaluate(() => game.toMenu());
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => game.state), 'menu');

  assert.deepEqual(errors, []);
  await page.close();
});

test('клиент: отправка флота уменьшает гарнизон и создаёт флот', async () => {
  const { page, errors } = await newPage();

  await page.click('button:has-text("Одиночная игра")');
  await page.waitForTimeout(400);
  await page.click('button:has-text("Легко")');
  await page.waitForFunction(() => game.state === 'playing', null, { timeout: 15000 });

  const result = await page.evaluate(() => {
    const from = game.planets.find((p) => p.owner === CONFIG.OWNER.YOU);
    const to = game.planets.find((p) => p.owner !== CONFIG.OWNER.YOU);
    const shipsBefore = from.ships;
    game.sendFleet(from, to, null, 0.5);
    return {
      fleets: game.fleets.length,
      shipsBefore,
      shipsAfter: from.ships
    };
  });

  assert.equal(result.fleets, 1, 'должен появиться один флот');
  assert.ok(result.shipsAfter < result.shipsBefore, 'гарнизон должен уменьшиться');

  assert.deepEqual(errors, []);
  await page.close();
});

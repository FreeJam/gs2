# CHANGELOG

## 2026-09-22 (мыльные пузыри)
- Смена визуальной темы с неона на «мыльные пузыри»: тёмный космос + иридесцентные стеклянные элементы.
- Цвета фракций сохранены неоновыми (p1=pink, p2=cyan, p3=purple, p4=green).
- `css/main.css`, `css/menu.css`, `css/mobile.css` переписаны: скруглённые «пузырьковые» формы вместо угловатых clip-path, стеклянные панели, иридесцентные ободы, анимации `bubbleRise`, `bubbleWobble`, `iridescentHue`.
- `renderer.js`: планеты и флоты отрисовываются как мыльные пузыри (полупрозрачное тело, яркий обод, большой блик и иридесцентный блик), в фон добавлены плывущие пузыри.
- `main.js`: частицы меню заменены на всплывающие мыльные пузыри.
- Тесты обновлены под новую тему; 8/8 проходят.

## 2026-09-22 (neon)
- Полный neon-редизайн интерфейса: переписаны `css/main.css`, `css/menu.css`, `css/mobile.css` (палитра cyan/pink/purple/green, анимации, grid overlay, частицы, scanline).
- Neon в canvas: `renderer.js` — ореолы и свечение планет, вращающееся кольцо выделения, кометные флоты, neon-прицел, эффекты.
- `config.js` — новая палитра `COLORS` и `PLAYER_PALETTE` (p1=pink, p2=cyan, p3=purple, p4=green).
- `game.js` — система визуальных эффектов: neon-взрывы и искры при захвате/подкреплении.
- `main.js` — генератор neon-частиц в меню; `index.html` — слой частиц и scanline.
- Онлайн-бои восстановлены и развёрнуты: PHP-FPM 8.3 + MariaDB 10.11, nginx `location /gs2/`, БД `artiklbtgm_gs2`.
- Мягкий выход гостя при уходе хоста (`multiplayer.handleSessionLost`) вместо ошибки авторизации.
- Добавлены автотесты (`package.json`, `tests/`): API (PHP/MySQL), клиент и E2E-мультиплеер; `npm test`.

## 2026-03-16
- Reworked multiplayer for regular web hosting without a permanent Node.js game server.
- Added PHP + MySQL room, heartbeat, and WebRTC signaling API.
- Moved authoritative multiplayer simulation into the host player's browser.
- Switched hosting build output to a shared-hosting-friendly web root with `index.html`, `css/`, `js/`, and `api/`.

## 2026-03-09
- Added project documentation set for future AI and developers.
- Added reproducible hosting build pipeline and dist package generation.
- Rebalanced singleplayer AI difficulty.
- Introduced medium-difficulty AI personalities for more varied behavior.
- Preserved hard mode as difficult but intentionally beatable.

## 2026-03-08
- Restored missing server files from archive and reinstated project runtime.
- Fixed menu screen navigation mismatches and multiplayer startup issues.
- Redesigned game HUD and menu visuals around angular sci-fi controls.
- Added aim assist for drag targeting and reinforcement to friendly planets.
- Reworked in-game and menu UI styling, including space-themed backgrounds.

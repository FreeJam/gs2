# TESTING

## Local Commands
```bash
npm start
npm run build:hosting
npm run start:dist
```

`npm start` and `npm run start:dist` are static previews only. Full multiplayer validation requires a PHP/MySQL runtime.

## Automated Tests

Требуется Node.js 20+ и подключение к работающему PHP/MySQL-хостингу.

```bash
npm test              # все тесты
npm run test:api      # только PHP API
npm run test:frontend # только клиент (нужен браузер Playwright)
npm run test:multiplayer
```

Адрес по умолчанию — `https://freejam.online/gs2`. Переопределяется переменной
`GS2_BASE_URL`, путь к модулю Playwright — `PLAYWRIGHT_MODULE`.

Покрытие:
- **api.test.mjs** — список/создание/вход/выход комнат, room_state, heartbeat,
  авторизация (403), сигналинг через MySQL, старт матча только хостом.
- **frontend.test.mjs** — загрузка меню без ошибок, пузырьковое оформление
  (скругления, стекло, иридесцентный фон), анимации, пузыри-частицы, запуск
  одиночной игры, производство кораблей, эффекты, пауза/продолжение, отправка флота.
- **multiplayer.test.mjs** — хост + гость, WebRTC DataChannel, старт матча,
  доставка команды флота гостя на хост, мягкий выход при уходе хоста.

## Manual Smoke Checklist

### Main Menu
- [ ] Main menu loads without blank screens
- [ ] Angular button style is applied everywhere in menu and popups
- [ ] Settings page dropdown uses dark styling
- [ ] Pause and game-over buttons are centered

### In-Game UX
- [ ] Left send rail does not cover the player's starting planet
- [ ] Percentage buttons visually match current menu style
- [ ] Dragging in the direction of a planet locks the target before direct overlap
- [ ] Reinforcement to friendly planets works
- [ ] Attack/capture/reinforcement feedback remains readable

### Singleplayer
- [ ] Easy feels easier than medium
- [ ] Medium shows varied AI behavior across repeated runs
- [ ] Hard remains difficult but beatable
- [ ] Restart after end screen works

### Multiplayer On PHP/MySQL Hosting
- [ ] Room list loads on first open
- [ ] Create room works and creator becomes host
- [ ] Second player sees the room and can join it
- [ ] Host waits until P2P connection is ready before start
- [ ] Host can start the match
- [ ] Guest commands reach the host
- [ ] Fleets, captures, and win state stay synchronized
- [ ] Leaving a room removes or expires it correctly

### Mobile / Responsive
- [ ] Menu remains usable on narrow screens
- [ ] Left send rail stays compact on mobile
- [ ] Joystick and mobile buttons still work
- [ ] Orientation change does not break layout

### Hosting Build
- [ ] `npm run build:hosting` creates `dist/`
- [ ] `dist/index.html` exists
- [ ] `dist/api/schema.sql` exists
- [ ] `dist/js/multiplayer.js` exists
- [ ] Uploaded `dist/` works on PHP/MySQL hosting

# ARCHITECTURE

## High-Level Split
- client/: browser game client
- api/: PHP + MySQL lobby, room, heartbeat, and WebRTC signaling endpoints
- scripts/: build and static preview tooling
- server/: legacy Node/WebSocket backend kept only as historical reference

## Frontend Modules
### client/js/main.js
Bootstraps the app and enables mobile-specific behavior.

### client/js/config.js
Global constants for gameplay, graphics, AI tuning, mobile settings, and multiplayer timings.

### client/js/game.js
Central game state and gameplay coordinator.
Responsibilities:
- canvas sizing
- input-driven selection and drag flow
- fleet sending
- singleplayer map generation
- multiplayer host-side simulation
- guest-side visual interpolation
- end-state handling
- HUD updates

### client/js/renderer.js
Canvas renderer.
Responsibilities:
- space background
- planets and fleets
- drag arrow and target lock visuals
- end-screen overlay rendering

### client/js/input.js
Touch and mobile-specific controls.

### client/js/menu.js
Menu routing, lobby UI, and room screen transitions.

### client/js/multiplayer.js
Browser-hosted multiplayer coordinator.
Responsibilities:
- HTTP room polling through PHP API
- WebRTC offer/answer/ICE signaling
- room creation and join flow
- host peer management
- host-authoritative match snapshots
- guest command forwarding to host

### client/js/ai.js
Singleplayer AI profiles, personalities, strategy selection, and action execution.

### client/js/utils.js
Shared math, formatting, storage, fullscreen, animation, and pointer helpers.

## Backend
### api/list_rooms.php
Returns public waiting rooms from MySQL.

### api/create_room.php / api/join_room.php / api/leave_room.php
Manage room membership and host identity.

### api/room_state.php / api/heartbeat.php
Keep lobby state fresh and expire stale rooms.

### api/send_signal.php / api/poll_signals.php
Move WebRTC offers, answers, and ICE candidates between players through MySQL polling.

### api/schema.sql
MySQL 5.7/8 schema for rooms, players, and signaling records.

## Singleplayer Data Flow
1. Menu starts singleplayer through `game.startSingleplayer(aiCount)`.
2. `game.js` generates the map and AI players.
3. Input events feed `game.js` selection and fleet sending.
4. `renderer.js` draws the current state every frame.
5. `ai.js` decides AI actions on timers.
6. `game.js` checks win/loss.

## Multiplayer Data Flow
1. Host creates a room through `api/create_room.php`.
2. Guests fetch waiting rooms through `api/list_rooms.php` and join through `api/join_room.php`.
3. All players poll `api/room_state.php` and `api/poll_signals.php`.
4. Host creates WebRTC peer connections for guests and sends offers through MySQL signaling.
5. Guests answer and open a WebRTC DataChannel to the host.
6. Host starts the match, generates the map locally, and becomes the authoritative simulator.
7. Guests send fleet commands to the host over DataChannel.
8. Host simulates production, fleets, captures, and win conditions in `game.js`.
9. Host broadcasts match snapshots to guests over DataChannel.

## Build Output
`npm run build:hosting` creates `dist/` as a shared-hosting-ready web root with `index.html`, `css/`, `js/`, and `api/`.

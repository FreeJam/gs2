# Galactic Siege 2.0

Galactic Siege 2.0 is a browser strategy game in the spirit of Galcon. The project now targets regular web hosting: singleplayer runs fully in the browser, while multiplayer uses WebRTC with a PHP/MySQL lobby and signaling layer instead of a permanent Node.js game server.

## Core Features
- Singleplayer battles against AI
- Browser-hosted multiplayer: one player creates a room and becomes the host
- Public room list stored in MySQL
- Real-time match sync over WebRTC DataChannel
- Mouse drag targeting with aim assist
- Reinforcement between your own planets
- Angular sci-fi UI with responsive layout
- Mobile-friendly controls and fullscreen support

## Tech Stack
- Frontend: HTML, CSS, Vanilla JavaScript
- Rendering: HTML5 canvas
- Multiplayer transport: WebRTC DataChannel
- Hosting backend: PHP + MySQL 5.7/8 for rooms, heartbeat, and signaling
- Packaging: custom hosting build script

## Project Structure
- client/
  - css/
  - js/
  - index.html
- api/
  - PHP endpoints for rooms and signaling
  - schema.sql for MySQL setup
- scripts/
  - hosting build and static preview tools
- dist/
  - generated deployable package for shared hosting
- server/
  - legacy Node/WebSocket implementation kept for reference only

## Local Commands
```bash
npm start
npm run build:hosting
npm run start:dist
```

`npm start` and `npm run start:dist` serve only a static preview. They are useful for singleplayer and UI checks. Multiplayer requires PHP + MySQL because `/api/*.php` must execute on the host.

## Documentation Map
- AGENTS.md: project instructions for future AI sessions
- ARCHITECTURE.md: code map and multiplayer data flow
- GAMEPLAY.md: game rules, controls, and combat flow
- UI_GUIDELINES.md: visual language and UX rules
- BALANCE.md: difficulty and AI intent
- TESTING.md: smoke and regression checklist
- DEPLOYMENT.md: how to deploy to regular web hosting
- TASKS.md: open work and roadmap
- KNOWN_ISSUES.md: current limitations and caveats
- CHANGELOG.md: notable changes

## Hosting
This project is designed for ordinary PHP/MySQL web hosting.

```bash
npm run build:hosting
```

That command creates `dist/` with:
- `index.html`
- `css/`
- `js/`
- `api/`
- deployment docs

## Important Notes
- Configure `api/config.php` with your MySQL credentials before using multiplayer.
- Import `api/schema.sql` into MySQL 5.7 or MySQL 8.
- Multiplayer rooms live in MySQL and expire via heartbeat cleanup.
- WebRTC uses public STUN servers by default; some strict NAT combinations may still require a TURN server later.

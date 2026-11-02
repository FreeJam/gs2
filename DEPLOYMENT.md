# DEPLOYMENT

## Hosting Target
This build is intended for regular web hosting that supports:
- PHP with PDO MySQL
- MySQL 5.7 or MySQL 8
- serving static files from a web root

No permanent Node.js process or WebSocket server is required for production multiplayer.

## Build Locally
From the project root:

```bash
npm run build:hosting
```

This creates `dist/`.

## Dist Contents
- `index.html`
- `css/`
- `js/`
- `api/`
- `README.md`
- `DEPLOYMENT.md`
- `ARCHITECTURE.md`
- `TESTING.md`
- `CHANGELOG.md`

## MySQL Setup
1. Create a MySQL database on the host.
2. Import `dist/api/schema.sql`.
3. Edit `dist/api/config.php` with the database host, name, user, and password.

## Deploy dist/ To Hosting
1. Upload the contents of `dist/` into the site web root, for example `public_html/`.
2. Make sure the uploaded `api/` folder is executable as PHP on the host.
3. Open the deployed URL in a browser.

## Local Preview
```bash
npm start
npm run start:dist
```

Those commands start a static preview only. They do not execute PHP files, so multiplayer room creation/join is expected to be unavailable locally unless you run the project behind a PHP-capable local stack.

## Multiplayer Runtime Notes
- Room list, join/create, heartbeat, and WebRTC signaling go through `api/*.php`.
- The actual match is authoritative on the host player's browser and is sent to guests over WebRTC DataChannel.
- The default ICE config uses public STUN servers.
- Some restrictive NAT or corporate networks may still need a TURN server for maximum connection reliability.

## Static Hosting Warning
Pure static hosting without PHP cannot support the multiplayer lobby or signaling layer.

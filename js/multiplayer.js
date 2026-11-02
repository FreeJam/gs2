/**
 * Веб-мультиплеер без постоянного Node-сервера:
 * комнаты и сигналинг живут в PHP/MySQL, сам матч хостится у игрока через WebRTC.
 */
const multiplayer = {
  playerColors: CONFIG.PLAYER_PALETTE,
  roomId: null,
  roomName: '',
  roomStatus: 'waiting',
  roomMaxPlayers: 2,
  playerId: null,
  playerSecret: null,
  players: [],
  isHost: false,
  matchActive: false,
  lastSignalId: 0,
  lastSnapshotSentAt: 0,
  roomsPollTimer: null,
  roomPollTimer: null,
  signalPollTimer: null,
  heartbeatTimer: null,
  signalPollInFlight: false,
  hostPeers: new Map(),
  guestPeer: null,

  init() {
    window.addEventListener('beforeunload', () => {
      if (this.roomId && this.playerId && this.playerSecret) {
        this.sendLeaveBeacon();
      }
    });
  },

  handleScreenChange(nextScreen) {
    if (nextScreen !== 'multiplayerMenu') {
      this.stopRoomsPolling();
    }
  },

  supportsRealtime() {
    return typeof window.fetch === 'function' && typeof window.RTCPeerConnection === 'function';
  },

  async request(endpoint, payload = null, method = 'POST') {
    const url = `${CONFIG.MULTIPLAYER.API_BASE}/${endpoint}`;
    const options = {
      method,
      headers: {}
    };

    if (method === 'GET' && payload) {
      const params = new URLSearchParams();
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      });
      return this.request(`${endpoint}?${params.toString()}`, null, 'GET');
    }

    if (payload) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(url, options);
    const rawText = await response.text();
    let json = {};

    try {
      json = rawText ? JSON.parse(rawText) : {};
    } catch (error) {
      json = {};
    }

    if (!response.ok || json.ok === false) {
      throw new Error(json.error || rawText || 'Multiplayer request failed.');
    }

    return json;
  },

  currentAuthPayload() {
    return {
      roomId: this.roomId,
      playerId: this.playerId,
      playerSecret: this.playerSecret
    };
  },

  getPlayerName() {
    return (document.getElementById('playerName')?.value || 'Игрок').trim() || 'Игрок';
  },

  sortPlayers(players) {
    return [...players].sort((a, b) => {
      if (a.isHost !== b.isHost) {
        return a.isHost ? -1 : 1;
      }
      return (a.slotIndex ?? 0) - (b.slotIndex ?? 0);
    });
  },

  decoratePlayers(players) {
    const sorted = this.sortPlayers(players);
    return sorted.map((player, index) => ({
      ...player,
      color: player.color || this.getPlayerColor(player, index),
      rtcReady: player.isHost
        ? true
        : this.isHost
          ? !!this.hostPeers.get(player.id)?.open
          : player.id === this.getHostPlayerId()
            ? !!this.guestPeer?.open
            : false
    }));
  },

  getPlayerColor(player, index = 0) {
    const paletteIndex = typeof player.slotIndex === 'number' ? player.slotIndex : index;
    return this.playerColors[paletteIndex] || this.playerColors[index] || this.playerColors[0];
  },

  getHostPlayerId() {
    return this.players.find(player => player.isHost)?.id || null;
  },

  connectedPlayers() {
    return this.players.filter(player => player.connected);
  },

  allConnectedGuestsReady() {
    return this.connectedPlayers()
      .filter(player => !player.isHost)
      .every(player => !!this.hostPeers.get(player.id)?.open);
  },

  canStartGame() {
    return this.isHost && this.connectedPlayers().length >= 2 && this.allConnectedGuestsReady();
  },

  updateStartButtonState() {
    const startBtn = document.getElementById('startGameBtn');
    if (!startBtn) return;

    startBtn.disabled = !this.canStartGame();
  },

  updateLobbyStatus() {
    let status = 'Ожидание игроков...';

    if (this.roomStatus === 'playing' || this.matchActive) {
      status = 'Матч идет';
    } else if (this.isHost) {
      if (this.connectedPlayers().length < 2) {
        status = 'Ждем второго игрока...';
      } else if (!this.allConnectedGuestsReady()) {
        status = 'Настройка P2P-соединения...';
      } else {
        status = 'Можно начинать матч';
      }
    } else if (!this.guestPeer?.open) {
      status = 'Соединение с хостом...';
    } else {
      status = 'Ожидание старта от хоста';
    }

    menu.updateLobbyStatus(status);
    this.updateStartButtonState();
  },

  syncLobbyUi() {
    if (!this.roomId) return;

    menu.showLobby(this.roomName || 'Комната', this.players.length, this.roomMaxPlayers);
    menu.updateLobbyPlayers(this.players, this.playerId);
    this.updateLobbyPlayerCount();
    this.updateLobbyStatus();
    this.syncGamePlayers();
  },

  updateLobbyPlayerCount() {
    const counter = document.getElementById('lobbyPlayerCount');
    if (counter) {
      counter.textContent = `${this.players.length} / ${this.roomMaxPlayers} игроков`;
    }
  },

  syncGamePlayers() {
    if (game.mode === CONFIG.GAME_MODES.MULTIPLAYER) {
      game.players = this.players.map(player => ({ ...player }));
    }
  },

  startRoomsPolling() {
    if (this.roomId) return;
    this.stopRoomsPolling();
    this.refreshRooms();
    this.roomsPollTimer = setInterval(() => {
      this.refreshRooms();
    }, CONFIG.MULTIPLAYER.ROOM_LIST_POLL_MS);
  },

  stopRoomsPolling() {
    if (this.roomsPollTimer) {
      clearInterval(this.roomsPollTimer);
      this.roomsPollTimer = null;
    }
  },

  async refreshRooms() {
    if (this.roomId) return;

    try {
      const data = await this.request('list_rooms.php', null, 'GET');
      this.updateRoomsList(data.rooms || []);
    } catch (error) {
      console.error(error);
      const container = document.getElementById('roomsList');
      if (container) {
        container.innerHTML = `<div class="empty">${error.message}</div>`;
      }
    }
  },

  updateRoomsList(rooms) {
    const container = document.getElementById('roomsList');
    if (!container) return;

    container.innerHTML = '';

    if (!rooms.length) {
      container.innerHTML = '<div class="empty">Нет доступных комнат</div>';
      return;
    }

    rooms.forEach(room => {
      const item = document.createElement('div');
      item.className = 'room-item';
      item.innerHTML = `
        <span class="room-name">${room.name}</span>
        <div class="room-info">
          <span>${room.players}/${room.maxPlayers} игроков</span>
          <span class="room-status ${room.state}">
            ${room.state === 'waiting' ? 'Ожидание' : 'Игра'}
          </span>
        </div>
      `;
      item.addEventListener('click', () => this.joinRoom(room.id));
      container.appendChild(item);
    });
  },

  applyRoomIdentity(data, isHost) {
    this.roomId = data.room.id;
    this.roomName = data.room.name;
    this.roomStatus = data.room.status;
    this.roomMaxPlayers = data.room.maxPlayers;
    this.playerId = data.me.id;
    this.playerSecret = data.me.secret;
    this.isHost = isHost;
    this.lastSignalId = 0;
    this.players = this.decoratePlayers(data.players || []);
  },

  startRoomSession() {
    this.stopRoomsPolling();
    this.stopRoomSessionTimers();
    this.syncLobbyUi();
    this.heartbeat();
    this.pollRoomState();
    this.pollSignals();

    this.roomPollTimer = setInterval(() => this.pollRoomState(), CONFIG.MULTIPLAYER.ROOM_POLL_MS);
    this.signalPollTimer = setInterval(() => this.pollSignals(), CONFIG.MULTIPLAYER.SIGNAL_POLL_MS);
    this.heartbeatTimer = setInterval(() => this.heartbeat(), CONFIG.MULTIPLAYER.HEARTBEAT_MS);
  },

  stopRoomSessionTimers() {
    if (this.roomPollTimer) {
      clearInterval(this.roomPollTimer);
      this.roomPollTimer = null;
    }
    if (this.signalPollTimer) {
      clearInterval(this.signalPollTimer);
      this.signalPollTimer = null;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  },

  async createRoom() {
    if (!this.supportsRealtime()) {
      alert('Ваш браузер не поддерживает WebRTC DataChannel.');
      return;
    }

    try {
      const roomName = (document.getElementById('roomName')?.value || 'Комната').trim() || 'Комната';
      const maxPlayers = parseInt(document.querySelector('input[name="maxPlayers"]:checked')?.value || '2', 10);
      const data = await this.request('create_room.php', {
        roomName,
        maxPlayers,
        playerName: this.getPlayerName()
      });

      this.applyRoomIdentity(data, true);
      this.startRoomSession();
    } catch (error) {
      alert(error.message);
    }
  },

  async joinRoom(roomId) {
    if (!this.supportsRealtime()) {
      alert('Ваш браузер не поддерживает WebRTC DataChannel.');
      return;
    }

    try {
      const data = await this.request('join_room.php', {
        roomId,
        playerName: this.getPlayerName()
      });

      this.applyRoomIdentity(data, false);
      this.startRoomSession();
    } catch (error) {
      alert(error.message);
    }
  },

  async pollRoomState() {
    if (!this.roomId || !this.playerId || !this.playerSecret) return;

    try {
      const data = await this.request('room_state.php', this.currentAuthPayload());
      this.roomName = data.room.name;
      this.roomStatus = data.room.status;
      this.roomMaxPlayers = data.room.maxPlayers;
      this.players = this.decoratePlayers(data.players || []);
      this.syncLobbyUi();

      if (this.isHost) {
        this.ensureHostPeers();
        this.pruneHostPeers();
      } else if (!this.players.some(player => player.isHost && player.connected)) {
        throw new Error('Хост вышел из комнаты.');
      }
    } catch (error) {
      // Игрок больше не авторизован / комната закрыта — мягкий выход
      if (!/authorization|403/i.test(error.message)) {
        console.error(error);
      }
      this.handleSessionLost();
    }
  },

  async heartbeat() {
    if (!this.roomId || !this.playerId || !this.playerSecret) return;

    try {
      await this.request('heartbeat.php', this.currentAuthPayload());
    } catch (error) {
      console.error(error);
    }
  },

  createPeerConfig() {
    return {
      iceServers: CONFIG.MULTIPLAYER.ICE_SERVERS
    };
  },

  serializeSessionDescription(description) {
    if (!description) return null;

    return {
      type: description.type,
      sdp: description.sdp
    };
  },

  serializeIceCandidate(candidate) {
    if (!candidate) return null;

    return {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid ?? null,
      sdpMLineIndex: candidate.sdpMLineIndex ?? null,
      usernameFragment: candidate.usernameFragment ?? null
    };
  },

  hasRemoteDescription(pc) {
    return !!pc?.remoteDescription?.type;
  },

  async queueOrApplyIceCandidate(peer, candidate) {
    if (!peer?.pc || !candidate?.candidate) {
      return;
    }

    if (!this.hasRemoteDescription(peer.pc)) {
      peer.pendingIceCandidates.push(candidate);
      return;
    }

    await peer.pc.addIceCandidate(candidate);
  },

  async flushPendingIceCandidates(peer) {
    if (!peer?.pc || !peer.pendingIceCandidates?.length || !this.hasRemoteDescription(peer.pc)) {
      return;
    }

    const queued = [...peer.pendingIceCandidates];
    peer.pendingIceCandidates.length = 0;

    for (const candidate of queued) {
      try {
        await peer.pc.addIceCandidate(candidate);
      } catch (error) {
        console.error(error);
      }
    }
  },

  ensureHostPeers() {
    this.players
      .filter(player => !player.isHost && player.connected)
      .forEach(player => {
        const existing = this.hostPeers.get(player.id);
        const state = existing?.pc?.connectionState;
        if (existing && !['closed', 'failed', 'disconnected'].includes(state)) {
          return;
        }

        this.createHostPeer(player);
      });
  },

  pruneHostPeers() {
    const activeIds = new Set(this.players.filter(player => !player.isHost && player.connected).map(player => player.id));
    Array.from(this.hostPeers.keys()).forEach(playerId => {
      if (!activeIds.has(playerId)) {
        this.closeHostPeer(playerId);
      }
    });
  },

  async createHostPeer(player) {
    this.closeHostPeer(player.id);

    const pc = new RTCPeerConnection(this.createPeerConfig());
    const channel = pc.createDataChannel('galactic-siege', { ordered: true });
    const peer = {
      playerId: player.id,
      pc,
      channel,
      open: false,
      pendingIceCandidates: []
    };

    this.hostPeers.set(player.id, peer);

    channel.onopen = () => {
      peer.open = true;
      this.players = this.decoratePlayers(this.players);
      this.syncLobbyUi();
    };

    channel.onclose = () => {
      peer.open = false;
      this.players = this.decoratePlayers(this.players);
      this.syncLobbyUi();
    };

    channel.onmessage = event => {
      this.handlePeerMessage(player.id, event.data);
    };

    pc.onicecandidate = event => {
      if (event.candidate) {
        this.sendSignal(player.id, 'ice', this.serializeIceCandidate(event.candidate)).catch(console.error);
      }
    };

    pc.onconnectionstatechange = () => {
      if (['closed', 'failed', 'disconnected'].includes(pc.connectionState)) {
        peer.open = false;
        this.players = this.decoratePlayers(this.players);
        this.syncLobbyUi();
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.sendSignal(player.id, 'offer', this.serializeSessionDescription(pc.localDescription));
    } catch (error) {
      console.error(error);
      this.closeHostPeer(player.id);
    }
  },

  closeHostPeer(playerId) {
    const peer = this.hostPeers.get(playerId);
    if (!peer) return;

    try {
      peer.channel?.close();
    } catch (error) {
      console.warn(error);
    }

    try {
      peer.pc?.close();
    } catch (error) {
      console.warn(error);
    }

    this.hostPeers.delete(playerId);
  },

  ensureGuestPeer() {
    const state = this.guestPeer?.pc?.connectionState;
    if (this.guestPeer && !['closed', 'failed', 'disconnected'].includes(state)) {
      return this.guestPeer;
    }

    if (this.guestPeer) {
      this.closeGuestPeer();
    }

    const pc = new RTCPeerConnection(this.createPeerConfig());
    const peer = {
      pc,
      channel: null,
      open: false,
      pendingIceCandidates: []
    };

    pc.onicecandidate = event => {
      const hostId = this.getHostPlayerId();
      if (event.candidate && hostId) {
        this.sendSignal(hostId, 'ice', this.serializeIceCandidate(event.candidate)).catch(console.error);
      }
    };

    pc.ondatachannel = event => {
      peer.channel = event.channel;
      peer.channel.onopen = () => {
        peer.open = true;
        this.players = this.decoratePlayers(this.players);
        this.syncLobbyUi();
      };
      peer.channel.onclose = () => {
        peer.open = false;
        this.players = this.decoratePlayers(this.players);
        this.syncLobbyUi();
      };
      peer.channel.onmessage = messageEvent => {
        this.handleHostMessage(messageEvent.data);
      };
    };

    pc.onconnectionstatechange = () => {
      if (['closed', 'failed', 'disconnected'].includes(pc.connectionState)) {
        peer.open = false;
        this.players = this.decoratePlayers(this.players);
        this.syncLobbyUi();
      }
    };

    this.guestPeer = peer;
    return peer;
  },

  closeGuestPeer() {
    if (!this.guestPeer) return;

    try {
      this.guestPeer.channel?.close();
    } catch (error) {
      console.warn(error);
    }

    try {
      this.guestPeer.pc?.close();
    } catch (error) {
      console.warn(error);
    }

    this.guestPeer = null;
  },

  async sendSignal(toPlayerId, type, payload) {
    if (!this.roomId || !this.playerId || !this.playerSecret) return;

    await this.request('send_signal.php', {
      ...this.currentAuthPayload(),
      toPlayerId,
      type,
      payload
    });
  },

  async pollSignals() {
    if (!this.roomId || !this.playerId || !this.playerSecret || this.signalPollInFlight) return;

    this.signalPollInFlight = true;

    try {
      const data = await this.request('poll_signals.php', {
        ...this.currentAuthPayload(),
        afterId: this.lastSignalId
      });

      for (const signal of data.signals || []) {
        this.lastSignalId = Math.max(this.lastSignalId, signal.id);
        await this.handleSignal(signal);
      }
    } catch (error) {
      // Комната закрыта или игрок больше не авторизован — тихо вернуться в лобби
      if (/authorization|403/i.test(error.message)) {
        this.handleSessionLost();
        return;
      }
      console.error(error);
    } finally {
      this.signalPollInFlight = false;
    }
  },

  async handleSignal(signal) {
    try {
      if (signal.type === 'offer' && !this.isHost) {
        const peer = this.ensureGuestPeer();
        await peer.pc.setRemoteDescription(signal.payload);
        await this.flushPendingIceCandidates(peer);
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        await this.sendSignal(signal.fromPlayerId, 'answer', this.serializeSessionDescription(peer.pc.localDescription));
        return;
      }

      if (signal.type === 'answer' && this.isHost) {
        const peer = this.hostPeers.get(signal.fromPlayerId);
        if (peer) {
          await peer.pc.setRemoteDescription(signal.payload);
          await this.flushPendingIceCandidates(peer);
        }
        return;
      }

      if (signal.type === 'ice') {
        if (this.isHost) {
          const peer = this.hostPeers.get(signal.fromPlayerId);
          if (peer) {
            await this.queueOrApplyIceCandidate(peer, signal.payload);
          }
        } else {
          const peer = this.ensureGuestPeer();
          await this.queueOrApplyIceCandidate(peer, signal.payload);
        }
      }
    } catch (error) {
      console.error(error);
    }
  },

  handlePeerMessage(playerId, rawData) {
    let message;
    try {
      message = JSON.parse(rawData);
    } catch (error) {
      console.error(error);
      return;
    }

    if (message.type === 'fleetCommand') {
      this.applyFleetCommand(playerId, message.fromId, message.toId, message.pct);
    }
  },

  handleHostMessage(rawData) {
    let message;
    try {
      message = JSON.parse(rawData);
    } catch (error) {
      console.error(error);
      return;
    }

    if (message.type === 'gameStarted') {
      this.matchActive = true;
      this.roomStatus = 'playing';
      this.players = this.decoratePlayers(message.payload.players || this.players);
      menu.hide();
      document.getElementById('gameUI').classList.remove('hidden');
      game.startMultiplayer({
        planets: message.payload.planets,
        fleets: message.payload.fleets || [],
        players: this.players,
        playerId: this.playerId
      });
      return;
    }

    if (message.type === 'stateSnapshot') {
      this.applySnapshot(message.payload);
      return;
    }

    if (message.type === 'gameEnded') {
      game.end(message.payload.winner || null);
    }
  },

  applySnapshot(snapshot) {
    if (game.mode !== CONFIG.GAME_MODES.MULTIPLAYER || this.isHost) return;

    const previousShipsDisplay = new Map(game.planets.map(planet => [planet.id, planet.shipsDisplay]));

    snapshot.planets.forEach(updated => {
      const planet = game.planets.find(existing => existing.id === updated.id);
      if (!planet) return;

      planet.owner = updated.owner;
      planet.ships = updated.ships;
      planet.shipsDisplay = previousShipsDisplay.get(updated.id) ?? updated.ships;
    });

    game.fleets = (snapshot.fleets || []).map(fleet => ({ ...fleet }));
  },

  sendToPeer(peer, message) {
    if (!peer?.open || peer.channel?.readyState !== 'open') {
      return false;
    }

    peer.channel.send(JSON.stringify(message));
    return true;
  },

  broadcast(message) {
    this.hostPeers.forEach(peer => {
      this.sendToPeer(peer, message);
    });
  },

  broadcastSnapshot(force = false) {
    const now = performance.now();
    if (!force && now - this.lastSnapshotSentAt < CONFIG.MULTIPLAYER.SNAPSHOT_MS) {
      return;
    }

    this.lastSnapshotSentAt = now;
    this.broadcast({
      type: 'stateSnapshot',
      payload: {
        planets: game.planets.map(planet => ({
          id: planet.id,
          owner: planet.owner,
          ships: planet.ships
        })),
        fleets: game.fleets.map(fleet => ({ ...fleet }))
      }
    });
  },

  updateHostedGame(currentGame, dt) {
    if (currentGame.ended) {
      return;
    }

    currentGame.planets.forEach(planet => {
      if (planet.owner !== null) {
        planet.ships += Utils.productionRate(planet) * dt;
      }
      planet.shipsDisplay = Utils.approach(planet.shipsDisplay, planet.ships, 0.15);
    });

    for (let i = currentGame.fleets.length - 1; i >= 0; i--) {
      const fleet = currentGame.fleets[i];
      fleet.t += dt;

      if (fleet.t >= fleet.travel) {
        currentGame.arriveFleet(fleet);
        currentGame.fleets.splice(i, 1);
      }
    }

    this.checkGameEnd(currentGame);
    this.broadcastSnapshot();
  },

  applyFleetCommand(playerId, fromId, toId, pct) {
    if (!this.isHost || game.mode !== CONFIG.GAME_MODES.MULTIPLAYER || game.ended) {
      return false;
    }

    const from = game.planets.find(planet => planet.id === fromId);
    const to = game.planets.find(planet => planet.id === toId);
    if (!from || !to || from.id === to.id) return false;
    if (from.owner !== playerId) return false;

    const clampedPct = Utils.clamp(pct, CONFIG.GAME.SEND_MIN, CONFIG.GAME.SEND_MAX);
    const amount = Math.floor(from.ships * clampedPct);
    if (amount <= 0) return false;

    from.ships -= amount;
    game.fleets.push(game.createFleet(from, to, playerId, amount));
    this.broadcastSnapshot(true);
    return true;
  },

  checkGameEnd(currentGame) {
    if (!this.isHost || currentGame.ended) return;

    const activePlayers = new Set();
    currentGame.planets.forEach(planet => {
      const player = this.players.find(entry => entry.id === planet.owner);
      if (planet.owner && player?.connected) {
        activePlayers.add(planet.owner);
      }
    });

    currentGame.fleets.forEach(fleet => {
      const player = this.players.find(entry => entry.id === fleet.owner);
      if (player?.connected) {
        activePlayers.add(fleet.owner);
      }
    });

    if (this.connectedPlayers().length < 2 || activePlayers.size > 1) {
      return;
    }

    const winnerId = activePlayers.size === 1 ? Array.from(activePlayers)[0] : null;
    const winner = winnerId ? this.players.find(player => player.id === winnerId) : null;
    this.broadcast({
      type: 'gameEnded',
      payload: {
        winner: winner ? { id: winner.id, name: winner.name } : null
      }
    });
    currentGame.end(winner ? { id: winner.id, name: winner.name } : null);
  },

  async startGame() {
    if (!this.isHost) return;

    if (!this.canStartGame()) {
      alert('Дождитесь подключения всех игроков перед стартом.');
      return;
    }

    const activePlayers = this.connectedPlayers();
    const planets = game.createMultiplayerMap(activePlayers);

    try {
      await this.request('start_game.php', this.currentAuthPayload());
      this.matchActive = true;
      this.roomStatus = 'playing';
      this.lastSnapshotSentAt = 0;
      this.players = this.decoratePlayers(activePlayers);

      menu.hide();
      document.getElementById('gameUI').classList.remove('hidden');
      game.startMultiplayer({
        planets,
        fleets: [],
        players: this.players,
        playerId: this.playerId
      });

      this.broadcast({
        type: 'gameStarted',
        payload: {
          planets,
          fleets: [],
          players: this.players
        }
      });
      this.broadcastSnapshot(true);
    } catch (error) {
      alert(error.message);
    }
  },

  sendFleet(fromId, toId, pct) {
    if (!this.roomId || !this.playerId) return;

    if (this.isHost) {
      this.applyFleetCommand(this.playerId, fromId, toId, pct);
      return;
    }

    if (!this.sendToPeer(this.guestPeer, {
      type: 'fleetCommand',
      fromId,
      toId,
      pct
    })) {
      alert('Нет соединения с хостом.');
    }
  },

  async leaveRoom(options = {}) {
    const { keepMenuState = false } = options;
    const auth = this.currentAuthPayload();
    const hadRoom = !!this.roomId;

    this.stopRoomSessionTimers();
    this.matchActive = false;

    try {
      if (hadRoom) {
        await this.request('leave_room.php', auth);
      }
    } catch (error) {
      console.error(error);
    }

    this.resetSession();

    if (!keepMenuState) {
      menu.showScreen('multiplayerMenu');
    }
  },

  sendLeaveBeacon() {
    if (!navigator.sendBeacon || !this.roomId || !this.playerId || !this.playerSecret) {
      return;
    }

    const payload = JSON.stringify(this.currentAuthPayload());
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon(`${CONFIG.MULTIPLAYER.API_BASE}/leave_room.php`, blob);
  },

  resetMatchState() {
    this.matchActive = false;
    this.lastSnapshotSentAt = 0;
  },

  /**
   * Мягкий выход из сессии (комната закрыта / хост ушёл)
   */
  handleSessionLost() {
    if (!this.roomId) return;
    this.resetSession();

    if (game.mode === CONFIG.GAME_MODES.MULTIPLAYER) {
      game.state = CONFIG.GAME_STATES.MENU;
      game.mode = null;
      document.getElementById('gameUI').classList.add('hidden');
      document.getElementById('pauseMenu').classList.add('hidden');
      document.getElementById('gameOverScreen').classList.add('hidden');
      menu.show();
    }
    menu.showScreen('multiplayerMenu');
    menu.updateLobbyStatus('Хост покинул комнату');
  },

  resetSession() {
    this.stopRoomsPolling();
    this.stopRoomSessionTimers();
    this.hostPeers.forEach((_, playerId) => this.closeHostPeer(playerId));
    this.hostPeers.clear();
    this.closeGuestPeer();
    this.resetMatchState();

    this.roomId = null;
    this.roomName = '';
    this.roomStatus = 'waiting';
    this.roomMaxPlayers = 2;
    this.playerId = null;
    this.playerSecret = null;
    this.players = [];
    this.isHost = false;
    this.lastSignalId = 0;
    this.signalPollInFlight = false;
  }
};

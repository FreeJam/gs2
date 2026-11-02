/**
 * Управление меню
 */
const menu = {
  currentScreen: 'mainMenu',
  screens: [],
  screenAliases: {
    mainMenu: 'mainMenu',
    singleplayer: 'singleplayerMenu',
    singleplayerMenu: 'singleplayerMenu',
    multiplayer: 'multiplayerMenu',
    multiplayerMenu: 'multiplayerMenu',
    settings: 'settingsMenu',
    settingsMenu: 'settingsMenu',
    help: 'helpMenu',
    helpMenu: 'helpMenu',
    createRoom: 'createRoom',
    roomLobby: 'roomLobby'
  },
  
  /**
   * Инициализация меню
   */
  init() {
    this.screens = document.querySelectorAll('.menu-screen');
    this.bindEvents();
    this.loadPlayerName();
    this.setMenuActiveState(!document.getElementById('menu')?.classList.contains('hidden'));
  },
  
  /**
   * Привязка событий
   */
  bindEvents() {
    // Полноэкранный режим
    document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
      Utils.fullscreen.toggle();
    });
    
    // Кнопка полноэкранного режима в игре
    document.getElementById('gameFullscreenBtn')?.addEventListener('click', () => {
      Utils.fullscreen.toggle();
    });
    
    // Сохранение имени игрока
    const playerNameInput = document.getElementById('playerName');
    playerNameInput?.addEventListener('change', (e) => {
      Utils.save(CONFIG.STORAGE.PLAYER_NAME, e.target.value);
    });
    
    // Обработка клавиши Escape в меню
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentScreen !== 'mainMenu') {
        this.goBack();
      }
    });
  },
  
  /**
   * Загрузить имя игрока
   */
  loadPlayerName() {
    const savedName = Utils.load(CONFIG.STORAGE.PLAYER_NAME, 'Игрок');
    const input = document.getElementById('playerName');
    if (input) {
      input.value = savedName;
    }
  },

  /**
   * Нормализовать идентификатор экрана
   */
  normalizeScreenId(screenId) {
    return this.screenAliases[screenId] || screenId;
  },
  
  /**
   * Показать экран
   */
  showScreen(screenId) {
    const normalizedScreenId = this.normalizeScreenId(screenId);
    const previousScreen = this.currentScreen;

    // Скрыть все экраны
    this.screens.forEach(screen => {
      screen.classList.remove('active');
    });
    
    // Показать нужный экран
    const targetScreen = document.getElementById(normalizedScreenId);
    if (!targetScreen) {
      console.warn(`Экран меню не найден: ${screenId}`);
      document.getElementById('mainMenu')?.classList.add('active');
      this.currentScreen = 'mainMenu';
      return;
    }

    targetScreen.classList.add('active');
    this.currentScreen = normalizedScreenId;
    multiplayer.handleScreenChange?.(normalizedScreenId, previousScreen);
    
    // Специальные действия для экранов
    if (normalizedScreenId === 'multiplayerMenu') {
      multiplayer.startRoomsPolling?.();
    }
  },
  
  /**
   * Назад
   */
  goBack() {
    const backMap = {
      'singleplayerMenu': 'mainMenu',
      'multiplayerMenu': 'mainMenu',
      'createRoom': 'multiplayerMenu',
      'roomLobby': 'multiplayerMenu',
      'settingsMenu': 'mainMenu',
      'helpMenu': 'mainMenu'
    };
    
    const prevScreen = backMap[this.currentScreen];
    if (prevScreen) {
      this.showScreen(prevScreen);
    }
  },

  /**
   * Переключить режим тач-скролла для меню
   */
  setMenuActiveState(isActive) {
    document.documentElement.classList.toggle('menu-active', isActive);
    document.body.classList.toggle('menu-active', isActive);
  },
  
  /**
   * Скрыть меню
   */
  hide() {
    this.setMenuActiveState(false);
    document.getElementById('menu').classList.add('hidden');
  },
  
  /**
   * Показать меню
   */
  show() {
    this.setMenuActiveState(true);
    document.getElementById('menu').classList.remove('hidden');
    this.showScreen('mainMenu');
  },
  
  /**
   * Показать лобби комнаты
   */
  showLobby(roomName, playerCount, maxPlayers) {
    document.getElementById('lobbyRoomName').textContent = roomName;
    document.getElementById('lobbyPlayerCount').textContent = `${playerCount} / ${maxPlayers} игроков`;
    this.showScreen('roomLobby');
  },
  
  /**
   * Обновить список игроков в лобби
   */
  updateLobbyPlayers(players, myId) {
    const container = document.getElementById('lobbyPlayers');
    container.innerHTML = '';
    
    players.forEach((player, index) => {
      const slot = document.createElement('div');
      slot.className = `player-slot ${player.id === myId ? 'you' : ''}`;
      
      const paletteIndex = typeof player.slotIndex === 'number' ? player.slotIndex : index;
      const palette = CONFIG.PLAYER_PALETTE;
      const color = palette[paletteIndex % palette.length];
      const colorStyle = color ? color.core.replace(/,\s*[\d.]+\)$/, ',1)') : '#fff';
      const isHost = !!player.isHost;
      const statusDot = player.connected ? '●' : '○';
      
      slot.innerHTML = `
        <div class="player-color" style="background: ${colorStyle}"></div>
        <span class="player-name">${player.name} ${player.id === myId ? '(Вы)' : ''}</span>
        ${isHost ? '<span class="host-badge">ХОСТ</span>' : ''}
        <span class="player-status">${statusDot}</span>
      `;
      
      container.appendChild(slot);
    });
    
    // Обновить кнопку начала игры
    const startBtn = document.getElementById('startGameBtn');
    const isHost = players.some(player => player.id === myId && player.isHost);
    startBtn.disabled = !isHost || players.length < 2;
  },
  
  /**
   * Обновить статус в лобби
   */
  updateLobbyStatus(status) {
    const statusEl = document.getElementById('lobbyStatus');
    if (statusEl) {
      statusEl.textContent = status;
    }
  }
};

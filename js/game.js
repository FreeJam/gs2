/**
 * Основная игровая логика
 */
const game = {
  // Canvas
  canvas: null,
  ctx: null,
  DPR: 1,
  
  // Размеры
  width: 0,
  height: 0,
  prevWidth: null,
  prevHeight: null,
  
  // Состояние
  state: CONFIG.GAME_STATES.MENU,
  mode: null,
  
  // Игровые объекты
  planets: [],
  fleets: [],
  players: [],
  myPlayerId: null,
  effects: [],
  
  // Выбор
  selectedPlanetId: null,
  sendPct: CONFIG.GAME.DEFAULT_SEND_PCT,

  // Камера / viewport
  camera: {
    x: 0,
    y: 0,
    zoom: 1,
    velocityX: 0,
    velocityY: 0,
    panning: false,
    pointerId: null,
    lastScreenX: 0,
    lastScreenY: 0,
    moved: false
  },
  
  // Drag
  drag: {
    active: false,
    pointerId: null,
    fromId: null,
    startX: 0,
    startY: 0,
    startScreenX: 0,
    startScreenY: 0,
    x: 0,
    y: 0,
    targetId: null,
    moved: false
  },
  
  // AI
  aiPlayers: [],
  singleplayerDifficulty: 'easy',
  
  // Loop
  lastTime: 0,
  animationId: null,
  ended: false,
  winner: null,
  
  /**
   * Инициализация
   */
  init() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.DPR = Utils.getDPR();
    
    this.resize();
    this.bindEvents();
    this.setupUI();
    
    // Запустить меню
    menu.init();
    
    // Стартовать луп
    this.lastTime = performance.now();
    this.loop();
  },
  
  /**
   * Привязка событий
   */
  bindEvents() {
    // Resize
    window.addEventListener('resize', () => {
      this.resize();
    });
    
    // Клавиатура
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    
    // Колёсико
    document.addEventListener('wheel', (e) => {
      if (this.state === CONFIG.GAME_STATES.PLAYING) {
        this.setSendPct(this.sendPct + (e.deltaY < 0 ? CONFIG.GAME.SEND_STEP : -CONFIG.GAME.SEND_STEP));
      }
    }, { passive: true });
    
    // Pointer события
    this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
    this.canvas.addEventListener('pointercancel', (e) => this.handlePointerUp(e));
    
    // UI кнопки
    document.getElementById('pauseBtn')?.addEventListener('click', () => this.pause());
    document.getElementById('menuBtn')?.addEventListener('click', () => this.toMenu());
  },
  
  /**
   * Настройка UI
   */
  setupUI() {
    // Кнопки процента отправки
    const chipButtons = document.querySelectorAll('.chip[data-pct]');
    chipButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.setSendPct(parseFloat(btn.dataset.pct));
      });
    });
    
    this.syncChips();
  },
  
  /**
   * Изменение размера
   */
  resize() {
    const newW = Math.floor(window.innerWidth * this.DPR);
    const newH = Math.floor(window.innerHeight * this.DPR);

    this.canvas.width = newW;
    this.canvas.height = newH;
    this.width = newW;
    this.height = newH;

    this.rebuildFleetTravel();
    this.resetCamera(this.mode === CONFIG.GAME_MODES.MULTIPLAYER || Utils.isMobile());
    this.prevWidth = newW;
    this.prevHeight = newH;
  },

  /**
   * Пересчитать время полёта после смены DPR/масштаба
   */
  rebuildFleetTravel() {
    if (this.mode === CONFIG.GAME_MODES.MULTIPLAYER && !multiplayer.isHost) {
      return;
    }

    this.fleets.forEach(fleet => {
      const distance = Math.hypot(fleet.tx - fleet.sx, fleet.ty - fleet.sy);
      fleet.travel = distance / (CONFIG.GAME.FLEET_SPEED * this.DPR);
      fleet.t = Math.min(fleet.t, fleet.travel);
    });
  },

  /**
   * Получить границы мира по планетам
   */
  getWorldBounds() {
    if (!this.planets.length) {
      return {
        minX: 0,
        minY: 0,
        maxX: this.width || 1,
        maxY: this.height || 1
      };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    this.planets.forEach(planet => {
      minX = Math.min(minX, planet.x - planet.r * 2);
      minY = Math.min(minY, planet.y - planet.r * 2);
      maxX = Math.max(maxX, planet.x + planet.r * 2);
      maxY = Math.max(maxY, planet.y + planet.r * 2);
    });

    return { minX, minY, maxX, maxY };
  },

  /**
   * Сбросить камеру и вписать карту в экран при необходимости
   */
  resetCamera(fitToScreen = false) {
    const bounds = this.getWorldBounds();
    const worldWidth = Math.max(1, bounds.maxX - bounds.minX);
    const worldHeight = Math.max(1, bounds.maxY - bounds.minY);
    const padding = 28 * this.DPR;
    const shouldFit = fitToScreen || Utils.isMobile();
    const fitZoom = shouldFit
      ? Math.min(
          1,
          (this.width - padding * 2) / worldWidth,
          (this.height - padding * 2) / worldHeight
        )
      : 1;

    this.camera.zoom = Utils.clamp(fitZoom || 1, 0.45, 1.25);
    this.camera.velocityX = 0;
    this.camera.velocityY = 0;
    this.camera.panning = false;
    this.camera.pointerId = null;
    this.centerCameraOnBounds(bounds);
    this.clampCamera(bounds);
  },

  /**
   * Центрировать карту
   */
  centerCameraOnBounds(bounds = this.getWorldBounds()) {
    const centerX = (bounds.minX + bounds.maxX) * 0.5;
    const centerY = (bounds.minY + bounds.maxY) * 0.5;

    this.camera.x = this.width * 0.5 - centerX * this.camera.zoom;
    this.camera.y = this.height * 0.5 - centerY * this.camera.zoom;
  },

  /**
   * Ограничить камеру границами карты
   */
  clampCamera(bounds = this.getWorldBounds()) {
    const padding = 18 * this.DPR;
    const minOffsetX = this.width - padding - bounds.maxX * this.camera.zoom;
    const maxOffsetX = padding - bounds.minX * this.camera.zoom;
    const minOffsetY = this.height - padding - bounds.maxY * this.camera.zoom;
    const maxOffsetY = padding - bounds.minY * this.camera.zoom;

    if (minOffsetX > maxOffsetX) {
      this.camera.x = (minOffsetX + maxOffsetX) * 0.5;
    } else {
      this.camera.x = Utils.clamp(this.camera.x, minOffsetX, maxOffsetX);
    }

    if (minOffsetY > maxOffsetY) {
      this.camera.y = (minOffsetY + maxOffsetY) * 0.5;
    } else {
      this.camera.y = Utils.clamp(this.camera.y, minOffsetY, maxOffsetY);
    }
  },

  /**
   * Конвертация мира в экран
   */
  worldToScreenPoint(x, y) {
    return {
      x: x * this.camera.zoom + this.camera.x,
      y: y * this.camera.zoom + this.camera.y
    };
  },

  screenToWorldPoint(x, y) {
    return {
      x: (x - this.camera.x) / this.camera.zoom,
      y: (y - this.camera.y) / this.camera.zoom
    };
  },

  worldToScreenLength(value) {
    return value * this.camera.zoom;
  },

  /**
   * Начать touch-pan камеры
   */
  startCameraPan(pointerId, screenX, screenY) {
    this.camera.panning = true;
    this.camera.pointerId = pointerId;
    this.camera.lastScreenX = screenX;
    this.camera.lastScreenY = screenY;
    this.camera.moved = false;
    this.camera.velocityX = 0;
    this.camera.velocityY = 0;
  },

  moveCameraPan(pointerId, screenX, screenY) {
    if (!this.camera.panning || this.camera.pointerId !== pointerId) {
      return;
    }

    const dx = screenX - this.camera.lastScreenX;
    const dy = screenY - this.camera.lastScreenY;

    if (Math.abs(dx) + Math.abs(dy) > 0.5) {
      this.camera.moved = true;
    }

    this.camera.x += dx;
    this.camera.y += dy;
    this.camera.velocityX = dx;
    this.camera.velocityY = dy;
    this.camera.lastScreenX = screenX;
    this.camera.lastScreenY = screenY;
    this.clampCamera();
  },

  endCameraPan(pointerId) {
    if (!this.camera.panning || this.camera.pointerId !== pointerId) {
      return false;
    }

    const moved = this.camera.moved;
    this.camera.panning = false;
    this.camera.pointerId = null;
    this.camera.moved = false;
    return moved;
  },

  /**
   * Плавная инерция камеры
   */
  updateCamera(dt) {
    if (this.camera.panning) {
      return;
    }

    const frameScale = dt * 60;
    const damping = Math.pow(0.88, frameScale);
    this.camera.x += this.camera.velocityX * frameScale;
    this.camera.y += this.camera.velocityY * frameScale;
    this.camera.velocityX *= damping;
    this.camera.velocityY *= damping;

    if (Math.abs(this.camera.velocityX) < 0.05) {
      this.camera.velocityX = 0;
    }
    if (Math.abs(this.camera.velocityY) < 0.05) {
      this.camera.velocityY = 0;
    }

    this.clampCamera();
  },
  
  /**
   * Обработка клавиш
   */
  handleKeyDown(e) {
    if (this.state !== CONFIG.GAME_STATES.PLAYING) return;
    
    switch (e.key) {
      case 'Escape':
        this.selectedPlanetId = null;
        this.cancelDrag();
        break;
      case '[':
        this.setSendPct(this.sendPct - CONFIG.GAME.SEND_STEP);
        break;
      case ']':
        this.setSendPct(this.sendPct + CONFIG.GAME.SEND_STEP);
        break;
      case 'r':
      case 'R':
        if (this.ended) this.restart();
        break;
      case 'p':
      case 'P':
        this.pause();
        break;
    }
  },
  
  /**
   * Pointer down
   */
  handlePointerDown(e) {
    if (this.state !== CONFIG.GAME_STATES.PLAYING || this.ended) return;
    
    this.canvas.setPointerCapture(e.pointerId);
    const screenPos = Utils.getPointerPos(e, this.canvas);
    const pos = this.screenToWorldPoint(screenPos.x, screenPos.y);
    const planet = this.getPlanetAt(pos.x, pos.y);
    
    if (!planet) {
      if (Utils.isTouch() || e.pointerType === 'touch') {
        this.startCameraPan(e.pointerId, screenPos.x, screenPos.y);
      } else {
        this.selectedPlanetId = null;
        this.cancelDrag();
      }
      return;
    }
    
    // Проверяем, наша ли планета
    const isMyPlanet = this.isMyPlanet(planet);
    
    if (isMyPlanet) {
      this.selectedPlanetId = planet.id;
      
      this.drag.active = true;
      this.drag.pointerId = e.pointerId;
      this.drag.fromId = planet.id;
      this.drag.startX = pos.x;
      this.drag.startY = pos.y;
      this.drag.startScreenX = screenPos.x;
      this.drag.startScreenY = screenPos.y;
      this.drag.x = pos.x;
      this.drag.y = pos.y;
      this.drag.targetId = null;
      this.drag.moved = false;
      
      Utils.vibrate(20);
    } else if (this.selectedPlanetId !== null) {
      // Отправить на чужую планету
      const from = this.planets.find(p => p.id === this.selectedPlanetId);
      if (from && this.isMyPlanet(from)) {
        this.sendFleet(from, planet);
      }
    }
  },
  
  /**
   * Pointer move
   */
  handlePointerMove(e) {
    const screenPos = Utils.getPointerPos(e, this.canvas);

    if (this.camera.panning && this.camera.pointerId === e.pointerId) {
      this.moveCameraPan(e.pointerId, screenPos.x, screenPos.y);
      return;
    }

    if (!this.drag.active || this.drag.pointerId !== e.pointerId) return;
    
    const pos = this.screenToWorldPoint(screenPos.x, screenPos.y);
    this.drag.x = pos.x;
    this.drag.y = pos.y;
    
    if (!this.drag.moved) {
      const d = Utils.dist(this.drag.startScreenX, this.drag.startScreenY, screenPos.x, screenPos.y);
      if (d >= CONFIG.GAME.DRAG_THRESHOLD * this.DPR) {
        this.drag.moved = true;
      }
    }
    
    if (this.drag.moved) {
      const from = this.planets.find(p => p.id === this.drag.fromId);
      const target = from ? this.findDragTarget(from, pos.x, pos.y) : null;
      this.drag.targetId = target ? target.id : null;
    }
  },
  
  /**
   * Pointer up
   */
  handlePointerUp(e) {
    if (this.camera.pointerId === e.pointerId) {
      const moved = this.endCameraPan(e.pointerId);
      if (!moved) {
        this.selectedPlanetId = null;
        this.cancelDrag();
      }
      return;
    }

    if (this.drag.pointerId !== e.pointerId) return;
    
    const from = this.planets.find(p => p.id === this.drag.fromId);
    
    if (!this.drag.moved) {
      this.cancelDrag();
      return;
    }
    
    if (from && this.drag.targetId !== null) {
      const to = this.planets.find(p => p.id === this.drag.targetId);
      if (to) {
        this.sendFleet(from, to);
      }
    }
    
    this.cancelDrag();
  },
  
  /**
   * Отменить drag
   */
  cancelDrag() {
    this.drag.active = false;
    this.drag.pointerId = null;
    this.drag.fromId = null;
    this.drag.targetId = null;
    this.drag.moved = false;
  },
  
  /**
   * Проверить, наша ли планета
   */
  isMyPlanet(planet) {
    if (this.mode === CONFIG.GAME_MODES.SINGLEPLAYER) {
      return planet.owner === CONFIG.OWNER.YOU;
    } else {
      return planet.owner === this.myPlayerId;
    }
  },
  
  /**
   * Получить планету по координатам
   */
  getPlanetAt(x, y) {
    for (let i = this.planets.length - 1; i >= 0; i--) {
      const p = this.planets[i];
      if (Utils.dist(x, y, p.x, p.y) <= p.r) {
        return p;
      }
    }
    return null;
  },

  /**
   * Найти цель по drag-направлению
   */
  findDragTarget(from, x, y) {
    const directTarget = this.getPlanetAt(x, y);
    if (directTarget && directTarget.id !== from.id) {
      return directTarget;
    }

    return this.getAimAssistTarget(from, x, y);
  },

  /**
   * Автоприцел по направлению drag
   */
  getAimAssistTarget(from, x, y) {
    const dragDx = x - from.x;
    const dragDy = y - from.y;
    const dragLen = Math.hypot(dragDx, dragDy);

    if (dragLen < (from.r + 10 * this.DPR)) {
      return null;
    }

    let bestTarget = null;
    let bestScore = -Infinity;

    for (const planet of this.planets) {
      if (planet.id === from.id) continue;

      const toDx = planet.x - from.x;
      const toDy = planet.y - from.y;
      const targetDist = Math.hypot(toDx, toDy);
      if (targetDist < 1) continue;

      const alignment = (dragDx * toDx + dragDy * toDy) / (dragLen * targetDist);
      if (alignment < CONFIG.GAME.AIM_ASSIST_ALIGNMENT) continue;

      const projection = (dragDx * toDx + dragDy * toDy) / targetDist;
      const minProjection = Math.max(
        from.r + 10 * this.DPR,
        Math.min(targetDist * CONFIG.GAME.AIM_ASSIST_PROGRESS, 90 * this.DPR)
      );
      if (projection < minProjection) continue;

      const lateralDistance = Math.abs(dragDx * toDy - dragDy * toDx) / dragLen;
      const captureRadius = planet.r + CONFIG.GAME.AIM_ASSIST_PADDING * this.DPR;
      if (lateralDistance > captureRadius) continue;

      const stickiness = this.drag.targetId === planet.id ? 18 : 0;
      const score =
        alignment * 200 +
        Math.min(projection, targetDist) * 0.12 -
        lateralDistance * 2.1 -
        targetDist * 0.05 +
        stickiness;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = planet;
      }
    }

    return bestTarget;
  },

  /**
   * Тип взаимодействия с целью
   */
  getEngagementMode(from, to) {
    if (!from || !to) return null;
    if (to.owner === from.owner) return 'reinforce';

    const isNeutral =
      this.mode === CONFIG.GAME_MODES.SINGLEPLAYER
        ? to.owner === CONFIG.OWNER.NEUTRAL
        : to.owner === null;

    return isNeutral ? 'capture' : 'attack';
  },
  
  /**
   * Отправить флот
   */
  sendFleet(from, to, ownerOverride = null, pctOverride = this.sendPct) {
    const owner = ownerOverride ?? from.owner;
    const isAIOrder = ownerOverride !== null && ownerOverride !== undefined;
    const canSend = isAIOrder ? from.owner === owner : this.isMyPlanet(from);
    if (!canSend) return;
    if (from.id === to.id) return;
    
    const pct = Utils.clamp(pctOverride, CONFIG.GAME.SEND_MIN, CONFIG.GAME.SEND_MAX);
    const amount = Math.floor(from.ships * pct);
    if (amount <= 0) return;
    
    // В одиночной игре
    if (this.mode === CONFIG.GAME_MODES.SINGLEPLAYER) {
      from.ships -= amount;
      this.fleets.push(this.createFleet(from, to, owner, amount));
    } else {
      // В мультиплеере отправляем на сервер
      multiplayer.sendFleet(from.id, to.id, pct);
    }
    
    if (!isAIOrder) {
      Utils.vibrate(30);
    }
  },
  
  /**
   * Создать флот
   */
  createFleet(from, to, owner, count) {
    const d = Utils.dist(from.x, from.y, to.x, to.y);
    const travel = d / (CONFIG.GAME.FLEET_SPEED * this.DPR);
    
    return {
      owner,
      count,
      fromId: from.id,
      toId: to.id,
      t: 0,
      travel,
      sx: from.x,
      sy: from.y,
      tx: to.x,
      ty: to.y
    };
  },
  
  /**
   * Прибытие флота
   */
  arriveFleet(fleet) {
    const to = this.planets.find(p => p.id === fleet.toId);
    if (!to) return;
    
    const myId = this.mode === CONFIG.GAME_MODES.SINGLEPLAYER ? CONFIG.OWNER.YOU : this.myPlayerId;
    
    if (to.owner === fleet.owner) {
      to.ships += fleet.count;
      this.spawnExplosion(to.x, to.y, this.ownerColor(to.owner), false);
    } else {
      const remaining = to.ships - fleet.count;
      if (remaining >= 0) {
        to.ships = remaining;
        this.spawnExplosion(to.x, to.y, this.ownerColor(fleet.owner), false);
      } else {
        to.owner = fleet.owner;
        to.ships = Math.abs(remaining);

        // Neon-взрыв при захвате
        this.spawnExplosion(to.x, to.y, this.ownerColor(fleet.owner), true);

        // Вибрация при захвате
        if (fleet.owner === myId) {
          Utils.vibrate([50, 30, 50]);
        }
      }
    }
  },

  /**
   * Цвет владельца для эффектов
   */
  ownerColor(owner) {
    if (this.mode === CONFIG.GAME_MODES.SINGLEPLAYER) {
      if (owner === CONFIG.OWNER.YOU) return CONFIG.COLORS.YOU.core;
      if (owner === CONFIG.OWNER.NEUTRAL) return CONFIG.COLORS.NEUTRAL.core;
      return CONFIG.COLORS.AI.core;
    }
    const player = this.players.find(p => p.id === owner);
    return player?.color?.core || CONFIG.COLORS.NEUTRAL.core;
  },

  /**
   * Neon-взрыв: кольцо + разлетающиеся искры
   */
  spawnExplosion(x, y, color, big) {
    const life = CONFIG.GRAPHICS.EFFECT_LIFE;
    const baseCount = CONFIG.GRAPHICS.EFFECT_PARTICLES || 10;
    const count = big ? baseCount : Math.max(3, Math.round(baseCount / 2));

    this.effects.push({
      type: 'ring', x, y, vx: 0, vy: 0,
      life, maxLife: life, color, size: big ? 15 : 8
    });

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Utils.rand(22, big ? 95 : 55);
      this.effects.push({
        type: 'spark', x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: life * Utils.rand(0.5, 1),
        maxLife: life,
        color,
        size: Utils.rand(1.6, 3.2)
      });
    }

    if (this.effects.length > 260) {
      this.effects.splice(0, this.effects.length - 260);
    }
  },

  /**
   * Обновление эффектов
   */
  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.vx *= 0.94;
      e.vy *= 0.94;
      e.life -= dt;
      if (e.life <= 0) this.effects.splice(i, 1);
    }
  },
  
  /**
   * Установить процент отправки
   */
  setSendPct(pct) {
    this.sendPct = Utils.clamp(pct, CONFIG.GAME.SEND_MIN, CONFIG.GAME.SEND_MAX);
    document.getElementById('sendPct').textContent = Utils.formatPercent(this.sendPct);
    this.syncChips();
  },
  
  /**
   * Синхронизировать чипы
   */
  syncChips() {
    const chipButtons = document.querySelectorAll('.chip[data-pct]');
    chipButtons.forEach(btn => {
      const p = parseFloat(btn.dataset.pct);
      const isActive = Math.abs(p - this.sendPct) < 0.001;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', isActive);
    });
  },
  
  // ==================== ИГРОВЫЕ РЕЖИМЫ ====================
  
  /**
   * Начать одиночную игру
   */
  startSingleplayer(aiCount = 1) {
    multiplayer.resetMatchState?.();
    this.mode = CONFIG.GAME_MODES.SINGLEPLAYER;
    this.singleplayerDifficulty = this.getSingleplayerDifficulty(aiCount);
    this.state = CONFIG.GAME_STATES.PLAYING;
    this.ended = false;
    this.winner = null;
    this.players = [];
    this.myPlayerId = null;
    this.selectedPlanetId = null;
    this.effects = [];
    this.cancelDrag();
    
    menu.hide();
    document.getElementById('gameUI').classList.remove('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    
    this.generateMap(aiCount);
    this.setupAI(aiCount);
    this.resetCamera(Utils.isMobile());
    
    this.lastTime = performance.now();
  },
  
  /**
   * Начать мультиплеер
   */
  startMultiplayer(data) {
    this.mode = CONFIG.GAME_MODES.MULTIPLAYER;
    this.singleplayerDifficulty = 'easy';
    this.state = CONFIG.GAME_STATES.PLAYING;
    this.ended = false;
    this.winner = null;
    this.selectedPlanetId = null;
    this.aiPlayers = [];
    this.effects = [];
    this.cancelDrag();
    
    document.getElementById('pauseMenu').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    
    this.planets = data.planets.map(p => ({
      ...p,
      shipsDisplay: p.ships
    }));
    this.fleets = (data.fleets || []).map(f => ({ ...f }));
    this.players = (data.players || []).map(player => ({ ...player }));
    this.myPlayerId = data.playerId || multiplayer.playerId;
    if (multiplayer.isHost) {
      this.rebuildFleetTravel();
    }
    this.resetCamera(true);
    
    this.lastTime = performance.now();
  },
  
  /**
   * Генерация карты
   */
  generateMap(aiCount = 1) {
    this.planets = [];
    this.fleets = [];
    this.selectedPlanetId = null;
    this.cancelDrag();
    const difficulty = this.getSingleplayerDifficulty(aiCount);
    const aiBalance = {
      easy: { ships: 30, prodMul: 0.94 },
      medium: { ships: 32, prodMul: 0.98 },
      hard: { ships: 34, prodMul: 1.01 }
    }[difficulty];
    
    const W = this.width;
    const H = this.height;
    const padding = CONFIG.MAP.PADDING * this.DPR;
    
    // Стартовая планета игрока
    const you = {
      id: 'planet_you',
      x: padding,
      y: H * 0.5,
      r: CONFIG.MAP.PLAYER_PLANET_RADIUS * this.DPR,
      owner: CONFIG.OWNER.YOU,
      ships: CONFIG.MAP.PLAYER_START_SHIPS,
      prodMul: 1.05,
      shipsDisplay: CONFIG.MAP.PLAYER_START_SHIPS
    };
    this.planets.push(you);
    
    // Стартовые планеты AI
    const aiPositions = [
      { x: W - padding, y: H * 0.5 },
      { x: W * 0.5, y: padding },
      { x: W * 0.5, y: H - padding }
    ];
    
    for (let i = 0; i < aiCount && i < aiPositions.length; i++) {
      const pos = aiPositions[i];
      this.planets.push({
        id: `planet_ai_${i}`,
        x: pos.x,
        y: pos.y,
        r: CONFIG.MAP.PLAYER_PLANET_RADIUS * this.DPR,
        owner: CONFIG.OWNER.AI + i,
        ships: aiBalance.ships,
        prodMul: aiBalance.prodMul,
        shipsDisplay: aiBalance.ships
      });
    }
    
    // Нейтральные планеты
    const n = CONFIG.MAP.NEUTRAL_COUNT_BASE;
    for (let i = 0; i < n; i++) {
      let tries = 0;
      while (tries++ < 200) {
        const r = Utils.rand(CONFIG.MAP.MIN_PLANET_RADIUS, CONFIG.MAP.MAX_PLANET_RADIUS) * this.DPR;
        const x = Utils.rand(padding + 40 * this.DPR, W - padding - 40 * this.DPR);
        const y = Utils.rand(padding, H - padding);
        
        let ok = true;
        for (const p of this.planets) {
          if (Utils.dist(x, y, p.x, p.y) < (r + p.r + CONFIG.MAP.MIN_DISTANCE_BETWEEN * this.DPR)) {
            ok = false;
            break;
          }
        }
        
        if (!ok) continue;
        
        this.planets.push({
          id: `planet_${this.planets.length}`,
          x, y, r,
          owner: CONFIG.OWNER.NEUTRAL,
          ships: Math.round(Utils.rand(CONFIG.MAP.NEUTRAL_MIN_SHIPS, CONFIG.MAP.NEUTRAL_MAX_SHIPS)),
          prodMul: Utils.rand(0.85, 1.25),
          shipsDisplay: 0
        });
        break;
      }
    }
  },

  /**
   * Генерация карты для браузерного хост-мультиплеера
   */
  createMultiplayerMap(players) {
    this.selectedPlanetId = null;
    this.cancelDrag();

    const W = this.width;
    const H = this.height;
    const padding = CONFIG.MAP.PADDING * this.DPR;
    const planets = [];
    const playerPositions = [
      { x: padding, y: H * 0.5 },
      { x: W - padding, y: H * 0.5 },
      { x: W * 0.5, y: padding },
      { x: W * 0.5, y: H - padding }
    ];

    players.forEach((player, index) => {
      const pos = playerPositions[index] || playerPositions[player.slotIndex] || playerPositions[0];
      planets.push({
        id: `planet_player_${index}`,
        x: pos.x,
        y: pos.y,
        r: CONFIG.MAP.PLAYER_PLANET_RADIUS * this.DPR,
        owner: player.id,
        ships: CONFIG.MAP.PLAYER_START_SHIPS,
        prodMul: 1.05,
        shipsDisplay: CONFIG.MAP.PLAYER_START_SHIPS
      });
    });

    const neutralCount = 8 + players.length * 2;
    for (let i = 0; i < neutralCount; i++) {
      let tries = 0;
      while (tries++ < 200) {
        const r = Utils.rand(CONFIG.MAP.MIN_PLANET_RADIUS, CONFIG.MAP.MAX_PLANET_RADIUS) * this.DPR;
        const x = Utils.rand(padding + 40 * this.DPR, W - padding - 40 * this.DPR);
        const y = Utils.rand(padding, H - padding);

        let ok = true;
        for (const planet of planets) {
          if (Utils.dist(x, y, planet.x, planet.y) < (r + planet.r + CONFIG.MAP.MIN_DISTANCE_BETWEEN * this.DPR)) {
            ok = false;
            break;
          }
        }

        if (!ok) continue;

        planets.push({
          id: `planet_${planets.length}`,
          x,
          y,
          r,
          owner: null,
          ships: Math.round(Utils.rand(CONFIG.MAP.NEUTRAL_MIN_SHIPS, CONFIG.MAP.NEUTRAL_MAX_SHIPS)),
          prodMul: Utils.rand(0.85, 1.25),
          shipsDisplay: 0
        });
        break;
      }
    }

    return planets;
  },
  
  /**
   * Настроить AI
   */
  setupAI(aiCount) {
    this.aiPlayers = [];
    const difficulty = this.getSingleplayerDifficulty(aiCount);
    const personalities = AI.pickPersonalities(difficulty, aiCount);

    for (let i = 0; i < aiCount; i++) {
      this.aiPlayers.push(
        AI.create(CONFIG.OWNER.AI + i, difficulty, personalities[i])
      );
    }
  },

  /**
   * Определить сложность по количеству ИИ
   */
  getSingleplayerDifficulty(aiCount) {
    if (aiCount <= 1) return 'easy';
    if (aiCount === 2) return 'medium';
    return 'hard';
  },
  
  /**
   * AI мышление
   */
  aiThink(dt) {
    this.aiPlayers.forEach(ai => {
      AI.think(ai, this, dt);
    });
  },
  
  /**
   * Проверить условия победы
   */
  checkEnd() {
    if (this.mode === CONFIG.GAME_MODES.SINGLEPLAYER) {
      const you = this.planets.some(p => p.owner === CONFIG.OWNER.YOU);
      const aiExists = this.planets.some(p => p.owner >= CONFIG.OWNER.AI);
      
      if (!you || !aiExists) {
        this.ended = true;
        this.winner = you ? { name: 'Ты победил!' } : { name: 'ИИ победил' };
        this.end(this.winner);
      }
    } else if (this.mode === CONFIG.GAME_MODES.MULTIPLAYER && multiplayer.isHost) {
      multiplayer.checkGameEnd(this);
    }
  },
  
  /**
   * Окончание игры
   */
  end(winner) {
    if (this.ended && this.state === CONFIG.GAME_STATES.ENDED) {
      return;
    }

    this.ended = true;
    this.winner = winner;
    this.state = CONFIG.GAME_STATES.ENDED;
    multiplayer.matchActive = false;
    
    const gameOverScreen = document.getElementById('gameOverScreen');
    const winnerText = document.getElementById('winnerText');
    const gameStats = document.getElementById('gameStats');
    
    winnerText.textContent = winner ? `${winner.name} победил!` : 'Ничья!';
    
    // Статистика
    const myPlanets = this.planets.filter(p => this.isMyPlanet(p)).length;
    gameStats.innerHTML = `
      <div>Ваших планет: ${myPlanets} / ${this.planets.length}</div>
      <div>Отправлено флотов: ${this.fleets.length}</div>
    `;
    
    gameOverScreen.classList.remove('hidden');
    Utils.vibrate([100, 50, 100, 50, 200]);
  },
  
  /**
   * Пауза
   */
  pause() {
    if (this.state === CONFIG.GAME_STATES.PLAYING) {
      this.state = CONFIG.GAME_STATES.PAUSED;
      document.getElementById('pauseMenu').classList.remove('hidden');
    }
  },
  
  /**
   * Продолжить
   */
  resume() {
    if (this.state === CONFIG.GAME_STATES.PAUSED) {
      this.state = CONFIG.GAME_STATES.PLAYING;
      document.getElementById('pauseMenu').classList.add('hidden');
      this.lastTime = performance.now();
    }
  },
  
  /**
   * Рестарт
   */
  restart() {
    if (this.mode === CONFIG.GAME_MODES.SINGLEPLAYER) {
      const aiCount = this.aiPlayers.length;
      this.startSingleplayer(aiCount);
    } else {
      // В мультиплеере просим хост начать новую игру
      multiplayer.startGame();
    }
  },
  
  /**
   * В меню
   */
  toMenu() {
    const wasMultiplayer = this.mode === CONFIG.GAME_MODES.MULTIPLAYER;
    this.state = CONFIG.GAME_STATES.MENU;
    this.mode = null;
    this.selectedPlanetId = null;
    this.cancelDrag();
    document.getElementById('gameUI').classList.add('hidden');
    document.getElementById('pauseMenu').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    
    if (wasMultiplayer) {
      multiplayer.leaveRoom({ keepMenuState: true });
    }
    
    menu.show();
  },
  
  /**
   * Игровой цикл
   */
  loop() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    
    if (this.state === CONFIG.GAME_STATES.PLAYING && !this.ended) {
      this.update(dt);
    }
    
    this.render();
    
    this.animationId = requestAnimationFrame(() => this.loop());
  },
  
  /**
   * Обновление
   */
  update(dt) {
    this.updateCamera(dt);
    this.updateEffects(dt);

    if (this.mode === CONFIG.GAME_MODES.MULTIPLAYER) {
      if (multiplayer.isHost) {
        multiplayer.updateHostedGame(this, dt);
      } else {
        this.updateMultiplayerVisuals(dt);
      }

      this.updateUI();
      return;
    }

    // Производство кораблей
    this.planets.forEach(p => {
      if (p.owner !== CONFIG.OWNER.NEUTRAL) {
        p.ships += Utils.productionRate(p) * dt;
      }
      p.shipsDisplay = Utils.approach(p.shipsDisplay, p.ships, 0.15);
    });
    
    // Движение флотов
    for (let i = this.fleets.length - 1; i >= 0; i--) {
      const f = this.fleets[i];
      f.t += dt;
      
      if (f.t >= f.travel) {
        this.arriveFleet(f);
        this.fleets.splice(i, 1);
      }
    }
    
    // AI
    if (this.mode === CONFIG.GAME_MODES.SINGLEPLAYER) {
      this.aiThink(dt);
    }
    
    // Проверка окончания
    this.checkEnd();
    
    // Обновление UI
    this.updateUI();
  },

  /**
   * Визуальное обновление гостя по снапшотам хоста
   */
  updateMultiplayerVisuals(dt) {
    this.planets.forEach(p => {
      p.shipsDisplay = Utils.approach(p.shipsDisplay, p.ships, 0.2);
    });

    this.fleets.forEach(fleet => {
      fleet.t = Math.min(fleet.travel, fleet.t + dt);
    });
  },
  
  /**
   * Обновление UI
   */
  updateUI() {
    const statusEl = document.getElementById('gameStatus');
    if (!statusEl) return;
    
    if (this.ended) {
      statusEl.textContent = this.winner ? `${this.winner.name}! Нажмите R` : 'Игра окончена';
    } else {
      const myPlanets = this.planets.filter(p => this.isMyPlanet(p)).length;
      const totalPlanets = this.planets.length;
      statusEl.textContent = `Ваших планет: ${myPlanets} / ${totalPlanets} • Флотов: ${this.fleets.length}`;
    }
  },
  
  /**
   * Рендеринг
   */
  render() {
    renderer.render(this);
  }
};

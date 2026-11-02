/**
 * Управление вводом (включая мобильное)
 */
const input = {
  // Joystick
  joystick: {
    active: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    dx: 0,
    dy: 0,
    angle: 0,
    distance: 0
  },
  
  // Touch
  touches: new Map(),
  lastTapTime: 0,
  tapCount: 0,
  
  /**
   * Инициализация
   */
  init() {
    this.setupTouch();
  },
  
  /**
   * Настройка джойстика
   */
  setupJoystick() {
    const joystick = document.getElementById('joystick');
    const handle = joystick?.querySelector('.joystick-handle');
    if (!joystick || !handle) return;
    
    const onStart = (e) => {
      e.preventDefault();
      const touch = e.touches ? e.touches[0] : e;
      const rect = joystick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      this.joystick.active = true;
      this.joystick.startX = centerX;
      this.joystick.startY = centerY;
      this.joystick.currentX = touch.clientX;
      this.joystick.currentY = touch.clientY;
      
      handle.classList.add('active');
      this.updateJoystick(handle, rect.width / 2);
      
      Utils.vibrate(15);
    };
    
    const onMove = (e) => {
      if (!this.joystick.active) return;
      e.preventDefault();
      
      const touch = e.touches ? e.touches[0] : e;
      this.joystick.currentX = touch.clientX;
      this.joystick.currentY = touch.clientY;
      
      const rect = joystick.getBoundingClientRect();
      this.updateJoystick(handle, rect.width / 2);
    };
    
    const onEnd = (e) => {
      if (!this.joystick.active) return;
      e.preventDefault();
      
      this.joystick.active = false;
      this.joystick.dx = 0;
      this.joystick.dy = 0;
      this.joystick.distance = 0;
      
      handle.style.transform = 'translate(0, 0)';
      handle.classList.remove('active');
    };
    
    joystick.addEventListener('touchstart', onStart, { passive: false });
    joystick.addEventListener('mousedown', onStart);
    
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mousemove', onMove);
    
    document.addEventListener('touchend', onEnd);
    document.addEventListener('mouseup', onEnd);
  },
  
  /**
   * Обновление джойстика
   */
  updateJoystick(handle, maxRadius) {
    const dx = this.joystick.currentX - this.joystick.startX;
    const dy = this.joystick.currentY - this.joystick.startY;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    
    const clampedDistance = Math.min(distance, maxRadius * 0.6);
    
    this.joystick.dx = Math.cos(angle) * clampedDistance;
    this.joystick.dy = Math.sin(angle) * clampedDistance;
    this.joystick.angle = angle;
    this.joystick.distance = clampedDistance / (maxRadius * 0.6);
    
    handle.style.transform = `translate(${this.joystick.dx}px, ${this.joystick.dy}px)`;
  },
  
  /**
   * Настройка touch событий
   */
  setupTouch() {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    
    // Двойное касание для отмены
    canvas.addEventListener('touchstart', (e) => {
      const now = Date.now();
      const timeSinceLastTap = now - this.lastTapTime;
      
      if (timeSinceLastTap < CONFIG.MOBILE.DOUBLE_TAP_DELAY && timeSinceLastTap > 0) {
        // Двойное касание - отмена
        game.selectedPlanetId = null;
        game.cancelDrag();
        this.tapCount = 0;
      } else {
        this.tapCount = 1;
      }
      
      this.lastTapTime = now;
    }, { passive: true });
    
    // Масштабирование (pinch)
    let initialPinchDistance = 0;
    
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initialPinchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });
    
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        
        const scale = currentDistance / initialPinchDistance;
        // Можно использовать для масштабирования карты
      }
    }, { passive: false });
  },
  
  /**
   * Настройка мобильных кнопок
   */
  setupMobileButtons() {
    // Кнопка выбора
    const selectBtn = document.getElementById('mobileSelect');
    selectBtn?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleMobileSelect();
    });
    selectBtn?.addEventListener('mousedown', (e) => {
      this.handleMobileSelect();
    });
    
    // Кнопка отправки
    const sendBtn = document.getElementById('mobileSend');
    sendBtn?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleMobileSend();
    });
    sendBtn?.addEventListener('mousedown', (e) => {
      this.handleMobileSend();
    });
    
    // Кнопка отмены
    const cancelBtn = document.getElementById('mobileCancel');
    cancelBtn?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleMobileCancel();
    });
    cancelBtn?.addEventListener('mousedown', (e) => {
      this.handleMobileCancel();
    });
  },
  
  /**
   * Обработка кнопки выбора
   */
  handleMobileSelect() {
    if (game.state !== CONFIG.GAME_STATES.PLAYING) return;
    
    // Если есть выбранная планета, отправляем на ближайшую вражескую
    if (game.selectedPlanetId) {
      const from = game.planets.find(p => p.id === game.selectedPlanetId);
      if (from && game.isMyPlanet(from)) {
        // Найти ближайшую вражескую планету
        let nearest = null;
        let minDist = Infinity;
        
        for (const p of game.planets) {
          if (p.id !== from.id && !game.isMyPlanet(p)) {
            const d = Utils.dist(from.x, from.y, p.x, p.y);
            if (d < minDist) {
              minDist = d;
              nearest = p;
            }
          }
        }
        
        if (nearest) {
          game.sendFleet(from, nearest);
        }
      }
    }
    
    Utils.vibrate(20);
  },
  
  /**
   * Обработка кнопки отправки
   */
  handleMobileSend() {
    if (game.state !== CONFIG.GAME_STATES.PLAYING) return;
    
    // Если джойстик активен, отправляем в направлении джойстика
    if (this.joystick.active && this.joystick.distance > CONFIG.MOBILE.JOYSTICK_DEADZONE) {
      const from = game.planets.find(p => p.id === game.selectedPlanetId);
      if (from && game.isMyPlanet(from)) {
        const aimDistance = Math.max(game.width, game.height) * 0.75;
        const aimX = from.x + Math.cos(this.joystick.angle) * aimDistance;
        const aimY = from.y + Math.sin(this.joystick.angle) * aimDistance;
        const bestTarget = game.findDragTarget(from, aimX, aimY);
        
        if (bestTarget) {
          game.sendFleet(from, bestTarget);
        }
      }
    }
    
    Utils.vibrate(25);
  },
  
  /**
   * Обработка кнопки отмены
   */
  handleMobileCancel() {
    game.selectedPlanetId = null;
    game.cancelDrag();
    Utils.vibrate(15);
  },
  
  /**
   * Получить направление джойстика
   */
  getJoystickDirection() {
    if (!this.joystick.active || this.joystick.distance < CONFIG.MOBILE.JOYSTICK_DEADZONE) {
      return null;
    }
    
    return {
      angle: this.joystick.angle,
      distance: this.joystick.distance,
      dx: this.joystick.dx,
      dy: this.joystick.dy
    };
  },
  
  /**
   * Проверить, активен ли джойстик
   */
  isJoystickActive() {
    return this.joystick.active && this.joystick.distance >= CONFIG.MOBILE.JOYSTICK_DEADZONE;
  }
};

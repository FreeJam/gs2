/**
 * Утилитарные функции
 */
const Utils = {
  /**
   * Случайное число в диапазоне [a, b)
   */
  rand(a, b) {
    return a + Math.random() * (b - a);
  },

  /**
   * Случайное целое число в диапазоне [a, b]
   */
  randInt(a, b) {
    return Math.floor(this.rand(a, b + 1));
  },

  /**
   * Ограничение значения
   */
  clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  },

  /**
   * Расстояние между двумя точками
   */
  dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  },

  /**
   * Линейная интерполяция
   */
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  /**
   * Плавное приближение значения
   */
  approach(current, target, factor) {
    return this.lerp(current, target, factor);
  },

  /**
   * Скорость производства планеты
   */
  productionRate(planet) {
    const base = CONFIG.GAME.PRODUCTION_BASE + (planet.r - 18) * 0.03;
    return Math.max(0.35, base) * planet.prodMul;
  },

  /**
   * Форматирование числа
   */
  formatNumber(n) {
    return Math.round(n).toString();
  },

  /**
   * Форматирование процента
   */
  formatPercent(pct) {
    return Math.round(pct * 100) + '%';
  },

  /**
   * Получить DPR с ограничением
   */
  getDPR() {
    return Math.max(1, Math.min(CONFIG.GAME.DPR_MAX, window.devicePixelRatio || 1));
  },

  /**
   * Проверка на мобильное устройство
   */
  isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
      || window.matchMedia('(pointer: coarse)').matches;
  },

  /**
   * Проверка на тач-устройство
   */
  isTouch() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  },

  /**
   * Сохранить в localStorage
   */
  save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn('Не удалось сохранить:', e);
      return false;
    }
  },

  /**
   * Загрузить из localStorage
   */
  load(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn('Не удалось загрузить:', e);
      return defaultValue;
    }
  },

  /**
   * Удалить из localStorage
   */
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Генерация UUID
   */
  uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  /**
   * Дебаунс функции
   */
  debounce(fn, delay) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Троттлинг функции
   */
  throttle(fn, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Полноэкранный режим
   */
  fullscreen: {
    isActive() {
      return !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
    },

    async enter() {
      const el = document.documentElement;
      try {
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        else if (el.mozRequestFullScreen) await el.mozRequestFullScreen();
        else if (el.msRequestFullscreen) await el.msRequestFullscreen();
        return true;
      } catch (e) {
        console.warn('Не удалось войти в полноэкранный режим:', e);
        return false;
      }
    },

    async exit() {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
        else if (document.mozCancelFullScreen) await document.mozCancelFullScreen();
        else if (document.msExitFullscreen) await document.msExitFullscreen();
        return true;
      } catch (e) {
        console.warn('Не удалось выйти из полноэкранного режима:', e);
        return false;
      }
    },

    async toggle() {
      return this.isActive() ? this.exit() : this.enter();
    }
  },

  /**
   * Вибрация (для мобильных)
   */
  vibrate(pattern = 50) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  },

  /**
   * Анимация
   */
  animate({ duration, easing, draw, complete }) {
    const start = performance.now();
    
    function frame(now) {
      const timeFraction = Math.min((now - start) / duration, 1);
      const progress = easing ? easing(timeFraction) : timeFraction;
      
      draw(progress);
      
      if (timeFraction < 1) {
        requestAnimationFrame(frame);
      } else if (complete) {
        complete();
      }
    }
    
    requestAnimationFrame(frame);
  },

  /**
   * Easing функции
   */
  easing: {
    linear: t => t,
    easeInQuad: t => t * t,
    easeOutQuad: t => t * (2 - t),
    easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeOutBounce: t => {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (t < 1 / d1) {
        return n1 * t * t;
      } else if (t < 2 / d1) {
        return n1 * (t -= 1.5 / d1) * t + 0.75;
      } else if (t < 2.5 / d1) {
        return n1 * (t -= 2.25 / d1) * t + 0.9375;
      } else {
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
      }
    }
  },

  /**
   * Создать элемент с классами
   */
  createElement(tag, classes = [], attrs = {}) {
    const el = document.createElement(tag);
    el.classList.add(...classes);
    Object.entries(attrs).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
    return el;
  },

  /**
   * Получить позицию касания/мыши
   */
  getPointerPos(e, element) {
    const rect = element.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * this.getDPR(),
      y: (clientY - rect.top) * this.getDPR()
    };
  }
};

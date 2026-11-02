/**
 * Главный файл инициализации
 */
/**
 * Мыльные пузыри в фоне меню
 */
function initMenuParticles() {
  const host = document.getElementById('menuParticles');
  if (!host) return;

  const TINTS = [
    { c: 'rgba(0, 240, 255, 0.55)', g: 'rgba(0, 240, 255, 0.3)' },
    { c: 'rgba(255, 130, 205, 0.55)', g: 'rgba(255, 130, 205, 0.3)' },
    { c: 'rgba(185, 150, 255, 0.55)', g: 'rgba(185, 150, 255, 0.3)' },
    { c: 'rgba(150, 255, 190, 0.5)', g: 'rgba(150, 255, 190, 0.28)' },
    { c: 'rgba(255, 242, 170, 0.5)', g: 'rgba(255, 242, 170, 0.26)' },
    { c: 'rgba(235, 245, 255, 0.5)', g: 'rgba(200, 230, 255, 0.3)' }
  ];
  const MAX = 34;

  const enabled = () => {
    const box = document.getElementById('showParticles');
    return !box || box.checked;
  };

  function spawn() {
    if (!enabled() || host.childElementCount >= MAX) return;
    const el = document.createElement('span');
    el.className = 'particle';

    const size = 8 + Math.random() * 38;
    const life = 9 + Math.random() * 9;
    const tint = TINTS[(Math.random() * TINTS.length) | 0];
    const opacity = (0.4 + Math.random() * 0.5).toFixed(2);

    el.style.width = el.style.height = `${size.toFixed(1)}px`;
    el.style.left = `${(Math.random() * 100).toFixed(2)}%`;
    el.style.top = `${(96 + Math.random() * 10).toFixed(2)}%`;
    el.style.setProperty('--bub-color', tint.c);
    el.style.setProperty('--bub-glow', tint.g);
    el.style.setProperty('--bub-op', opacity);
    el.style.animationDuration = `${life.toFixed(2)}s, ${(3 + Math.random() * 3).toFixed(2)}s`;

    host.appendChild(el);
    setTimeout(() => el.remove(), life * 1000 + 400);
  }

  for (let i = 0; i < 14; i++) setTimeout(spawn, i * 320);
  setInterval(spawn, 650);
}

document.addEventListener('DOMContentLoaded', () => {
  // Инициализация всех модулей
  game.init();
  input.init();
  multiplayer.init();
  
  // Проверка на мобильное устройство
  if (Utils.isMobile()) {
    document.body.classList.add('mobile');

    // Скрыть подсказки клавиатуры
    document.querySelectorAll('.hint').forEach(el => {
      el.style.display = 'none';
    });
  }
  
  // Предотвращение случайного зума на мобильных
  document.addEventListener('touchmove', (e) => {
    const isPinchGesture = e.touches.length > 1 || (typeof e.scale === 'number' && e.scale !== 1);

    if (isPinchGesture) {
      e.preventDefault();
    }
  }, { passive: false });
  
  // Предотвращение двойного тапа для зума
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
  
  // Обработка видимости страницы
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === CONFIG.GAME_STATES.PLAYING) {
      game.pause();
    }
  });
  
  // Обработка ориентации экрана
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      game.resize();
    }, 100);
  });
  
  // Предотвращение контекстного меню
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
  
  // Предотвращение перетаскивания
  document.addEventListener('dragstart', (e) => {
    e.preventDefault();
  });
  
  // ===== Neon-частицы в меню =====
  initMenuParticles();
  
  console.log('🚀 Galactic Siege 2.0 инициализирована!');
  console.log('Режим:', Utils.isMobile() ? 'Мобильный' : 'Десктоп');
});

// Глобальная обработка ошибок
window.addEventListener('error', (e) => {
  console.error('Глобальная ошибка:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Необработанное отклонение:', e.reason);
});

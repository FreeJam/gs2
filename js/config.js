/**
 * Конфигурация игры
 */
const CONFIG = {
  // Версия
  VERSION: '2.0.0',
  
  // Игровые константы
  GAME: {
    FLEET_SPEED: 220,
    SEND_MIN: 0.05,
    SEND_MAX: 1.00,
    SEND_STEP: 0.05,
    DEFAULT_SEND_PCT: 0.5,
    DPR_MAX: 2,
    PRODUCTION_BASE: 0.6,
    DRAG_THRESHOLD: 6,
    AIM_ASSIST_ALIGNMENT: 0.76,
    AIM_ASSIST_PADDING: 26,
    AIM_ASSIST_PROGRESS: 0.18
  },
  
  // Владельцы
  OWNER: {
    NEUTRAL: 0,
    YOU: 1,
    AI: 2
  },
  
  // Состояния игры
  GAME_STATES: {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    ENDED: 'ended'
  },
  
  // Режимы игры
  GAME_MODES: {
    SINGLEPLAYER: 'singleplayer',
    MULTIPLAYER: 'multiplayer'
  },
  
  // Цвета (neon)
  COLORS: {
    NEUTRAL: {
      core: 'rgba(198,220,255,.34)',
      ring: 'rgba(198,220,255,.14)',
      trail: 'rgba(198,220,255,.30)',
      glow: 'rgba(160,200,255,.20)'
    },
    YOU: {
      core: 'rgba(0,240,255,.95)',
      ring: 'rgba(0,240,255,.26)',
      trail: 'rgba(0,240,255,.60)',
      glow: 'rgba(0,240,255,.45)'
    },
    AI: {
      core: 'rgba(255,45,149,.95)',
      ring: 'rgba(255,45,149,.26)',
      trail: 'rgba(255,45,149,.60)',
      glow: 'rgba(255,45,149,.45)'
    }
  },

  // Neon-палитра игроков мультиплеера (p1..p4)
  PLAYER_PALETTE: [
    { name: 'Розовый', core: 'rgba(255,45,149,.95)', ring: 'rgba(255,45,149,.26)', trail: 'rgba(255,45,149,.60)', glow: 'rgba(255,45,149,.45)' },
    { name: 'Циан',    core: 'rgba(0,240,255,.95)',  ring: 'rgba(0,240,255,.26)',  trail: 'rgba(0,240,255,.60)',  glow: 'rgba(0,240,255,.45)' },
    { name: 'Фиолет',  core: 'rgba(184,41,221,.95)', ring: 'rgba(184,41,221,.26)', trail: 'rgba(184,41,221,.60)', glow: 'rgba(184,41,221,.45)' },
    { name: 'Зелёный', core: 'rgba(57,255,20,.95)',  ring: 'rgba(57,255,20,.26)',  trail: 'rgba(57,255,20,.60)',  glow: 'rgba(57,255,20,.45)' }
  ],
  
  // Настройки веб-мультиплеера
  MULTIPLAYER: {
    API_BASE: 'api',
    ROOM_LIST_POLL_MS: 4000,
    ROOM_POLL_MS: 2000,
    SIGNAL_POLL_MS: 1000,
    HEARTBEAT_MS: 10000,
    SNAPSHOT_MS: 100,
    MAX_PLAYERS: 4,
    ICE_SERVERS: [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302'
        ]
      }
    ]
  },
  
  // Настройки графики
  GRAPHICS: {
    STAR_COUNT: 140,
    STAR_OPACITY: 0.18,
    TRAIL_LENGTH: 0.08,
    GLOW_INTENSITY: 0.8,
    EFFECT_PARTICLES: 10,
    EFFECT_LIFE: 0.9
  },
  
  // Настройки AI
  AI: {
    THINK_INTERVAL_MIN: 0.8,
    THINK_INTERVAL_MAX: 1.6,
    MIN_SHIPS_TO_ATTACK: 18,
    ATTACK_BUFFER: 6,
    SEND_PCT_MIN: 0.35,
    SEND_PCT_MAX: 0.85
  },
  
  // Настройки карты
  MAP: {
    PADDING: 80,
    MIN_PLANET_RADIUS: 18,
    MAX_PLANET_RADIUS: 34,
    MIN_DISTANCE_BETWEEN: 55,
    PLAYER_PLANET_RADIUS: 28,
    PLAYER_START_SHIPS: 35,
    NEUTRAL_MIN_SHIPS: 12,
    NEUTRAL_MAX_SHIPS: 45,
    NEUTRAL_COUNT_BASE: 10
  },
  
  // Мобильные настройки
  MOBILE: {
    JOYSTICK_SIZE: 120,
    JOYSTICK_HANDLE_SIZE: 50,
    JOYSTICK_DEADZONE: 0.2,
    DOUBLE_TAP_DELAY: 300
  },
  
  // Локальное хранилище
  STORAGE: {
    PLAYER_NAME: 'galactic_siege_player_name',
    SETTINGS: 'galactic_siege_settings'
  }
};

// Экспорт для модулей
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}

CREATE TABLE IF NOT EXISTS gs_rooms (
  id CHAR(36) NOT NULL,
  name VARCHAR(64) NOT NULL,
  max_players TINYINT UNSIGNED NOT NULL DEFAULT 2,
  status ENUM('waiting', 'playing', 'closed') NOT NULL DEFAULT 'waiting',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rooms_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gs_players (
  id CHAR(36) NOT NULL,
  room_id CHAR(36) NOT NULL,
  secret CHAR(48) NOT NULL,
  name VARCHAR(32) NOT NULL,
  is_host TINYINT(1) NOT NULL DEFAULT 0,
  slot_index TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('lobby', 'playing', 'left') NOT NULL DEFAULT 'lobby',
  connected TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_players_room (room_id, status, connected),
  KEY idx_players_seen (last_seen_at),
  CONSTRAINT fk_gs_players_room
    FOREIGN KEY (room_id) REFERENCES gs_rooms (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gs_signals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id CHAR(36) NOT NULL,
  from_player_id CHAR(36) NOT NULL,
  to_player_id CHAR(36) NOT NULL,
  type VARCHAR(32) NOT NULL,
  payload MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_signals_poll (room_id, to_player_id, id),
  CONSTRAINT fk_gs_signals_room
    FOREIGN KEY (room_id) REFERENCES gs_rooms (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

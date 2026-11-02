/**
 * Локальный мультиплеер (hotseat) для демонстрации
 */
const localMultiplayer = {
  players: [],
  currentPlayerIndex: 0,
  colors: CONFIG.PLAYER_PALETTE,
  
  /**
   * Инициализация
   */
  init(playerCount) {
    this.players = [];
    for (let i = 0; i < playerCount; i++) {
      this.players.push({
        id: `player_${i}`,
        name: `Игрок ${i + 1}`,
        index: i,
        color: this.colors[i],
        owner: i + 1 // 1, 2, 3, 4 для разных игроков
      });
    }
    this.currentPlayerIndex = 0;
  },
  
  /**
   * Получить текущего игрока
   */
  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  },
  
  /**
   * Переключить ход
   */
  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.updateUI();
  },
  
  /**
   * Обновить UI
   */
  updateUI() {
    const player = this.getCurrentPlayer();
    const statusEl = document.getElementById('gameStatus');
    if (statusEl) {
      statusEl.textContent = `Ход: ${player.name}`;
      statusEl.style.color = player.color.core.replace(/,\s*[\d.]+\)$/, ',1)');
    }
  },
  
  /**
   * Проверить, является ли планета текущего игрока
   */
  isCurrentPlayerPlanet(planet) {
    const player = this.getCurrentPlayer();
    return planet.owner === player.owner;
  },
  
  /**
   * Проверить победителя
   */
  checkWinner(game) {
    for (const player of this.players) {
      const hasPlanets = game.planets.some(p => p.owner === player.owner);
      const hasFleets = game.fleets.some(f => f.owner === player.owner);
      
      if (!hasPlanets && !hasFleets) {
        // Игрок проиграл
        player.eliminated = true;
      }
    }
    
    const activePlayers = this.players.filter(p => !p.eliminated);
    if (activePlayers.length === 1) {
      return activePlayers[0];
    }
    return null;
  }
};

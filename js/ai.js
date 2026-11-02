/**
 * Искусственный интеллект для одиночной игры
 */
const AI = {
  difficultyProfiles: {
    easy: {
      thinkInterval: { min: 1.9, max: 3.4 },
      aggression: 0.4,
      expansion: 0.82,
      minAttackShips: 24,
      reserveShips: 16,
      safeAttackRatio: 1.35,
      defendThreshold: 0.72,
      sendPctMin: 0.22,
      sendPctMax: 0.56,
      opportunism: 0.38
    },
    medium: {
      thinkInterval: { min: 1.25, max: 2.15 },
      aggression: 0.56,
      expansion: 0.78,
      minAttackShips: 20,
      reserveShips: 13,
      safeAttackRatio: 1.18,
      defendThreshold: 0.58,
      sendPctMin: 0.28,
      sendPctMax: 0.68,
      opportunism: 0.56
    },
    hard: {
      thinkInterval: { min: 0.95, max: 1.7 },
      aggression: 0.66,
      expansion: 0.82,
      minAttackShips: 18,
      reserveShips: 11,
      safeAttackRatio: 1.08,
      defendThreshold: 0.5,
      sendPctMin: 0.32,
      sendPctMax: 0.78,
      opportunism: 0.68
    }
  },

  personalityProfiles: {
    cautious: {
      expandWeight: 1.18,
      attackWeight: 0.72,
      defendWeight: 1.35,
      neutralBias: 1.32,
      enemyBias: 0.74,
      prodBias: 0.95,
      rangeBias: 0.94,
      reinforceBias: 1.25,
      riskTolerance: 0.84,
      burst: 0.82,
      pace: 1.08
    },
    harvester: {
      expandWeight: 1.5,
      attackWeight: 0.72,
      defendWeight: 0.96,
      neutralBias: 1.72,
      enemyBias: 0.72,
      prodBias: 1.08,
      rangeBias: 0.94,
      reinforceBias: 0.92,
      riskTolerance: 0.9,
      burst: 0.88,
      pace: 1.02
    },
    raider: {
      expandWeight: 0.84,
      attackWeight: 1.34,
      defendWeight: 0.9,
      neutralBias: 0.78,
      enemyBias: 1.38,
      prodBias: 1.02,
      rangeBias: 1.16,
      reinforceBias: 0.78,
      riskTolerance: 1.02,
      burst: 0.96,
      pace: 0.92
    },
    bastion: {
      expandWeight: 0.76,
      attackWeight: 0.78,
      defendWeight: 1.6,
      neutralBias: 0.92,
      enemyBias: 0.9,
      prodBias: 1.32,
      rangeBias: 0.88,
      reinforceBias: 1.52,
      riskTolerance: 0.86,
      burst: 0.8,
      pace: 1.12
    },
    sniper: {
      expandWeight: 0.92,
      attackWeight: 1.14,
      defendWeight: 0.9,
      neutralBias: 0.9,
      enemyBias: 1.14,
      prodBias: 1.5,
      rangeBias: 1.26,
      reinforceBias: 0.9,
      riskTolerance: 0.94,
      burst: 0.88,
      pace: 0.98
    }
  },

  /**
   * Подобрать разные характеры ИИ для сложности
   */
  pickPersonalities(difficulty, count) {
    const pools = {
      easy: ['cautious', 'harvester'],
      medium: ['harvester', 'raider', 'bastion', 'sniper'],
      hard: ['raider', 'bastion', 'sniper', 'harvester']
    };

    const source = [...(pools[difficulty] || pools.medium)];
    for (let i = source.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [source[i], source[j]] = [source[j], source[i]];
    }

    const picked = [];
    for (let i = 0; i < count; i++) {
      picked.push(source[i % source.length]);
    }
    return picked;
  },

  /**
   * Создать AI игрока
   */
  create(owner, difficulty = 'medium', personality = 'cautious') {
    const base = this.difficultyProfiles[difficulty] || this.difficultyProfiles.medium;
    const profile = this.personalityProfiles[personality] || this.personalityProfiles.cautious;

    return {
      owner,
      difficulty,
      personality,
      profile,
      timer: Utils.rand(base.thinkInterval.min * 0.25, base.thinkInterval.max * 0.6),
      ...base
    };
  },

  /**
   * AI думает
   */
  think(ai, game, dt) {
    ai.timer -= dt;
    if (ai.timer > 0) return;

    ai.timer = Utils.rand(ai.thinkInterval.min, ai.thinkInterval.max) * ai.profile.pace;

    const aiPlanets = game.planets.filter(p => p.owner === ai.owner);
    if (!aiPlanets.length) return;

    const primary = this.selectStrategy(ai, game, aiPlanets);
    const strategyChain = this.getStrategyChain(ai, primary);

    for (const strategy of strategyChain) {
      if (this.executeStrategy(strategy, ai, game, aiPlanets)) {
        return;
      }
    }
  },

  /**
   * Приоритеты стратегий
   */
  getStrategyChain(ai, primary) {
    const byPersonality = {
      cautious: ['defend', 'expand', 'reinforce', 'attack'],
      harvester: ['expand', 'reinforce', 'attack', 'defend'],
      raider: ['attack', 'expand', 'reinforce', 'defend'],
      bastion: ['defend', 'reinforce', 'expand', 'attack'],
      sniper: ['attack', 'expand', 'defend', 'reinforce']
    };

    const chain = [primary, ...(byPersonality[ai.personality] || byPersonality.cautious)];
    return [...new Set(chain)];
  },

  /**
   * Выполнить стратегию
   */
  executeStrategy(strategy, ai, game, aiPlanets) {
    switch (strategy) {
      case 'attack':
        return this.executeAttack(ai, game, aiPlanets);
      case 'expand':
        return this.executeExpand(ai, game, aiPlanets);
      case 'defend':
        return this.executeDefend(ai, game, aiPlanets);
      case 'reinforce':
        return this.executeReinforce(ai, game, aiPlanets);
      default:
        return false;
    }
  },

  /**
   * Выбрать стратегию
   */
  selectStrategy(ai, game, aiPlanets) {
    const totalShips = aiPlanets.reduce((sum, p) => sum + p.ships, 0);
    const averageShips = totalShips / Math.max(1, aiPlanets.length);
    const enemyPlanets = game.planets.filter(p => p.owner >= CONFIG.OWNER.AI && p.owner !== ai.owner || p.owner === CONFIG.OWNER.YOU);
    const neutralPlanets = game.planets.filter(p => p.owner === CONFIG.OWNER.NEUTRAL);
    const threatened = this.findThreatenedPlanets(ai, game, aiPlanets);

    if (threatened.length > 0 && (ai.personality === 'bastion' || threatened[0].threat > threatened[0].planet.ships * ai.defendThreshold)) {
      return 'defend';
    }

    if (ai.personality === 'harvester' && neutralPlanets.some(p => p.ships <= averageShips * 0.95)) {
      return Math.random() < 0.82 ? 'expand' : 'reinforce';
    }

    if (ai.personality === 'raider' && enemyPlanets.some(p => p.ships < averageShips * 0.72)) {
      return Math.random() < 0.78 ? 'attack' : 'expand';
    }

    if (ai.personality === 'sniper' && enemyPlanets.some(p => Utils.productionRate(p) > 0.9 && p.ships < averageShips * 0.9)) {
      return 'attack';
    }

    if (ai.personality === 'bastion' && aiPlanets.some(p => p.ships < ai.reserveShips)) {
      return 'reinforce';
    }

    const enemyShips = enemyPlanets.reduce((sum, p) => sum + p.ships, 0);
    if (totalShips > enemyShips * ai.safeAttackRatio && Math.random() < ai.aggression) {
      return 'attack';
    }

    if (neutralPlanets.length > 0 && Math.random() < ai.expansion * ai.profile.expandWeight * 0.75) {
      return 'expand';
    }

    if (threatened.length > 0) {
      return 'defend';
    }

    if (Math.random() < ai.profile.reinforceBias * 0.35 + ai.opportunism * 0.2) {
      return 'reinforce';
    }

    return 'attack';
  },

  /**
   * Найти угрожаемые планеты
   */
  findThreatenedPlanets(ai, game, aiPlanets) {
    const threatened = [];

    for (const planet of aiPlanets) {
      const incomingFleets = game.fleets.filter(f => f.toId === planet.id && f.owner !== ai.owner);
      const incomingShips = incomingFleets.reduce((sum, f) => sum + f.count, 0);
      const nearbyEnemy = game.planets.filter(p =>
        p.owner !== ai.owner &&
        p.owner !== CONFIG.OWNER.NEUTRAL &&
        Utils.dist(p.x, p.y, planet.x, planet.y) < 280 * game.DPR
      );

      const nearbyPressure = nearbyEnemy.reduce((sum, p) => sum + Math.max(0, p.ships - planet.ships * 0.35), 0);
      const threat = incomingShips + nearbyPressure * 0.22;

      if (
        threat > planet.ships * ai.defendThreshold ||
        (planet.ships < ai.reserveShips * 0.85 && nearbyEnemy.length > 0)
      ) {
        threatened.push({ planet, threat });
      }
    }

    return threatened.sort((a, b) => b.threat - a.threat);
  },

  /**
   * Атака
   */
  executeAttack(ai, game, aiPlanets) {
    const sources = aiPlanets
      .filter(p => p.ships > ai.minAttackShips)
      .sort((a, b) => b.ships - a.ships);
    if (!sources.length) return false;

    for (const source of sources) {
      const targets = game.planets.filter(p => p.owner !== ai.owner);
      const target = this.selectBestTarget(source, targets, ai, game);
      if (!target) continue;

      const strengthRatio = target.ships / Math.max(1, source.ships - ai.reserveShips * 0.25);
      if (strengthRatio > ai.safeAttackRatio * ai.profile.riskTolerance) {
        continue;
      }

      const pct = this.calculateAttackPct(source, target, ai);
      if (pct > 0) {
        game.sendFleet(source, target, ai.owner, pct);
        return true;
      }
    }

    return false;
  },

  /**
   * Экспансия
   */
  executeExpand(ai, game, aiPlanets) {
    const sources = aiPlanets
      .filter(p => p.ships > Math.max(ai.reserveShips + 3, ai.minAttackShips - 4))
      .sort((a, b) => b.ships - a.ships);
    const neutralPlanets = game.planets.filter(p => p.owner === CONFIG.OWNER.NEUTRAL);
    if (!sources.length || !neutralPlanets.length) return false;

    for (const source of sources) {
      const target = neutralPlanets
        .map(p => ({
          planet: p,
          score: this.scoreNeutralPlanet(source, p, ai, game)
        }))
        .sort((a, b) => b.score - a.score)[0]?.planet;

      if (!target) continue;
      if (target.ships > source.ships * 0.88) continue;

      const pct = this.calculateExpandPct(source, target, ai);
      if (pct > 0) {
        game.sendFleet(source, target, ai.owner, pct);
        return true;
      }
    }

    return false;
  },

  /**
   * Защита
   */
  executeDefend(ai, game, aiPlanets) {
    const threatened = this.findThreatenedPlanets(ai, game, aiPlanets);
    if (!threatened.length) return false;

    const target = threatened[0].planet;
    const source = aiPlanets
      .filter(p => p.id !== target.id && p.ships > ai.reserveShips + 2)
      .map(p => ({
        planet: p,
        distance: Utils.dist(p.x, p.y, target.x, target.y),
        score: (p.ships - ai.reserveShips) / Math.max(1, Utils.dist(p.x, p.y, target.x, target.y))
      }))
      .sort((a, b) => b.score - a.score)[0]?.planet;

    if (!source) return false;

    const pct = this.calculateDefendPct(source, target, threatened[0].threat, ai);
    if (pct <= 0) return false;

    game.sendFleet(source, target, ai.owner, pct);
    return true;
  },

  /**
   * Усиление
   */
  executeReinforce(ai, game, aiPlanets) {
    const source = aiPlanets
      .filter(p => p.ships > ai.reserveShips + 6)
      .sort((a, b) => b.ships - a.ships)[0];
    if (!source) return false;

    const target = aiPlanets
      .filter(p => p.id !== source.id)
      .map(p => ({
        planet: p,
        score: this.scoreOwnedPlanet(source, p, ai, game)
      }))
      .sort((a, b) => b.score - a.score)[0]?.planet;

    if (!target) return false;

    const pct = this.calculateReinforcePct(source, target, ai);
    if (pct <= 0) return false;

    game.sendFleet(source, target, ai.owner, pct);
    return true;
  },

  /**
   * Выбрать лучшую цель
   */
  selectBestTarget(source, targets, ai, game) {
    return targets
      .map(target => ({
        planet: target,
        score: this.scoreTarget(source, target, ai, game)
      }))
      .sort((a, b) => b.score - a.score)[0]?.planet || null;
  },

  /**
   * Оценить цель
   */
  scoreTarget(source, target, ai, game) {
    const distance = Utils.dist(source.x, source.y, target.x, target.y);
    const proximity = 1 / (1 + distance / (480 * game.DPR));
    const weakness = 1 / (1 + target.ships);
    const production = Utils.productionRate(target);
    const strengthRatio = target.ships / Math.max(1, source.ships - ai.reserveShips * 0.2);
    const isNeutral = target.owner === CONFIG.OWNER.NEUTRAL;
    const ownershipBias = isNeutral ? ai.profile.neutralBias : ai.profile.enemyBias;
    const riskPenalty = strengthRatio > ai.safeAttackRatio * ai.profile.riskTolerance ? 0.42 : 1;

    return (
      production * 0.85 * ai.profile.prodBias +
      weakness * 2.55 +
      proximity * 1.2 * ai.profile.rangeBias
    ) * ownershipBias * ai.profile.attackWeight * riskPenalty;
  },

  /**
   * Оценить нейтральную планету
   */
  scoreNeutralPlanet(source, target, ai, game) {
    const distance = Utils.dist(source.x, source.y, target.x, target.y);
    const proximity = 1 / (1 + distance / (500 * game.DPR));
    const weakness = 1 / (1 + target.ships);
    const production = Utils.productionRate(target);

    return (
      production * 1.05 * ai.profile.prodBias +
      weakness * 3.1 +
      proximity * 1.35 * ai.profile.rangeBias
    ) * ai.profile.expandWeight * ai.profile.neutralBias;
  },

  /**
   * Оценить свою планету для усиления
   */
  scoreOwnedPlanet(source, target, ai, game) {
    const distance = Utils.dist(source.x, source.y, target.x, target.y);
    const proximity = 1 / (1 + distance / (460 * game.DPR));
    const production = Utils.productionRate(target);
    const shipNeed = 1 / Math.max(1, target.ships + 4);

    return (
      production * 1.2 * ai.profile.prodBias +
      proximity * 0.95 +
      shipNeed * 42
    ) * ai.profile.reinforceBias;
  },

  /**
   * Процент для атаки
   */
  calculateAttackPct(source, target, ai) {
    const needed = target.ships + ai.reserveShips * 0.25 + 4;
    const basePct = needed / Math.max(1, source.ships);
    return Utils.clamp(
      basePct * ai.profile.burst * (0.82 + ai.aggression * 0.35),
      ai.sendPctMin,
      ai.sendPctMax
    );
  },

  /**
   * Процент для захвата нейтралов
   */
  calculateExpandPct(source, target, ai) {
    const needed = target.ships + 3;
    const basePct = needed / Math.max(1, source.ships);
    return Utils.clamp(
      basePct * ai.profile.burst,
      ai.sendPctMin,
      Math.min(ai.sendPctMax, 0.64)
    );
  },

  /**
   * Процент для защиты
   */
  calculateDefendPct(source, target, threat, ai) {
    const needed = Math.max(ai.reserveShips * 0.8, threat - target.ships + ai.reserveShips * 0.6);
    const basePct = needed / Math.max(1, source.ships);
    return Utils.clamp(
      basePct * ai.profile.reinforceBias,
      0.22,
      Math.min(ai.sendPctMax, 0.72)
    );
  },

  /**
   * Процент для усиления
   */
  calculateReinforcePct(source, target, ai) {
    const need = Math.max(8, ai.reserveShips - target.ships * 0.18);
    const basePct = need / Math.max(1, source.ships);
    return Utils.clamp(
      Math.max(basePct, 0.24) * Math.min(ai.profile.reinforceBias, 1.4),
      0.22,
      Math.min(ai.sendPctMax, 0.48)
    );
  }
};

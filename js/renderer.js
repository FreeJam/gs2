/**
 * Рендеринг игры
 */
const renderer = {
  backgroundCache: {
    width: 0,
    height: 0,
    dpr: 0,
    stars: []
  },

  /**
   * Основной рендер
   */
  render(game) {
    const ctx = game.ctx;
    const W = game.width;
    const H = game.height;
    
    // Очистка
    ctx.clearRect(0, 0, W, H);
    
    // Фон
    this.drawBackground(ctx, W, H, game.DPR);
    
    // Флоты
    game.fleets.forEach(f => this.drawFleet(ctx, f, game));
    
    // Планеты
    const fromPlanet = game.drag.active
      ? game.planets.find(p => p.id === game.drag.fromId)
      : null;
    const targetId = game.drag.active ? game.drag.targetId : null;
    game.planets.forEach(p => {
      const isSelected = p.id === game.selectedPlanetId;
      const targetMode = targetId !== null && p.id === targetId
        ? game.getEngagementMode(fromPlanet, p)
        : null;
      this.drawPlanet(ctx, p, isSelected, targetMode, game.DPR, game);
    });

    // Neon-эффекты (взрывы, искры)
    this.drawEffects(ctx, game);
    
    // Drag UI
    this.drawDragUI(ctx, game);
    
    // Экран окончания (если нужен дополнительный рендер)
    if (game.ended) {
      this.drawEndScreen(ctx, W, H, game.DPR, game.winner);
    }
  },
  
  /**
   * Фон
   */
  drawBackground(ctx, W, H, DPR) {
    this.ensureBackgroundCache(W, H, DPR);

    const skyGradient = ctx.createLinearGradient(0, 0, 0, H);
    skyGradient.addColorStop(0, '#01030a');
    skyGradient.addColorStop(0.52, '#030714');
    skyGradient.addColorStop(1, '#05091a');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, W, H);

    // Пульсирующие neon-туманности
    const drift = performance.now() * 0.00008;
    this.drawNebula(ctx, W * (0.18 + Math.sin(drift) * 0.02), H * 0.2, Math.max(W, H) * 0.40, 'rgba(0, 240, 255, 0.11)');
    this.drawNebula(ctx, W * 0.78, H * (0.28 + Math.cos(drift) * 0.02), Math.max(W, H) * 0.30, 'rgba(255, 45, 149, 0.09)');
    this.drawNebula(ctx, W * 0.58, H * 0.82, Math.max(W, H) * 0.34, 'rgba(184, 41, 221, 0.07)');
    this.drawNebula(ctx, W * 0.44, H * 0.52, Math.max(W, H) * 0.22, 'rgba(57, 255, 20, 0.035)');

    const pulseTime = performance.now() * 0.00016;
    this.backgroundCache.stars.forEach(star => {
      const shimmer = 0.82 + Math.sin(pulseTime * star.twinkle + star.phase) * 0.18;
      const alpha = star.alpha * shimmer;

      if (star.glow > 0) {
        const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.r * star.glow);
        glow.addColorStop(0, this.withAlpha(star.color, alpha * 0.55));
        glow.addColorStop(1, this.withAlpha(star.color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r * star.glow, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();

      if (star.cross) {
        ctx.strokeStyle = star.color;
        ctx.lineWidth = 0.7 * DPR;
        ctx.beginPath();
        ctx.moveTo(star.x - star.cross, star.y);
        ctx.lineTo(star.x + star.cross, star.y);
        ctx.moveTo(star.x, star.y - star.cross);
        ctx.lineTo(star.x, star.y + star.cross);
        ctx.stroke();
      }
      ctx.restore();
    });

    // Плавающие мыльные пузыри
    const bubbleTime = performance.now() * 0.001;
    const span = H + 180 * DPR;
    this.backgroundCache.bubbles.forEach(b => {
      const y = (((b.y - bubbleTime * b.speed) % span) + span) % span - 90 * DPR;
      const x = b.x + Math.sin(bubbleTime * 0.4 + b.phase) * b.wobble;
      this.drawBubbleMote(ctx, x, y, b.r, b.tint, b.opacity);
    });
  },

  /**
   * Обновить кэш фона при смене размера
   */
  ensureBackgroundCache(W, H, DPR) {
    if (
      this.backgroundCache.width === W &&
      this.backgroundCache.height === H &&
      this.backgroundCache.dpr === DPR
    ) {
      return;
    }

    const cssArea = (W / DPR) * (H / DPR);
    const starCount = Math.max(
      32,
      Math.min(CONFIG.GRAPHICS.STAR_COUNT, Math.round(cssArea / 26000))
    );

    const palette = [
      'rgba(255,255,255,1)',
      'rgba(190,244,255,1)',
      'rgba(255,214,244,1)',
      'rgba(214,255,214,1)',
      'rgba(220,214,255,1)'
    ];

    const stars = [];
    for (let i = 0; i < starCount; i++) {
      const rarity = Math.random();
      const radius =
        rarity > 0.95
          ? Utils.rand(1.8, 2.8) * DPR
          : rarity > 0.8
            ? Utils.rand(1.0, 1.6) * DPR
            : Utils.rand(0.35, 0.95) * DPR;

      stars.push({
        x: Utils.rand(0, W),
        y: Utils.rand(0, H),
        r: radius,
        alpha: Utils.rand(0.35, 0.92),
        color: palette[Math.floor(Math.random() * palette.length)],
        glow: rarity > 0.78 ? Utils.rand(4, 8) : Utils.rand(0, 3.5),
        cross: rarity > 0.94 ? Utils.rand(5, 10) * DPR : 0,
        twinkle: Utils.rand(0.8, 1.8),
        phase: Utils.rand(0, Math.PI * 2)
      });
    }

    // Плавающие пузыри
    const tints = [
      'rgba(0,240,255,0.14)',
      'rgba(255,45,149,0.12)',
      'rgba(184,41,221,0.12)',
      'rgba(57,255,20,0.09)',
      'rgba(200,230,255,0.14)'
    ];
    const bubbleCount = Math.max(8, Math.min(18, Math.round(cssArea / 90000)));
    const bubbles = [];
    for (let i = 0; i < bubbleCount; i++) {
      bubbles.push({
        x: Utils.rand(0, W),
        y: Utils.rand(0, H + 180 * DPR),
        r: Utils.rand(6, 26) * DPR,
        speed: Utils.rand(6, 18) * DPR,
        wobble: Utils.rand(4, 16) * DPR,
        phase: Utils.rand(0, Math.PI * 2),
        opacity: Utils.rand(0.22, 0.55),
        tint: tints[Math.floor(Math.random() * tints.length)]
      });
    }

    this.backgroundCache = {
      width: W,
      height: H,
      dpr: DPR,
      stars,
      bubbles
    };
  },

  /**
   * Небула на фоне
   */
  drawNebula(ctx, x, y, radius, color) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  },

  /**
   * Одиночный мыльный пузырь на фоне
   */
  drawBubbleMote(ctx, x, y, r, tint, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;

    const body = ctx.createRadialGradient(
      x - r * 0.3, y - r * 0.35, r * 0.1,
      x, y, r
    );
    body.addColorStop(0, 'rgba(255,255,255,0.06)');
    body.addColorStop(0.7, tint);
    body.addColorStop(1, 'rgba(255,255,255,0.12)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = Math.max(0.6, r * 0.06);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.stroke();

    ctx.globalAlpha = opacity * 0.85;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(x - r * 0.34, y - r * 0.38, r * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },

  /**
   * Подменить альфу в rgba-цвете
   */
  withAlpha(color, alpha) {
    return color.replace(/,\s*[\d.]+\)$/, `,${alpha})`);
  },

  /**
   * Скруглённый прямоугольник
   */
  roundRect(ctx, x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  },
  
  /**
   * Планета
   */
  drawPlanet(ctx, p, isSelected, targetMode, DPR, game) {
    const c = this.getPlanetColor(p, game);
    const screen = game.worldToScreenPoint(p.x, p.y);
    const radius = game.worldToScreenLength(p.r);
    const orbitRadius = radius * 1.8;
    const fontScale = Utils.clamp(game.camera.zoom, 0.72, 1.15);
    const glowColor = c.glow || this.withAlpha(c.core, 0.4);
    const now = performance.now();

    // Мягкое свечение фракции
    const halo = ctx.createRadialGradient(screen.x, screen.y, radius * 0.7, screen.x, screen.y, radius * 2.3);
    halo.addColorStop(0, this.withAlpha(glowColor, 0.42));
    halo.addColorStop(0.5, this.withAlpha(glowColor, 0.12));
    halo.addColorStop(1, this.withAlpha(glowColor, 0));
    ctx.save();
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius * 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Плёнка-орбита
    ctx.save();
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, orbitRadius, 0, Math.PI * 2);
    ctx.fillStyle = c.ring;
    ctx.fill();
    ctx.restore();

    // Тело пузыря (полупрозрачное, с тоном фракции)
    const body = ctx.createRadialGradient(
      screen.x - radius * 0.32, screen.y - radius * 0.36, radius * 0.08,
      screen.x, screen.y, radius
    );
    body.addColorStop(0, 'rgba(255,255,255,0.06)');
    body.addColorStop(0.52, this.withAlpha(c.core, 0.14));
    body.addColorStop(0.8, this.withAlpha(c.core, 0.34));
    body.addColorStop(1, this.withAlpha(c.core, 0.52));
    ctx.save();
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = Math.max(1.4 * DPR, radius * 0.085);
    ctx.strokeStyle = this.withAlpha(c.core, 0.95);
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = (8 + radius * 0.22) * DPR;
    ctx.stroke();
    ctx.restore();

    // Большой блик (верх-лево)
    ctx.save();
    const spec = ctx.createRadialGradient(
      screen.x - radius * 0.36, screen.y - radius * 0.4, 0,
      screen.x - radius * 0.36, screen.y - radius * 0.4, radius * 0.55
    );
    spec.addColorStop(0, 'rgba(255,255,255,0.9)');
    spec.addColorStop(0.4, 'rgba(255,255,255,0.16)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.arc(screen.x - radius * 0.36, screen.y - radius * 0.4, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Малый иридесцентный блик (низ-право)
    ctx.save();
    const spec2 = ctx.createRadialGradient(
      screen.x + radius * 0.4, screen.y + radius * 0.42, 0,
      screen.x + radius * 0.4, screen.y + radius * 0.42, radius * 0.4
    );
    spec2.addColorStop(0, 'rgba(210,245,255,0.5)');
    spec2.addColorStop(1, 'rgba(210,245,255,0)');
    ctx.fillStyle = spec2;
    ctx.beginPath();
    ctx.arc(screen.x + radius * 0.4, screen.y + radius * 0.42, radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Выделение — светящееся кольцо-пузырь
    if (isSelected) {
      ctx.save();
      ctx.lineWidth = 2.2 * DPR;
      ctx.strokeStyle = 'rgba(235,252,255,.95)';
      ctx.shadowColor = 'rgba(180,225,255,.9)';
      ctx.shadowBlur = 16 * DPR;
      ctx.setLineDash([7 * DPR, 7 * DPR]);
      ctx.lineDashOffset = -((now * 0.02) % (14 * DPR));
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius + 8 * DPR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Цель
    if (targetMode) {
      this.drawTargetLock(ctx, screen.x, screen.y, radius, targetMode, DPR);
    }

    // Количество кораблей — с контрастной обводкой
    ctx.save();
    const fontSize = Math.round(13 * DPR * fontScale);
    ctx.font = `700 ${fontSize}px system-ui,Segoe UI,Roboto,Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = Utils.formatNumber(p.shipsDisplay);
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    // тёмная обводка (контраст на светлом ободе пузыря)
    ctx.lineWidth = Math.max(1.5 * DPR, fontSize * 0.14);
    ctx.strokeStyle = 'rgba(2,8,20,.85)';
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 4 * DPR;
    ctx.strokeText(label, screen.x, screen.y);
    // светлая заливка
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(248,254,255,1)';
    ctx.fillText(label, screen.x, screen.y);
    ctx.restore();

    // Индикатор производства — мини-капсула
    ctx.save();
    const barW = radius * 1.35;
    const barH = 4 * DPR;
    const bx = screen.x - barW / 2;
    const by = screen.y + radius + 9 * DPR;
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    this.roundRect(ctx, bx, by, barW, barH, barH / 2);
    ctx.fill();
    const pr = Utils.clamp((Utils.productionRate(p) - 0.35) / 1.2, 0, 1);
    ctx.fillStyle = this.withAlpha(c.core, 0.95);
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 6 * DPR;
    this.roundRect(ctx, bx, by, Math.max(barH, barW * pr), barH, barH / 2);
    ctx.fill();
    ctx.restore();
  },

  /**
   * Подсветка цели автоприцела
   */
  drawTargetLock(ctx, x, y, radius, targetMode, DPR) {
    const tone = this.getTargetTone(targetMode);
    const orbitRadius = radius + 13 * DPR;
    const bracketOuter = radius + 22 * DPR;
    const bracketInner = radius + 8 * DPR;

    ctx.save();
    ctx.strokeStyle = tone.stroke;
    ctx.lineWidth = 2.2 * DPR;

    ctx.beginPath();
    ctx.arc(x, y, orbitRadius, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 4; i++) {
      const angle = i * (Math.PI / 2);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const edgeX = x + cos * bracketOuter;
      const edgeY = y + sin * bracketOuter;
      const sideX = x + cos * bracketInner - sin * 8 * DPR;
      const sideY = y + sin * bracketInner + cos * 8 * DPR;
      const sideX2 = x + cos * bracketInner + sin * 8 * DPR;
      const sideY2 = y + sin * bracketInner - cos * 8 * DPR;

      ctx.beginPath();
      ctx.moveTo(edgeX, edgeY);
      ctx.lineTo(sideX, sideY);
      ctx.moveTo(edgeX, edgeY);
      ctx.lineTo(sideX2, sideY2);
      ctx.stroke();
    }

    ctx.fillStyle = tone.glow;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(x, y, radius + 18 * DPR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  /**
   * Цвет режима цели
   */
  getTargetTone(targetMode) {
    switch (targetMode) {
      case 'reinforce':
        return {
          stroke: 'rgba(57,255,20,.92)',
          glow: 'rgba(57,255,20,.35)'
        };
      case 'capture':
        return {
          stroke: 'rgba(255,230,0,.92)',
          glow: 'rgba(255,230,0,.35)'
        };
      default:
        return {
          stroke: 'rgba(255,7,58,.95)',
          glow: 'rgba(255,7,58,.4)'
        };
    }
  },
  
  /**
   * Получить цвет планеты
   */
  getPlanetColor(p, game) {
    if (game.mode === CONFIG.GAME_MODES.SINGLEPLAYER) {
      if (p.owner === CONFIG.OWNER.NEUTRAL) return CONFIG.COLORS.NEUTRAL;
      if (p.owner === CONFIG.OWNER.YOU) return CONFIG.COLORS.YOU;
      return CONFIG.COLORS.AI;
    } else {
      // Мультиплеер - цвета игроков
      if (p.owner === null) return CONFIG.COLORS.NEUTRAL;
      
      const player = game.players.find(pl => pl.id === p.owner);
      if (player?.color) {
        return {
          core: player.color.core,
          ring: player.color.ring,
          trail: player.color.trail
        };
      }
      return CONFIG.COLORS.NEUTRAL;
    }
  },
  
  /**
   * Флот
   */
  drawFleet(ctx, f, game) {
    const DPR = game.DPR;
    const c = this.getFleetColor(f);
    const t = Utils.clamp(f.t / f.travel, 0, 1);
    const x = Utils.lerp(f.sx, f.tx, t);
    const y = Utils.lerp(f.sy, f.ty, t);
    const screen = game.worldToScreenPoint(x, y);
    const backT = Utils.clamp(t - CONFIG.GRAPHICS.TRAIL_LENGTH, 0, 1);
    const backScreen = game.worldToScreenPoint(
      Utils.lerp(f.sx, f.tx, backT),
      Utils.lerp(f.sy, f.ty, backT)
    );
    const glowColor = c.glow || this.withAlpha(c.core, 0.5);
    const r = Math.max(2.2 * DPR, game.worldToScreenLength(3.0 * DPR));

    // Хвост — neon-градиент
    const trailGrad = ctx.createLinearGradient(backScreen.x, backScreen.y, screen.x, screen.y);
    trailGrad.addColorStop(0, this.withAlpha(c.trail, 0));
    trailGrad.addColorStop(1, c.trail);
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = trailGrad;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2 * DPR, game.worldToScreenLength(1.6 * DPR));
    ctx.beginPath();
    ctx.moveTo(backScreen.x, backScreen.y);
    ctx.lineTo(screen.x, screen.y);
    ctx.stroke();
    ctx.restore();

    // Пузырёк-флот
    ctx.save();
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = (8 + r * 1.6) * DPR;
    const bubble = ctx.createRadialGradient(
      screen.x - r * 0.3, screen.y - r * 0.35, r * 0.1,
      screen.x, screen.y, r
    );
    bubble.addColorStop(0, 'rgba(255,255,255,.12)');
    bubble.addColorStop(0.6, this.withAlpha(c.core, 0.4));
    bubble.addColorStop(1, this.withAlpha(c.core, 0.85));
    ctx.fillStyle = bubble;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(0.8 * DPR, r * 0.14);
    ctx.strokeStyle = this.withAlpha(c.core, 0.95);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath();
    ctx.arc(screen.x - r * 0.32, screen.y - r * 0.34, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  
  /**
   * Получить цвет флота
   */
  getFleetColor(f) {
    if (game.mode === CONFIG.GAME_MODES.SINGLEPLAYER) {
      if (f.owner === CONFIG.OWNER.YOU) return CONFIG.COLORS.YOU;
      return CONFIG.COLORS.AI;
    } else {
      const player = game.players.find(p => p.id === f.owner);
      if (player?.color) {
        return {
          core: player.color.core,
          trail: player.color.trail
        };
      }
      return CONFIG.COLORS.NEUTRAL;
    }
  },
  
  /**
   * Drag UI
   */
  drawDragUI(ctx, game) {
    if (!game.drag.active || !game.drag.moved) return;
    
    const from = game.planets.find(p => p.id === game.drag.fromId);
    if (!from) return;
    
    let tx = game.drag.x;
    let ty = game.drag.y;
    
    const target = game.drag.targetId !== null 
      ? game.planets.find(p => p.id === game.drag.targetId) 
      : null;
    const targetMode = target ? game.getEngagementMode(from, target) : null;
    
    if (target) {
      tx = target.x;
      ty = target.y;
    }
    
    const fromScreen = game.worldToScreenPoint(from.x, from.y);
    const toScreen = game.worldToScreenPoint(tx, ty);
    const radius = game.worldToScreenLength(from.r);
    const dx = toScreen.x - fromScreen.x;
    const dy = toScreen.y - fromScreen.y;
    const len = Math.hypot(dx, dy) || 1;
    const sx = fromScreen.x + (dx / len) * (radius + 6 * game.DPR);
    const sy = fromScreen.y + (dy / len) * (radius + 6 * game.DPR);
    
    this.drawArrow(ctx, sx, sy, toScreen.x, toScreen.y, targetMode, game.DPR);
    
    // Плавающая подсказка
    ctx.save();
    ctx.fillStyle = target
      ? this.getTargetTone(targetMode).stroke
      : 'rgba(255,255,255,.75)';
    ctx.font = `${Math.round(12 * game.DPR)}px system-ui,Segoe UI,Roboto,Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const actionLabel = {
      reinforce: 'Подкрепление',
      capture: 'Захват',
      attack: 'Атака'
    }[targetMode] || 'Наведение';
    ctx.fillText(
      `${actionLabel}: ${Utils.formatPercent(game.sendPct)}`,
      toScreen.x + 10 * game.DPR,
      toScreen.y + 10 * game.DPR
    );
    ctx.restore();
  },
  
  /**
   * Стрелка
   */
  drawArrow(ctx, fromX, fromY, toX, toY, targetMode, DPR) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    
    const ux = dx / len;
    const uy = dy / len;
    const head = 10 * DPR;
    const wing = 6 * DPR;
    const tone = targetMode ? this.getTargetTone(targetMode) : null;
    
    ctx.save();
    ctx.lineWidth = (targetMode ? 2.5 : 1.6) * DPR;
    ctx.strokeStyle = tone ? tone.stroke : 'rgba(255,255,255,.30)';
    ctx.fillStyle = tone ? tone.stroke : 'rgba(255,255,255,.30)';
    ctx.shadowBlur = targetMode ? 18 * DPR : 0;
    ctx.shadowColor = tone ? tone.glow : 'transparent';
    
    // Линия
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    
    // Головка стрелки
    const hx = toX - ux * head;
    const hy = toY - uy * head;
    
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(hx - uy * wing, hy + ux * wing);
    ctx.lineTo(hx + uy * wing, hy - ux * wing);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  },
  
  /**
   * Neon-эффекты: кольца взрывов и искры
   */
  drawEffects(ctx, game) {
    if (!game.effects || !game.effects.length) return;
    const DPR = game.DPR;
    ctx.save();
    game.effects.forEach(e => {
      const k = Utils.clamp(e.life / e.maxLife, 0, 1);
      const screen = game.worldToScreenPoint(e.x, e.y);
      ctx.globalAlpha = k;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 12 * DPR;

      if (e.type === 'ring') {
        const rr = game.worldToScreenLength(e.size * (1 + (1 - k) * 3.5));
        ctx.strokeStyle = e.color;
        ctx.lineWidth = Math.max(1.2 * DPR, game.worldToScreenLength(e.size) * 0.35 * k + DPR);
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, rr, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, Math.max(0.8 * DPR, game.worldToScreenLength(e.size) * k), 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  },

  /**
   * Экран окончания игры
   */
  drawEndScreen(ctx, W, H, DPR, winner) {
    // Затемнение
    ctx.save();
    ctx.fillStyle = 'rgba(2,4,12,.6)';
    ctx.fillRect(0, 0, W, H);
    
    // Текст победителя (neon)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,240,255,.85)';
    ctx.shadowBlur = 26 * DPR;
    ctx.fillStyle = 'rgba(235,252,255,.96)';
    ctx.font = `bold ${Math.round(34 * DPR)}px system-ui,Segoe UI,Roboto,Arial`;
    
    const text = winner ? `${winner.name} победил!` : 'Ничья!';
    ctx.fillText(text, W / 2, H / 2 - 10 * DPR);
    
    // Подсказка
    ctx.shadowBlur = 10 * DPR;
    ctx.shadowColor = 'rgba(255,45,149,.7)';
    ctx.fillStyle = 'rgba(220,235,255,.75)';
    ctx.font = `${Math.round(16 * DPR)}px system-ui,Segoe UI,Roboto,Arial`;
    ctx.fillText('Нажмите R для новой игры', W / 2, H / 2 + 26 * DPR);
    
    ctx.restore();
  }
};

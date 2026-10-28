/* ============================================================
   BUSCAMINAS POWER · progresión incremental, costes y efectos
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const SCHEMA_VERSION = 2;
  const BOT_DIFFICULTIES = ["beginner", "intermediate", "expert"];
  const SKILL_IDS = ["xray", "defuse", "immortal", "freeze"];

  const SKILL_DEFS = {
    xray: {
      id: "xray",
      name: "Visión X",
      short: "Visión",
      icon: "i-eye",
      maxLevel: 4,
      baseCost: 60,
      growth: 1.8,
      manual: (level) => `${3 + level} usos · radar 3x3`,
      bot: (level) => `${1 + level} escaneos por tablero`,
    },
    defuse: {
      id: "defuse",
      name: "Kit de desarme",
      short: "Desarme",
      icon: "i-tool",
      maxLevel: 4,
      baseCost: 60,
      growth: 1.8,
      manual: (level) => `${3 + level} kits · bonus monedas`,
      bot: (level) => `${1 + level} minas desactivadas por tablero`,
    },
    immortal: {
      id: "immortal",
      name: "Inmortalidad",
      short: "Escudo",
      icon: "i-shield",
      maxLevel: 4,
      baseCost: 75,
      growth: 1.85,
      manual: (level) => `${2 + Math.floor(level / 2)} escudos · ${6 + level * 2} clics`,
      bot: (level) => `${1 + level} impactos absorbidos por tablero`,
    },
    freeze: {
      id: "freeze",
      name: "Cañón criogénico",
      short: "Crio",
      icon: "i-snow",
      maxLevel: 4,
      baseCost: 70,
      growth: 1.8,
      manual: (level) => `${3 + Math.floor(level / 2)} celdas · ${(10000 + level * 2000) / 1000} s`,
      bot: (level) => `${1 + Math.floor(level / 2)} celdas congeladas por tablero`,
    },
  };

  const UPGRADE_DEFS = {
    capacity: {
      id: "capacity",
      name: "Capacidad del núcleo",
      short: "Capacidad",
      icon: "i-bot",
      maxLevel: 4,
      baseCost: 55,
      growth: 2.0,
      description: "Más espacio para contratar y mantener bots.",
      effect: (level) => `${1 + level} bots contratables`,
      next: (level) => `${2 + level} bots contratables`,
    },
    concurrency: {
      id: "concurrency",
      name: "Procesamiento paralelo",
      short: "Concurrencia",
      icon: "i-bolt",
      maxLevel: 3,
      baseCost: 65,
      growth: 2.1,
      description: "Cada nivel permite que un bot más trabaje a la vez.",
      effect: (level) => `${1 + level} bots simultáneos`,
      next: (level) => `${2 + level} bots simultáneos`,
    },
    speed: {
      id: "speed",
      name: "Motor de barrido",
      short: "Velocidad",
      icon: "i-target",
      maxLevel: 6,
      baseCost: 25,
      growth: 1.6,
      description: "Reduce el tiempo entre decisiones de cada bot.",
      effect: (level) => `${(botStepMs({ upgrades: { speed: level } }) / 1000).toFixed(2)} s / acción`,
      next: (level) => `${(botStepMs({ upgrades: { speed: level + 1 } }) / 1000).toFixed(2)} s / acción`,
    },
    intelligence: {
      id: "intelligence",
      name: "Red neuronal",
      short: "Inteligencia",
      icon: "i-chip",
      maxLevel: 6,
      baseCost: 35,
      growth: 1.65,
      description: "Aumenta la probabilidad de elegir la casilla de menor riesgo.",
      effect: (level) => `${Math.round(botAccuracy({ upgrades: { intelligence: level } }) * 100)}% de análisis`,
      next: (level) => `${Math.round(botAccuracy({ upgrades: { intelligence: level + 1 } }) * 100)}% de análisis`,
    },
    salvage: {
      id: "salvage", name: "Refinería de campo", short: "Refinería", icon: "i-coin",
      maxLevel: 20, baseCost: 150, growth: 1.48,
      description: "Aumenta las monedas ganadas en victorias manuales.",
      effect: (level) => `+${level * 10}% por victoria`,
      next: (level) => `+${(level + 1) * 10}% por victoria`,
    },
  };

  function roundedCost(base, growth, level) {
    return Math.round(base * Math.pow(growth, level));
  }

  function upgradeCost(id, level) {
    const def = UPGRADE_DEFS[id];
    if (!def || level >= def.maxLevel) return null;
    return roundedCost(def.baseCost, def.growth, level);
  }

  function skillCost(id, level) {
    const def = SKILL_DEFS[id];
    if (!def || level >= def.maxLevel) return null;
    return roundedCost(def.baseCost, def.growth, level);
  }

  function hireCost(botCount) {
    return 25 + Math.max(0, botCount) * 20;
  }

  const TURBO_DURATION_MS = 25000;
  const TURBO_SPEED_MULT = 4.5;

  function turboCost(count = 0) {
    const c = safeInt(count, 0, 9999, 0);
    return Math.round(25 + c * 20 + Math.pow(c, 1.4) * 8);
  }

  function createState() {
    return {
      coins: 25,
      totalEarned: 25,
      totalSpent: 0,
      manualWins: 0,
      botWins: 0,
      botLosses: 0,
      turboCount: 0,
      contracts: { date: "", completed: [] },
      rank: 0,
      fieldWins: 0,
      bots: [
        {
          id: "bot-1",
          number: 1,
          name: "Scout-01",
          difficulty: "beginner",
          boards: 0,
          wins: 0,
          losses: 0,
          coins: 0,
          skills: { xray: false, defuse: false, immortal: false, freeze: false },
        },
      ],
      nextBotId: 2,
      upgrades: {
        capacity: 0,
        concurrency: 0,
        speed: 0,
        intelligence: 0,
        salvage: 0,
      },
      skills: {
        xray: 0,
        defuse: 0,
        immortal: 0,
        freeze: 0,
      },
      log: [],
    };
  }

  function safeInt(value, min, max, fallback = 0) {
    const number = Math.floor(Number(value));
    if (!Number.isFinite(number)) return fallback;
    return clamp(number, min, max);
  }

  function sanitizeBot(raw, fallbackIndex) {
    if (!raw || typeof raw !== "object") return null;
    const difficulty = BOT_DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : "beginner";
    const skills = {};
    SKILL_IDS.forEach((id) => {
      skills[id] = Boolean(raw.skills && raw.skills[id]);
    });
    const id = String(raw.id || `bot-${fallbackIndex + 1}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || `bot-${fallbackIndex + 1}`;
    const number = safeInt(raw.number, 1, 99999, fallbackIndex + 1);
    return {
      id,
      number,
      name: String(raw.name || `Scout-${String(number).padStart(2, "0")}`).slice(0, 28),
      difficulty,
      skills,
      wins: safeInt(raw.wins, 0, 9999999, 0),
      losses: safeInt(raw.losses, 0, 9999999, 0),
      boards: safeInt(raw.boards, 0, 9999999, 0),
      coins: safeInt(raw.coins, 0, 999999999, 0),
      createdAt: raw.createdAt || new Date().toISOString(),
    };
  }

  function sanitizeState(raw) {
    const base = createState();
    if (!raw || typeof raw !== "object") return base;
    base.coins = safeInt(raw.coins, 0, 999999999, 0);
    base.totalEarned = safeInt(raw.totalEarned, 0, 9999999999, 0);
    base.totalSpent = safeInt(raw.totalSpent, 0, 9999999999, 0);
    base.manualWins = safeInt(raw.manualWins, 0, 9999999, 0);
    base.botWins = safeInt(raw.botWins, 0, 9999999, 0);
    base.botLosses = safeInt(raw.botLosses, 0, 9999999, 0);
    base.turboCount = safeInt(raw.turboCount, 0, 999999, 0);
    base.rank = safeInt(raw.rank, 0, 999999, Math.floor(base.manualWins / 3));
    base.fieldWins = safeInt(raw.fieldWins, 0, 9999999, base.manualWins);
    if (raw.contracts && typeof raw.contracts === "object") {
      base.contracts.date = /^\d{4}-\d{2}-\d{2}$/.test(raw.contracts.date) ? raw.contracts.date : "";
      base.contracts.completed = Array.isArray(raw.contracts.completed)
        ? raw.contracts.completed.filter((id) => ["clear", "swift", "clean"].includes(id))
        : [];
    }

    const upgrades = raw.upgrades && typeof raw.upgrades === "object" ? raw.upgrades : {};
    Object.keys(base.upgrades).forEach((id) => {
      base.upgrades[id] = safeInt(upgrades[id], 0, UPGRADE_DEFS[id].maxLevel, 0);
    });

    const skills = raw.skills && typeof raw.skills === "object" ? raw.skills : {};
    SKILL_IDS.forEach((id) => {
      base.skills[id] = safeInt(skills[id], 0, SKILL_DEFS[id].maxLevel, 0);
    });

    const rawBots = Array.isArray(raw.bots) ? raw.bots.slice(0, 1 + base.upgrades.capacity) : [];
    const usedIds = new Set();
    base.bots = rawBots
      .map((bot, index) => sanitizeBot(bot, index))
      .filter((bot) => {
        if (!bot || usedIds.has(bot.id)) return false;
        usedIds.add(bot.id);
        // Una habilidad equipada sin nivel comprado queda desactivada.
        SKILL_IDS.forEach((id) => {
          if (!base.skills[id]) bot.skills[id] = false;
        });
        return true;
      });

    base.nextBotId = Math.max(
      1,
      safeInt(raw.nextBotId, 1, 999999, 1),
      ...base.bots.map((bot) => bot.number + 1)
    );

    if (base.bots.length === 0) {
      base.bots.push({
        id: "bot-1",
        number: 1,
        name: "Scout-01",
        difficulty: "beginner",
        boards: 0,
        wins: 0,
        losses: 0,
        coins: 0,
        skills: { xray: false, defuse: false, immortal: false, freeze: false },
      });
      base.nextBotId = 2;
    }

    const rawLog = Array.isArray(raw.log) ? raw.log.slice(0, 20) : [];
    base.log = rawLog
      .filter((entry) => entry && typeof entry === "object" && entry.message)
      .map((entry) => ({
        id: String(entry.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`),
        date: entry.date || new Date().toISOString(),
        message: String(entry.message).slice(0, 180),
        type: ["info", "success", "warn", "danger"].includes(entry.type) ? entry.type : "info",
      }));

    return base;
  }

  function maxBots(state) {
    return 1 + safeInt(state && state.upgrades ? state.upgrades.capacity : 0, 0, UPGRADE_DEFS.capacity.maxLevel, 0);
  }

  function concurrency(state) {
    return 1 + safeInt(state && state.upgrades ? state.upgrades.concurrency : 0, 0, UPGRADE_DEFS.concurrency.maxLevel, 0);
  }

  function botStepMs(state) {
    const level = safeInt(state && state.upgrades ? state.upgrades.speed : 0, 0, UPGRADE_DEFS.speed.maxLevel, 0);
    return Math.max(120, 480 - level * 50);
  }

  function botAccuracy(state) {
    const level = safeInt(state && state.upgrades ? state.upgrades.intelligence : 0, 0, UPGRADE_DEFS.intelligence.maxLevel, 0);
    return Math.min(0.97, 0.55 + level * 0.07);
  }

  function botSkillCharges(id, level) {
    const safeLevel = safeInt(level, 0, SKILL_DEFS[id] ? SKILL_DEFS[id].maxLevel : 0, 0);
    if (safeLevel <= 0) return 0;
    if (id === "xray" || id === "defuse" || id === "immortal") return 1 + safeLevel;
    if (id === "freeze") return 1 + Math.floor(safeLevel / 2);
    return 0;
  }

  function manualPowerStats(skills) {
    const levels = {};
    SKILL_IDS.forEach((id) => {
      levels[id] = safeInt(skills ? skills[id] : 0, 0, SKILL_DEFS[id].maxLevel, 0);
    });
    return {
      xray: {
        charges: 3 + levels.xray,
        duration: 6000,
      },
      defuse: {
        charges: 3 + levels.defuse,
      },
      immortal: {
        charges: 2 + Math.floor(levels.immortal / 2),
        clicks: 6 + levels.immortal * 2,
      },
      freeze: {
        charges: 3 + Math.floor(levels.freeze / 2),
        radius: 0,
        maxFrozen: 3,
        thawDuration: 10000 + levels.freeze * 2000,
      },
    };
  }

  function manualBaseReward(mode, config) {
    const presetRewards = { beginner: 18, intermediate: 45, expert: 110 };
    if (presetRewards[mode]) return presetRewards[mode];
    const width = Math.max(1, Number(config && config.width) || 9);
    const height = Math.max(1, Number(config && config.height) || 9);
    const mines = Math.max(1, Number(config && config.mines) || 10);
    return Math.max(12, Math.round(width * height / 8 + mines * 0.75));
  }

  function flagBonus(base, mines, flags, defused = 0) {
    const remaining = Math.max(0, Number(mines) - Number(defused || 0));
    const unflagged = Math.max(0, remaining - Math.max(0, Number(flags) || 0));
    return { unflagged, flagBonus: remaining ? Math.round(base * 0.4 * unflagged / remaining) : 0 };
  }

  function manualRewardDetails(mode, config, elapsedMs, flags = 0, defused = 0) {
    const base = manualBaseReward(mode, config);
    const seconds = Math.max(0, Number(elapsedMs) || 0) / 1000;
    const speedFactor = Math.max(0, 1 - seconds / 240);
    const speedBonus = Math.round(base * 0.6 * speedFactor);
    const flagInfo = flagBonus(base, Number(config && config.mines) || 10, flags, defused);
    return { base, speedBonus, ...flagInfo, total: base + speedBonus + flagInfo.flagBonus };
  }

  function manualReward(mode, config, elapsedMs, flags = 0, defused = 0) {
    return manualRewardDetails(mode, config, elapsedMs, flags, defused).total;
  }

  function manualLossReward(mode, config, revealedCount, totalSafeCount) {
    const base = manualBaseReward(mode, config);
    const maxLoss = Math.max(2, Math.round(base * 0.35));
    const safeCount = Math.max(1, Number(totalSafeCount) || 1);
    const revealed = Math.max(0, Number(revealedCount) || 0);
    const progressRatio = clamp(revealed / safeCount, 0, 1);

    return Math.max(1, Math.round(maxLoss * (0.25 + 0.75 * progressRatio)));
  }

  function botBoardReward({ difficulty, win, elapsedMs, revealedSafe, totalSafe, mistakes = 0, mines = 0, flags = 0, defused = 0 }) {
    let baseWin;
    let parTimeSec;
    if (difficulty === "expert") {
      baseWin = 72;
      parTimeSec = 90;
    } else if (difficulty === "intermediate") {
      baseWin = 30;
      parTimeSec = 35;
    } else {
      baseWin = 12;
      parTimeSec = 14;
    }

    const elapsedSec = Math.max(0.4, (Number(elapsedMs) || 0) / 1000);
    const safeTotal = Math.max(1, Number(totalSafe) || 1);
    const safeRevealed = Math.max(0, Math.min(safeTotal, Number(revealedSafe) || 0));
    const safeRatio = clamp(safeRevealed / safeTotal, 0, 1);

    if (win) {
      // 1. Base por completar el sector
      // 2. Bonus por velocidad: mientras menos tiempo demore, mayor la recompensa
      const speedRatio = clamp(1.6 - elapsedSec / parTimeSec, 0, 1.8);
      const speedBonus = Math.round(baseWin * 0.45 * Math.max(0, speedRatio - 0.5));

      // 3. Recompensa proporcional a las celdas descubiertas
      const cellsBonus = Math.max(1, Math.round(safeRevealed * 0.05));

      // 4. Bonus de deducción limpia si no activó escudos ni cometió errores
      const cleanBonus = mistakes === 0 ? Math.max(2, Math.round(baseWin * 0.2)) : 0;

      const flagInfo = flagBonus(baseWin, mines, flags, defused);
      const total = baseWin + speedBonus + cellsBonus + cleanBonus + flagInfo.flagBonus;
      return {
        total,
        breakdown: {
          base: baseWin,
          speedBonus,
          cellsBonus,
          cleanBonus,
          ...flagInfo,
          elapsedSec,
          revealedSafe: safeRevealed,
          totalSafe: safeTotal,
          win: true,
        },
      };
    } else {
      // Recompensa parcial en caso de detonación: basada en la cantidad de celdas descubiertas y tiempo de exploración
      const pool = Math.max(3, Math.round(baseWin * 0.5));
      const cellsPart = Math.round(pool * safeRatio);
      const timeEffort = Math.round(Math.max(1, pool * 0.25) * clamp(elapsedSec / parTimeSec, 0.1, 1));
      const total = Math.max(1, Math.round(cellsPart + timeEffort * 0.4));
      return {
        total,
        breakdown: {
          base: 0,
          speedBonus: 0,
          cellsBonus: total,
          cleanBonus: 0,
          elapsedSec,
          revealedSafe: safeRevealed,
          totalSafe: safeTotal,
          win: false,
        },
      };
    }
  }

  function botReward(difficulty) {
    if (difficulty === "expert") return 42;
    if (difficulty === "intermediate") return 16;
    return 6;
  }

  function formatCoins(value) {
    const number = Math.max(0, Math.round(Number(value) || 0));
    try {
      return new Intl.NumberFormat("es-ES").format(number);
    } catch (_error) {
      return String(number);
    }
  }

  const formatNumber = formatCoins;

  BP.Progression = {
    SCHEMA_VERSION,
    BOT_DIFFICULTIES,
    SKILL_IDS,
    SKILL_DEFS,
    UPGRADE_DEFS,
    createState,
    sanitizeState,
    upgradeCost,
    skillCost,
    hireCost,
    TURBO_DURATION_MS,
    TURBO_SPEED_MULT,
    turboCost,
    maxBots,
    concurrency,
    botStepMs,
    botAccuracy,
    botSkillCharges,
    manualPowerStats,
    manualReward,
    manualRewardDetails,
    manualLossReward,
    botReward,
    botBoardReward,
    formatCoins,
    formatNumber,
  };
})();

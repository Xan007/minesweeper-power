/* ============================================================
   BUSCAMINAS POWER · bots autónomos y simulación headless
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});

  function pickRandom(list) {
    if (!list || list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  class BotRunner {
    constructor(manager, bot) {
      this.manager = manager;
      this.bot = bot;
      this.board = null;
      this.preset = null;
      this.done = false;
      this.status = "starting";
      this.progress = 0;
      this.nextStartAt = 0;
      this.lastStepAt = 0;
      this.startedAt = 0;
      this.finishedAt = 0;
      this.steps = 0;
      this.accuracy = 0;
      this.charges = {};
      this.used = { xray: 0, defuse: 0, immortal: 0, freeze: 0, mistakes: 0 };
      this.currentThought = "Iniciando bot...";
      this.thoughtType = "info";
      this.thoughtHistory = [];
      this.targetCell = null;
      this.startBoard();
    }

    setThought(text, type = "info", target = null) {
      this.currentThought = text;
      this.thoughtType = type;
      this.targetCell = target ? { x: target.x, y: target.y, kind: type } : null;
      const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      if (!this.thoughtHistory) this.thoughtHistory = [];
      this.thoughtHistory.unshift({ text, type, time });
      if (this.thoughtHistory.length > 8) this.thoughtHistory.pop();
    }

    get isActive() {
      return !this.done || this.status === "won" || this.status === "lost";
    }

    get cellsPerSec() {
      if (!this.board || !this.startedAt) return "0.0";
      const endTime = this.done && this.finishedAt ? this.finishedAt : performance.now();
      const elapsedSec = Math.max(0.1, (endTime - this.startedAt) / 1000);
      return (this.board.revealedSafeCount / elapsedSec).toFixed(1);
    }

    startBoard() {
      const difficulty = BP.PRESETS[this.bot.difficulty] ? this.bot.difficulty : "beginner";
      const preset = BP.PRESETS[difficulty];
      const state = this.manager.store.progression;

      this.preset = preset;
      this.board = new BP.Board(preset.width, preset.height, preset.mines);
      const startX = Math.floor(preset.width / 2);
      const startY = Math.floor(preset.height / 2);
      this.board.generate(startX, startY);
      this.board.reveal(startX, startY);

      this.done = false;
      this.status = "solving";
      this.progress = 0;
      this.nextStartAt = 0;
      this.lastStepAt = 0;
      this.startedAt = performance.now();
      this.finishedAt = 0;
      this.steps = 0;
      this.accuracy = BP.Progression.botAccuracy(state);
      this.used = { xray: 0, defuse: 0, immortal: 0, freeze: 0, mistakes: 0 };

      const equipped = this.bot.skills || {};
      const skills = state.skills || {};
      this.charges = {
        xray: equipped.xray ? BP.Progression.botSkillCharges("xray", skills.xray) : 0,
        defuse: equipped.defuse ? BP.Progression.botSkillCharges("defuse", skills.defuse) : 0,
        immortal: equipped.immortal ? BP.Progression.botSkillCharges("immortal", skills.immortal) : 0,
        freeze: equipped.freeze ? BP.Progression.botSkillCharges("freeze", skills.freeze) : 0,
      };

      this.targetCell = null;
      this.setThought(`Nuevo sector iniciado (${preset.label}). Evaluando primer movimiento...`, "info");
      this.updateProgress();
    }

    pause() {
      if (this.done) return;
      if (this.status !== "waiting") this.status = "waiting";
    }

    resume() {
      if (this.done) return;
      if (this.status === "waiting") {
        this.status = "solving";
        this.lastStepAt = performance.now();
      }
    }

    tick(now) {
      if (!this.board) return false;
      if (this.bot.difficulty !== this.preset.id) {
        this.startBoard();
        return true;
      }

      if (!this.done && this.board.allSafeRevealed()) {
        this.finishWin(now);
        return true;
      }

      if (this.done) {
        if (now >= this.nextStartAt) {
          this.startBoard();
          return true;
        }
        return false;
      }

      if (this.status === "waiting") return false;

      const state = this.manager.store.progression;
      const baseStepMs = BP.Progression.botStepMs(state);
      const speedMult = this.manager.speedMultiplier || 1;
      const stepMs = Math.max(30, Math.round(baseStepMs / speedMult));
      this.accuracy = BP.Progression.botAccuracy(state);
      if (now - this.lastStepAt < stepMs) return false;
      this.lastStepAt = now;
      this.step(now);
      return true;
    }

    step(now) {
      const hidden = this.hiddenCells();
      if (hidden.length === 0) {
        if (this.board.allSafeRevealed()) this.finishWin(now);
        else this.finishLoss(now);
        return;
      }

      const analysis = this.analyze();

      // Primero marca las minas que puede deducir con certeza (paso a paso para visibilidad en tiempo real).
      if (analysis.mines.length > 0) {
        const toMark = analysis.mines.filter((cell) => !cell.revealed && !cell.flagged);
        if (toMark.length > 0) {
          const targetMine = toMark[0];
          this.board.toggleFlag(targetMine.x, targetMine.y);
          this.setThought(
            `Deducción lógica: mina localizada en (${targetMine.x + 1}, ${targetMine.y + 1}). Bandera colocada (${toMark.length - 1} pendientes).`,
            "deduction",
            targetMine
          );
          this.steps += 1;
          this.status = "marking";
          this.updateProgress();
          return;
        }
      }

      let target = null;

      if (analysis.safe.length > 0) {
        // La precisión modela la inteligencia:
        // si falla el chequeo de inteligencia, pasa por alto la deducción segura y duda/adivina.
        if (Math.random() < this.accuracy) {
          target = pickRandom(analysis.safe);
          this.status = "solving";
          this.setThought(
            `Certeza 100%: celda segura en (${target.x + 1}, ${target.y + 1}) por suma de vecinos.`,
            "safe",
            target
          );
        } else {
          target = pickRandom(hidden);
          this.status = "guessing";
          const accPct = Math.round(this.accuracy * 100);
          this.setThought(
            `Fallo de cálculo (Inteligencia ${accPct}%): dudó de la lógica y eligió (${target.x + 1}, ${target.y + 1}) al azar.`,
            "mistake",
            target
          );
        }
      } else {
        // Sin jugadas deterministas, usa habilidades equipadas o arriesga.
        if (this.charges.freeze > 0) {
          const center = this.pickFreezeCenter(hidden);
          if (center) {
            this.charges.freeze -= 1;
            this.used.freeze += 1;
            this.board.freezeArea(center.x, center.y, 0);
            this.steps += 1;
            this.status = "freeze";
            this.setThought(
              `Sin certeza: disparó Cañón Criogénico en (${center.x + 1}, ${center.y + 1}).`,
              "skill",
              center
            );
            this.updateProgress();
            if (this.board.allSafeRevealed()) this.finishWin(now);
            return;
          }
        }

        if (this.charges.xray > 0) {
          const peek = pickRandom(hidden);
          if (peek) {
            this.charges.xray -= 1;
            this.used.xray += 1;
            this.status = "scan";
            this.setThought(
              `Zona dudosa: activando Visión X en (${peek.x + 1}, ${peek.y + 1}).`,
              "skill",
              peek
            );
            if (peek.mine) {
              if (!peek.flagged) this.board.toggleFlag(peek.x, peek.y);
            } else {
              this.board.reveal(peek.x, peek.y);
            }
            this.steps += 1;
            this.updateProgress();
            if (this.board.allSafeRevealed()) this.finishWin(now);
            return;
          }
        }

        const safeHidden = hidden.filter((cell) => !cell.mine);
        if (Math.random() < this.accuracy && safeHidden.length > 0) {
          target = pickRandom(safeHidden);
          this.status = "intuition";
          this.setThought(
            `Cálculo probabilístico: intuición acertada en (${target.x + 1}, ${target.y + 1}).`,
            "intuition",
            target
          );
        } else {
          target = pickRandom(hidden);
          this.status = "guessing";
          const accPct = Math.round(this.accuracy * 100);
          this.setThought(
            `Sin datos certeros: arriesgando a ciegas en (${target.x + 1}, ${target.y + 1}) (Precisión: ${accPct}%).`,
            "guess",
            target
          );
        }
      }

      if (!target) {
        this.finishLoss(now);
        return;
      }

      if (target.flagged) {
        this.lastStepAt = 0;
        return;
      }

      if (target.mine) {
        this.targetCell = target;
        this.handleMine(target, now);
        return;
      }

      const result = this.board.reveal(target.x, target.y);
      this.steps += 1;
      if (result.kind === "mine") {
        this.targetCell = result.cell || target;
        this.handleMine(result.cell || target, now);
        return;
      }

      this.status = "solving";
      this.updateProgress();
      if (this.board.allSafeRevealed()) this.finishWin(now);
    }

    hiddenCells() {
      const result = [];
      this.board.forEach((cell) => {
        if (!cell.revealed && !cell.flagged) result.push(cell);
      });
      return result;
    }

    analyze() {
      const safeMap = new Map();
      const mineMap = new Map();

      this.board.forEach((cell) => {
        if (!cell.revealed || cell.mine || cell.adjacent <= 0) return;
        let flags = 0;
        let defused = 0;
        const hidden = [];

        this.board.neighbors(cell.x, cell.y).forEach((neighbor) => {
          if (neighbor.flagged) flags += 1;
          else if (neighbor.mine && neighbor.defused) defused += 1;
          else if (!neighbor.revealed) hidden.push(neighbor);
        });

        if (hidden.length === 0) return;
        if (flags + defused === cell.adjacent) {
          hidden.forEach((neighbor) => {
            safeMap.set(`${neighbor.x},${neighbor.y}`, neighbor);
          });
        } else if (flags + defused + hidden.length === cell.adjacent) {
          hidden.forEach((neighbor) => {
            mineMap.set(`${neighbor.x},${neighbor.y}`, neighbor);
          });
        }
      });

      return {
        safe: Array.from(safeMap.values()),
        mines: Array.from(mineMap.values()),
      };
    }

    pickFreezeCenter(hidden) {
      let best = null;
      let bestScore = -1;
      hidden.forEach((cell) => {
        let score = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const neighbor = this.board.getCell(cell.x + dx, cell.y + dy);
            if (!neighbor) continue;
            if (!neighbor.revealed) score += 1;
            if (neighbor.mine && !neighbor.defused) score += 0.5;
          }
        }
        if (cell.mine && !cell.defused) score += 0.5;
        if (score > bestScore) {
          bestScore = score;
          best = cell;
        }
      });
      return best;
    }

    handleMine(cell, now) {
      this.used.mistakes += 1;
      this.targetCell = cell;

      if (this.charges.immortal > 0) {
        this.charges.immortal -= 1;
        this.used.immortal += 1;
        this.board.defuse(cell);
        this.steps += 1;
        this.status = "shield";
        this.setThought(
          `¡Pisa mina en (${cell.x + 1}, ${cell.y + 1})! El Escudo de inmortalidad la absorbió.`,
          "skill",
          cell
        );
        this.updateProgress();
        if (this.board.allSafeRevealed()) this.finishWin(now);
        return;
      }

      if (this.charges.defuse > 0) {
        this.charges.defuse -= 1;
        this.used.defuse += 1;
        this.board.defuse(cell);
        this.steps += 1;
        this.status = "defuse";
        this.setThought(
          `¡Pisa mina en (${cell.x + 1}, ${cell.y + 1})! El Kit de desarme neutralizó la detonación.`,
          "skill",
          cell
        );
        this.updateProgress();
        if (this.board.allSafeRevealed()) this.finishWin(now);
        return;
      }

      cell.exploded = true;
      this.setThought(
        `¡BOOM! Mina detonada en (${cell.x + 1}, ${cell.y + 1}). Fallo por conjetura errónea.`,
        "danger",
        cell
      );
      this.finishLoss(now);
    }

    updateProgress() {
      if (!this.board) {
        this.progress = 0;
        return;
      }
      const safeCount = this.board.safeCount;
      this.progress = safeCount > 0
        ? clamp(this.board.revealedSafeCount / safeCount, 0, 1)
        : 0;
    }

    finishWin(now) {
      if (this.done) return;
      this.done = true;
      this.status = "won";
      this.progress = 1;
      this.finishedAt = now;
      this.targetCell = null;
      if (this.board) {
        this.board.flagAllMines();
      }
      const speedMult = this.manager.speedMultiplier || 1;
      this.nextStartAt = now + Math.max(250, Math.round(1400 / speedMult));

      const elapsedMs = Math.max(400, now - this.startedAt);
      const safeCount = this.board ? this.board.safeCount : 0;
      const revealedSafe = this.board ? this.board.revealedSafeCount : safeCount;
      const rewardInfo = BP.Progression.botBoardReward({
        difficulty: this.preset.id,
        win: true,
        elapsedMs,
        revealedSafe,
        totalSafe: safeCount,
        mistakes: this.used.mistakes || 0,
      });

      this.lastReward = rewardInfo;
      const sec = (elapsedMs / 1000).toFixed(1);
      let details = `¡Sector despejado en ${sec}s (${revealedSafe} celdas)! +${rewardInfo.total} monedas`;
      if (rewardInfo.breakdown.speedBonus > 0) {
        details += ` (Velocidad: +${rewardInfo.breakdown.speedBonus})`;
      }
      this.setThought(details, "win");
      this.manager.completeBoard(this, true, rewardInfo.total, rewardInfo);
    }

    finishLoss(now) {
      if (this.done) return;
      this.done = true;
      this.status = "lost";
      this.finishedAt = now;
      if (this.board) {
        this.board.revealAllMines(this.targetCell);
      }
      const speedMult = this.manager.speedMultiplier || 1;
      this.nextStartAt = now + Math.max(300, Math.round(1900 / speedMult));

      const elapsedMs = Math.max(400, now - this.startedAt);
      const safeCount = this.board ? this.board.safeCount : 1;
      const revealedSafe = this.board ? this.board.revealedSafeCount : 0;
      const pct = Math.round((revealedSafe / safeCount) * 100);
      const rewardInfo = BP.Progression.botBoardReward({
        difficulty: this.preset.id,
        win: false,
        elapsedMs,
        revealedSafe,
        totalSafe: safeCount,
        mistakes: this.used.mistakes || 0,
      });

      this.lastReward = rewardInfo;
      const sec = (elapsedMs / 1000).toFixed(1);
      this.setThought(
        `Detonación tras ${sec}s habiendo descubierto ${revealedSafe}/${safeCount} celdas (${pct}%). +${rewardInfo.total} monedas por avance.`,
        "danger"
      );
      this.manager.completeBoard(this, false, rewardInfo.total, rewardInfo);
    }

    statusLabel() {
      if (this.status === "waiting") return "En espera";
      if (this.status === "won") return "¡Victoria!";
      if (this.status === "lost") return "Detonación";
      if (this.status === "marking") return "Marcando";
      if (this.status === "freeze") return "Criogenia";
      if (this.status === "scan") return "Visión X";
      if (this.status === "shield") return "Escudo";
      if (this.status === "defuse") return "Desarme";
      if (this.status === "guessing") return "Arriesgando";
      if (this.status === "intuition") return "Intuición";
      return "Resolviendo";
    }
  }

  // Tiempo de recarga gratuita del Turbo (segundos de espera para la próxima carga automática)
  const TURBO_FREE_RECHARGE_SECS = 120;

  class BotManager {
    constructor({ store }) {
      this.store = store;
      this.runners = new Map();
      this.timer = null;
      this.lastEmit = 0;
      this.onUpdate = null;
      this.turboUntil = 0;
      // Recarga automática: timestamp (performance.now) en el que se concede una carga gratis
      this.turboFreeRechargeAt = performance.now() + TURBO_FREE_RECHARGE_SECS * 1000;
      this._lastTurboWasActive = false;
    }

    get isTurboActive() {
      return performance.now() < this.turboUntil;
    }

    get turboRemainingMs() {
      return Math.max(0, this.turboUntil - performance.now());
    }

    get speedMultiplier() {
      return this.isTurboActive ? (BP.Progression.TURBO_SPEED_MULT || 4.5) : 1;
    }

    get turboFreeRechargeRemainingMs() {
      return Math.max(0, this.turboFreeRechargeAt - performance.now());
    }

    get turboFreeRechargeReady() {
      return performance.now() >= this.turboFreeRechargeAt;
    }

    activateTurbo() {
      if (this.isTurboActive) {
        return { ok: false, reason: "already_active" };
      }

      const state = this.state;
      const P = BP.Progression;
      const cost = P.turboCost(state.turboCount || 0);

      // Si la recarga automática está lista, es gratis
      const isFree = this.turboFreeRechargeReady;
      if (!isFree && !this.store.spendCoins(cost)) {
        return { ok: false, reason: "coins", cost };
      }

      if (isFree) {
        // Recarga gratuita: reiniciar el contador de recarga
        this.turboFreeRechargeAt = performance.now() + TURBO_FREE_RECHARGE_SECS * 1000;
        this.store.addProgressionLog(
          `¡Turbo recargado automáticamente! (${Math.round(P.TURBO_DURATION_MS / 1000)}s gratis)`,
          "success"
        );
      } else {
        state.turboCount = (state.turboCount || 0) + 1;
        // Reiniciar el temporizador de recarga gratuita al comprar
        this.turboFreeRechargeAt = performance.now() + TURBO_FREE_RECHARGE_SECS * 1000;
        this.store.addProgressionLog(
          `¡Modo Turbo activado por ${Math.round(P.TURBO_DURATION_MS / 1000)}s! (-${cost} monedas)`,
          "success"
        );
      }

      const now = performance.now();
      const base = this.isTurboActive ? this.turboUntil : now;
      this.turboUntil = base + P.TURBO_DURATION_MS;
      this.store.save();
      this.emit();

      return {
        ok: true,
        cost: isFree ? 0 : cost,
        isFree,
        nextCost: P.turboCost(state.turboCount || 0),
        durationMs: P.TURBO_DURATION_MS,
        endsAt: this.turboUntil,
      };
    }

    get state() {
      return this.store.progression;
    }

    start() {
      if (this.timer) return;
      this.timer = window.setInterval(() => this.tick(), 40);
      this.tick();
      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") this.tick();
        });
      }
    }

    tick() {
      const state = this.state;
      const activeCount = Math.min(BP.Progression.concurrency(state), state.bots.length);
      const now = performance.now();
      const currentIds = new Set(state.bots.map((bot) => bot.id));
      let hadStep = false;

      state.bots.forEach((bot, index) => {
        if (index >= activeCount) {
          const paused = this.runners.get(bot.id);
          if (paused) paused.pause();
          return;
        }

        let runner = this.runners.get(bot.id);
        if (!runner) {
          runner = new BotRunner(this, bot);
          this.runners.set(bot.id, runner);
          hadStep = true;
        } else {
          runner.resume();
        }
        if (runner.tick(now)) {
          hadStep = true;
        }
      });

      this.runners.forEach((_runner, id) => {
        if (!currentIds.has(id)) this.runners.delete(id);
      });

      if (hadStep || now - this.lastEmit >= 80) {
        this.lastEmit = now;
        this.emit();
      }
    }

    emit() {
      if (typeof this.onUpdate === "function") this.onUpdate();
    }

    getRunner(botId) {
      return this.runners.get(botId) || null;
    }

    hireBot() {
      const state = this.state;
      if (state.bots.length >= BP.Progression.maxBots(state)) {
        return { ok: false, reason: "capacity" };
      }
      const cost = BP.Progression.hireCost(state.bots.length);
      if (!this.store.spendCoins(cost)) {
        return { ok: false, reason: "coins", cost };
      }

      const number = state.nextBotId || state.bots.length + 1;
      state.nextBotId = number + 1;
      const bot = {
        id: `bot-${number}-${Date.now().toString(36)}`,
        number,
        name: `Scout-${String(number).padStart(2, "0")}`,
        difficulty: "beginner",
        skills: { xray: false, defuse: false, immortal: false, freeze: false },
        wins: 0,
        losses: 0,
        boards: 0,
        coins: 0,
        createdAt: new Date().toISOString(),
      };
      state.bots.push(bot);
      this.store.addProgressionLog(`Contratado ${bot.name} · -${cost} monedas`, "success");
      this.store.save();
      this.emit();
      return { ok: true, bot, cost };
    }

    buyUpgrade(id) {
      const def = BP.Progression.UPGRADE_DEFS[id];
      if (!def) return { ok: false, reason: "unknown" };
      const level = this.state.upgrades[id] || 0;
      const cost = BP.Progression.upgradeCost(id, level);
      if (cost == null) return { ok: false, reason: "max" };
      if (!this.store.spendCoins(cost)) return { ok: false, reason: "coins", cost };

      this.state.upgrades[id] = level + 1;
      this.store.addProgressionLog(`${def.name} · nivel ${level + 1} · -${cost} monedas`, "success");
      this.store.save();
      this.emit();
      return { ok: true, level: level + 1, cost };
    }

    buySkill(id) {
      const def = BP.Progression.SKILL_DEFS[id];
      if (!def) return { ok: false, reason: "unknown" };
      const level = this.state.skills[id] || 0;
      const cost = BP.Progression.skillCost(id, level);
      if (cost == null) return { ok: false, reason: "max" };
      if (!this.store.spendCoins(cost)) return { ok: false, reason: "coins", cost };

      this.state.skills[id] = level + 1;
      this.store.addProgressionLog(`${def.name} · nivel ${level + 1} · -${cost} monedas`, "success");
      this.store.save();
      this.emit();
      return { ok: true, level: level + 1, cost };
    }

    assignBot(botId, difficulty) {
      const bot = this.state.bots.find((item) => item.id === botId);
      if (!bot || !BP.PRESETS[difficulty]) return false;
      bot.difficulty = difficulty;
      this.store.addProgressionLog(
        `${bot.name} asignado a ${BP.PRESETS[difficulty].label}`,
        "info"
      );
      this.store.save();
      this.emit();
      return true;
    }

    toggleBotSkill(botId, skillId) {
      const bot = this.state.bots.find((item) => item.id === botId);
      if (!bot || !BP.Progression.SKILL_IDS.includes(skillId)) {
        return { ok: false, reason: "unknown" };
      }
      if (!this.state.skills[skillId]) return { ok: false, reason: "locked" };
      bot.skills[skillId] = !bot.skills[skillId];
      this.store.save();
      this.emit();
      return { ok: true, equipped: bot.skills[skillId] };
    }

    completeBoard(runner, win, reward, rewardInfo) {
      const state = this.state;
      const bot = runner.bot;
      bot.boards += 1;
      if (win) {
        bot.wins += 1;
        state.botWins += 1;
      } else {
        bot.losses += 1;
        state.botLosses += 1;
      }

      if (reward > 0) {
        bot.coins = (bot.coins || 0) + reward;
        this.store.addCoins(reward);
      }

      const elapsedSec = rewardInfo && rewardInfo.breakdown
        ? (rewardInfo.breakdown.elapsedSec || 0).toFixed(1)
        : "0";
      const cells = runner.board
        ? `${runner.board.revealedSafeCount}/${runner.board.safeCount}`
        : "0";

      if (win) {
        const speedBonus = rewardInfo && rewardInfo.breakdown && rewardInfo.breakdown.speedBonus;
        const speedTxt = speedBonus ? ` · vel: +${speedBonus}` : "";
        this.store.addProgressionLog(
          `${bot.name} despejó ${runner.preset.label} en ${elapsedSec}s (${cells} celdas) · +${reward} monedas${speedTxt}`,
          "success"
        );
      } else {
        this.store.addProgressionLog(
          `${bot.name} falló en ${runner.preset.label} a los ${elapsedSec}s (${cells} celdas) · +${reward} monedas rescatadas`,
          reward > 0 ? "warn" : "danger"
        );
      }
      this.store.save();
      this.emit();
    }

    activeCount() {
      return Math.min(BP.Progression.concurrency(this.state), this.state.bots.length);
    }
  }

  BP.BotRunner = BotRunner;
  BP.BotManager = BotManager;
})();

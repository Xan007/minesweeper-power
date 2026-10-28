/* Gesti?n del escuadr?n y sus mejoras. */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});
  const BotRunner = BP.BotRunner;

  const TURBO_RECHARGE_MS = BP.Progression.TURBO_RECHARGE_MS;

  class BotManager {
    constructor({ store }) {
      this.store = store;
      this.runners = new Map();
      this.timer = null;
      this.lastEmit = 0;
      this.onUpdate = null;
      this.onNetworkReward = null;
      this.turboUntil = 0;
      // Recarga automática: timestamp (performance.now) en el que se concede una carga gratis
      this.turboFreeRechargeAt = performance.now() + TURBO_RECHARGE_MS;
      this._lastTurboWasActive = false;
    }

    get isTurboActive() {
      return performance.now() < this.turboUntil;
    }

    get turboRemainingMs() {
      return Math.max(0, this.turboUntil - performance.now());
    }

    get speedMultiplier() {
      return this.isTurboActive ? BP.Progression.TURBO_SPEED_MULT : 1;
    }

    accelerateTurboRecharge(amountMs, now = performance.now()) {
      const amount = Math.max(0, Number(amountMs) || 0);
      const remaining = Math.max(0, this.turboFreeRechargeAt - now);
      const applied = Math.min(remaining, amount);
      this.turboFreeRechargeAt -= applied;
      return applied;
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
        this.turboFreeRechargeAt = performance.now() + TURBO_RECHARGE_MS;
        this.store.addProgressionLog(
          `¡Turbo recargado automáticamente! (${Math.round(P.TURBO_DURATION_MS / 1000)}s gratis)`,
          "success"
        );
      } else {
        state.turboCount = (state.turboCount || 0) + 1;
        // Reiniciar el temporizador de recarga gratuita al comprar
        this.turboFreeRechargeAt = performance.now() + TURBO_RECHARGE_MS;
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
        useFlags: true,
        skills: { ...BP.Progression.DEFAULT_BOT_SKILLS },
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

    setBotFlags(botId, enabled) {
      const bot = this.state.bots.find((item) => item.id === botId);
      if (!bot) return;
      bot.useFlags = Boolean(enabled);
      this.store.save();
      this.emit();
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
      if (!BP.Progression.skillUnlocked(id, level)) this.state.bots.forEach((bot) => { bot.skills[id] = true; });
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
      if (!BP.Progression.skillUnlocked(skillId, this.state.skills[skillId])) return { ok: false, reason: "locked" };
      bot.skills[skillId] = !bot.skills[skillId];
      this.store.save();
      this.emit();
      return { ok: true, equipped: bot.skills[skillId] };
    }

    takeSharedScan(recipientId) {
      const scans = this.state.network.scans;
      const index = scans.findIndex((sourceId) => sourceId !== recipientId);
      if (index < 0) return null;
      const [sourceId] = scans.splice(index, 1);
      const source = this.state.bots.find((bot) => bot.id === sourceId);
      this.state.network.assists += 1;
      this.store.save();
      return source ? source.name : "Otro bot";
    }

    recordNetworkWin(bot, difficulty = bot.difficulty) {
      const network = this.state.network;
      if (this.state.bots.length < 2) return null;
      if (network.scans.length < 6) network.scans.push(bot.id);
      const required = BP.Progression.networkDifficulty(network.level);
      if (difficulty !== "expert" && difficulty !== required) return null;
      network.progress += 1;
      const goal = BP.Progression.networkGoal(network.level);
      if (network.progress < goal) return null;
      const completedLevel = network.level;
      const reward = BP.Progression.networkReward(completedLevel);
      network.progress = 0;
      network.level += 1;
      this.store.addCoins(reward);
      this.store.addProgressionLog(`Red: operación ${completedLevel} completada · +${reward} monedas`, "success");
      return { level: completedLevel, reward };
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

      const networkReward = win ? this.recordNetworkWin(bot, runner.boardDifficulty) : null;

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
      if (networkReward && this.onNetworkReward) this.onNetworkReward(networkReward);
    }

    activeCount() {
      return Math.min(BP.Progression.concurrency(this.state), this.state.bots.length);
    }
  }

  BP.BotManager = BotManager;
})();

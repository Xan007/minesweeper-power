/* ============================================================
   BUSCAMINAS POWER · controlador de partida, poderes y récords
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});
  const U = BP.Utils;

  class Game {
    constructor({ ui, store, sound, fx }) {
      this.ui = ui;
      this.store = store;
      this.sound = sound;
      this.fx = fx;
      this.defuse = new BP.DefuseMinigame();

      this.board = null;
      this.status = "idle";
      this.mode = "beginner";
      this.modeKey = "beginner";
      this.modeLabel = "Principiante";
      this.config = { width: 9, height: 9, mines: 10 };

      this.timerRaf = null;
      this.startTs = 0;
      this.elapsedMs = 0;
      this.resultTimeout = null;
      this.xrayTimeout = null;
      this.freezeThawTimer = null;

      this.powers = this.createPowers();
      this.pendingMine = null;
      this.defuseActive = false;
      this.finished = false;
      this.lastRecord = null;
      this.lastResult = null;
      this.lastReward = 0;
      this.rewardDetails = null;
      this.lastActionAt = 0;
    }

    createPowers() {
      const skills = this.store && this.store.progression ? this.store.progression.skills : null;
      const stats = BP.Progression.manualPowerStats(skills);
      const hints = 3 + (this.store && this.store.progression ? this.store.progression.upgrades.advisor || 0 : 0);
      return {
        hint: { charges: hints, maxCharges: hints, used: 0 },
        xray: {
          charges: stats.xray.charges,
          maxCharges: stats.xray.charges,
          used: 0,
          active: false,
          endsAt: 0,
          duration: stats.xray.duration,
          radius: stats.xray.radius,
        },
        defuse: {
          charges: stats.defuse.charges,
          maxCharges: stats.defuse.charges,
          used: 0,
        },
        immortal: {
          charges: stats.immortal.charges,
          maxCharges: stats.immortal.charges,
          used: 0,
          active: false,
          clicks: 0,
          maxClicks: stats.immortal.clicks,
        },
        freeze: {
          charges: stats.freeze.charges,
          maxCharges: stats.freeze.charges,
          used: 0,
          targeting: false,
          hammerMode: false,
          areaSize: stats.freeze.areaSize,
          dragEnabled: stats.freeze.dragEnabled,
          castEndsAt: 0,
          maxFrozen: stats.freeze.maxFrozen,
          thawDuration: stats.freeze.thawDuration,
          frozen: new Map(),
          lastCenter: "",
        },
      };
    }

    newGame(config, meta = {}) {
      this.clearTimers();
      this.defuse.stop(true);
      this.ui.endXray(true);
      this.ui.setFreezeTargeting(false);
      this.ui.setHammerMode(false);
      this.ui.clearFreezeArea();
      this.ui.clearHammerHover();
      this.ui.hideShield();
      this.ui.cancelPeek();
      this.ui.clearHint();

      const normalized = BP.normalizeConfig(config.width, config.height, config.mines);
      this.config = {
        width: normalized.width,
        height: normalized.height,
        mines: normalized.mines,
      };
      this.mode = meta.mode || "custom";
      this.modeKey = meta.modeKey || BP.modeKeyFor(this.mode, this.config);
      this.modeLabel = meta.label || BP.modeLabelFor(this.mode, this.config);

      this.board = new BP.Board(this.config.width, this.config.height, this.config.mines);
      this.powers = this.createPowers();
      this.status = "ready";
      this.finished = false;
      this.pendingMine = null;
      this.defuseActive = false;
      this.lastRecord = null;
      this.lastResult = null;
      this.lastReward = 0;
      this.rewardDetails = null;
      this.elapsedMs = 0;
      this.startTs = 0;

      this.ui.buildBoard(this.board);
      this.ui.setDifficultyActive(this.mode);
      this.ui.updateHud(this);
      this.ui.updatePowers(this);
      this.ui.updateTimer(0);
      this.ui.setFace("smile");
      this.ui.showStartHint(true);
      this.ui.setStatus(
        "Haz clic en una celda para comenzar · clic derecho para poner bandera.",
        "normal"
      );
      this.ui.refreshStats();
      this.ui.updateBest();
    }

    defaultStatus() {
      const defused = this.board ? this.board.minesDefused : 0;
      return `Misión en curso · ${this.modeLabel} ${this.config.width}×${this.config.height} · ${defused} mina${defused === 1 ? "" : "s"} neutralizada${defused === 1 ? "" : "s"}.`;
    }

    clearTimers() {
      if (this.timerRaf) cancelAnimationFrame(this.timerRaf);
      this.timerRaf = null;
      if (this.resultTimeout) window.clearTimeout(this.resultTimeout);
      this.resultTimeout = null;
      if (this.xrayTimeout) window.clearTimeout(this.xrayTimeout);
      this.xrayTimeout = null;
      if (this.freezeCastTimer) window.clearTimeout(this.freezeCastTimer);
      this.freezeCastTimer = null;
      if (this.freezeThawTimer) window.clearInterval(this.freezeThawTimer);
      this.freezeThawTimer = null;
    }

    startTimer() {
      if (this.timerRaf) return;
      this.startTs = performance.now() - this.elapsedMs;
      const tick = () => {
        if (this.status !== "playing") return;
        this.elapsedMs = performance.now() - this.startTs;
        this.ui.updateTimer(this.elapsedMs);
        this.timerRaf = requestAnimationFrame(tick);
      };
      this.timerRaf = requestAnimationFrame(tick);
    }

    stopTimer() {
      if (this.timerRaf) cancelAnimationFrame(this.timerRaf);
      this.timerRaf = null;
      if (this.startTs) {
        this.elapsedMs = Math.max(0, performance.now() - this.startTs);
      }
      this.ui.updateTimer(this.elapsedMs);
    }

    beginPlay() {
      if (this.status !== "ready") return;
      this.status = "playing";
      this.elapsedMs = 0;
      this.startTimer();
      this.ui.showStartHint(false);
      this.ui.setStatus(this.defaultStatus(), "scan");
      this.ui.setFace("smile");
    }

    get isOver() {
      return this.status === "won" || this.status === "lost";
    }

    // ------------------------------------------------------------
    // Acciones del tablero
    // ------------------------------------------------------------

    reveal(x, y) {
      if (this.defuseActive || this.powers.freeze.targeting || this.powers.freeze.hammerMode) return;
      const cell = this.board ? this.board.getCell(x, y) : null;
      if (!cell) return;

      if (this.status === "ready") {
        if (cell.revealed || cell.flagged) return;
        this.beginPlay();
      } else if (this.status !== "playing") {
        return;
      }

      if (cell.revealed || cell.flagged) return;
      this.ui.clearHint();

      const shieldWasActive = this.powers.immortal.active;
      if (shieldWasActive) this.spendShieldClick();

      const result = this.board.reveal(x, y);
      if (result.kind === "mine") {
        this.handleMine(cell, shieldWasActive);
      } else if (result.kind === "safe") {
        this.afterSafeReveal(result.changed);
      }

      this.afterShieldAction(shieldWasActive);
    }

    afterSafeReveal(changed) {
      if (!changed || changed.length === 0) return;
      this.lastActionAt = performance.now();
      this.ui.revealCells(changed);
      this.sound.play(changed.length > 10 ? "revealBig" : "reveal");
      if (changed.length >= 8 && this.fx && this.fx.cascadeSparkle) {
        const elements = changed.slice(0, 24).map((c) => this.ui.getCellElement(c.x, c.y)).filter(Boolean);
        this.fx.cascadeSparkle(elements);
        this.fx.shakeLight();
        this.sound.play("sparkle");
      }
      if (this.powers.immortal.active) {
        this.ui.setStatus(
          `Escudo activo · ${this.powers.immortal.clicks} clics restantes.`,
          "normal"
        );
      }
      this.ui.updateHud(this);
      this.ui.updatePowers(this);
      this.checkWin();
    }

    handleMine(cell, shieldWasActive) {
      if (shieldWasActive) {
        this.board.defuse(cell);
        this.ui.updateCell(cell);
        this.sound.play("thunder");
        this.sound.play("absorb");
        const element = this.ui.getCellElement(cell.x, cell.y);
        if (element) {
          if (this.fx.shieldZap) this.fx.shieldZap(element);
          else this.fx.shield(element);
        }
        this.store.addCoins(15);
        this.sound.play("coin");
        this.ui.refreshProgression();
        this.ui.toast("¡Rayo celestial! El escudo fulminó la mina (+15 monedas).", "success");
        this.ui.updateHud(this);
        this.ui.updatePowers(this);
        this.checkWin();
        return;
      }

      if (this.powers.defuse.charges > 0) {
        this.beginDefuse(cell);
        return;
      }

      this.lose(cell, "mine");
    }

    flag(x, y) {
      if (this.defuseActive || this.isOver || !this.board) return;
      if (this.powers.freeze.targeting || this.powers.freeze.hammerMode) {
        this.cancelFreeze(true);
        return;
      }
      const cell = this.board.getCell(x, y);
      if (!cell || cell.revealed) return;
      if (cell.frozen) {
        this.ui.toast("Esa celda está congelada: usa el martillo o espera al deshielo.", "warn");
        return;
      }
      const flagged = this.board.toggleFlag(x, y);
      if (!flagged) return;
      this.ui.clearHint();
      this.ui.updateCell(cell);
      this.sound.play(flagged.flagged ? "flag" : "unflag");
      this.ui.updateHud(this);
      U.vibrate(12);
    }

    chord(x, y) {
      if (this.status !== "playing" || this.defuseActive || !this.board) return;
      if (this.powers.freeze.targeting || this.powers.freeze.hammerMode) return;
      if (!this.board.canChord(x, y)) return;
      this.ui.clearHint();

      const shieldWasActive = this.powers.immortal.active;
      if (shieldWasActive) this.spendShieldClick();

      const result = this.board.chord(x, y);
      if (result.kind === "mine") {
        this.handleMine(result.cell, shieldWasActive);
      } else if (result.kind === "safe") {
        this.afterSafeReveal(result.changed);
      }

      this.afterShieldAction(shieldWasActive);
    }

    checkWin() {
      if (this.status !== "playing") return;
      if (this.board && this.board.allSafeRevealed()) {
        this.win();
      }
    }

    // ------------------------------------------------------------
    // Poderes
    // ------------------------------------------------------------

    usePower(id) {
      if (id === "defuse") {
        const charges = this.powers.defuse.charges;
        this.ui.toast(
          charges > 0
            ? `Kit de desarme listo · ${charges} uso(s). Se activa automáticamente al pisar una mina.`
            : "No quedan kits de desarme en esta partida.",
          charges > 0 ? "info" : "warn"
        );
        this.ui.flashPowerCard("defuse");
        return;
      }

      if (id === "xray") {
        this.activateXray();
      } else if (id === "hint") {
        this.requestHint();
      } else if (id === "immortal") {
        this.activateImmortal();
      } else if (id === "freeze") {
        this.toggleFreezeTool();
      }
    }

    requestHint() {
      if (!this.guardPower("hint")) return false;
      if (this.powers.freeze.frozen.size > 0) {
        this.ui.toast("Rompe el hielo o espera a que se derrita para solicitar una pista.", "warn", 4000);
        return false;
      }
      let wrongFlag = false;
      this.board.forEach((cell) => { if (cell.flagged && !cell.mine) wrongFlag = true; });
      if (wrongFlag) {
        this.ui.toast("Revisa tus banderas: al menos una es incorrecta. No se gastó la pista.", "warn", 4000);
        return false;
      }
      const analysis = BP.BotBrain.analyze(this.board);
      const target = analysis.safe[0] || analysis.mines[0];
      if (!target) {
        this.ui.toast("No hay una jugada segura que el consejero pueda deducir. Prueba Visión X.", "info", 4000);
        return false;
      }
      const isMine = analysis.safe.length === 0;
      this.cancelFreeze(false);
      this.powers.hint.charges -= 1;
      this.powers.hint.used += 1;
      const action = isMine ? "Clic derecho: marca esta mina" : "Clic izquierdo: abre esta celda segura";
      this.ui.showHint(target, isMine);
      this.ui.setStatus(`${action} · fila ${target.y + 1}, columna ${target.x + 1}.`, "scan");
      this.ui.toast(`${action}. Deducido de las pistas y banderas visibles.`, "info", 4000);
      this.ui.updatePowers(this);
      this.ui.flashPowerCard("hint");
      this.sound.play("click");
      return true;
    }

    guardPower(id) {
      if (this.defuseActive) {
        this.ui.toast("Termina el corte de la mina antes de usar otro poder.", "warn");
        return false;
      }
      if (this.status === "ready") {
        this.ui.toast("Descubre una celda primero para entrar en combate.", "warn");
        return false;
      }
      if (this.status !== "playing") {
        this.ui.toast("La partida ya ha terminado. Inicia una nueva misión.", "warn");
        return false;
      }
      if (this.powers[id].charges <= 0) {
        this.ui.toast("Sin cargas disponibles para este poder.", "warn");
        return false;
      }
      return true;
    }

    activateXray() {
      const power = this.powers.xray;
      if (power.active) {
        this.ui.toast("La Visión X ya está escaneando.", "warn");
        return;
      }
      if (!this.guardPower("xray")) return;

      this.cancelFreeze(false);
      power.charges -= 1;
      power.used += 1;
      power.active = true;
      power.endsAt = performance.now() + power.duration;

      this.ui.startXray(power.endsAt, power.duration);
      this.ui.setStatus("Visión X activa · apunta a una celda para ver su contenido.", "scan");
      this.ui.setFace("focus");
      this.ui.updatePowers(this);
      this.ui.updateHud(this);
      this.ui.flashPowerCard("xray");
      if (this.fx && this.fx.radarWave) {
        this.fx.radarWave(this.ui.boardEl || this.ui.boardWrap);
      }
      this.sound.play("radarWave");
      this.sound.play("xrayStart");
      this.ui.toast(`Visión X activa · ${power.duration / 1000} segundos de escaneo.`, "info");

      if (this.xrayTimeout) window.clearTimeout(this.xrayTimeout);
      this.xrayTimeout = window.setTimeout(() => this.endXray(true), power.duration + 40);
    }

    endXray(silent = false) {
      const power = this.powers.xray;
      if (!power || !power.active) {
        this.ui.endXray(true);
        return;
      }
      power.active = false;
      power.endsAt = 0;
      if (this.xrayTimeout) window.clearTimeout(this.xrayTimeout);
      this.xrayTimeout = null;
      this.ui.endXray(silent);
      this.ui.updatePowers(this);
      if (this.status === "playing") {
        if (!silent) this.sound.play("xrayEnd");
        this.ui.setStatus(this.defaultStatus(), "scan");
        this.ui.setFace(
          this.powers.freeze.targeting || this.powers.freeze.hammerMode ? "focus" : "smile"
        );
        if (!silent) this.ui.toast("Visión X finalizada.", "info");
      }
    }

    toggleFreezeTool() {
      const power = this.powers.freeze;
      if (!power) return;
      if (this.defuseActive) {
        this.ui.toast("Termina el corte de la mina antes de usar el cañón.", "warn");
        return;
      }
      if (this.status === "ready") {
        this.ui.toast("Descubre una celda primero para entrar en combate.", "warn");
        return;
      }
      if (this.status !== "playing") {
        this.ui.toast("La partida ya ha terminado. Inicia una nueva misión.", "warn");
        return;
      }

      if (power.hammerMode) {
        this.cancelFreeze(true);
        return;
      }

      if (power.targeting) {
        if (power.frozen.size > 0) {
          this.enterHammerMode();
        } else {
          this.cancelFreeze(true);
        }
        return;
      }

      if (power.charges <= 0) {
        if (power.frozen.size > 0) this.enterHammerMode();
        else this.ui.toast("El cañón criogénico no tiene cargas en esta partida.", "warn");
        return;
      }

      this.activateFreeze();
    }

    activateFreeze() {
      const power = this.powers.freeze;
      if (!power) return;
      if (power.charges <= 0) {
        this.ui.toast("El cañón criogénico no tiene cargas en esta partida.", "warn");
        return;
      }
      if (power.frozen.size >= power.maxFrozen) {
        this.enterHammerMode();
        return;
      }

      this.endXray(true);
      power.charges -= 1;
      power.used += 1;
      power.castEndsAt = performance.now() + 3000;
      this.freezeCastTimer = window.setTimeout(() => {
        this.freezeCastTimer = null;
        if (!power.targeting || this.status !== "playing") return;
        if (power.frozen.size) this.enterHammerMode();
        else this.cancelFreeze(false);
      }, 3000);
      power.targeting = true;
      power.hammerMode = false;
      power.lastCenter = "";
      this.ui.setFreezeTargeting(true);
      this.ui.setHammerMode(false);
      this.ui.updateFreezeStatus(power);
      const instruction = power.dragEnabled ? "Mantén pulsado y arrastra" : "Haz clic en las celdas";
      this.ui.setStatus(`${instruction} para congelar; luego rompe el hielo.`, "ice");
      this.ui.setFace("focus");
      this.ui.updatePowers(this);
      this.ui.flashPowerCard("freeze");
      this.sound.play("power");
      this.ui.toast(`${instruction} para congelar. Luego usa el martillo.`, "info");
    }

    enterHammerMode() {
      const power = this.powers.freeze;
      if (!power) return false;
      if (power.frozen.size === 0) {
        this.ui.toast("No hay celdas congeladas. Congela una primero.", "warn");
        return false;
      }

      if (this.freezeCastTimer) window.clearTimeout(this.freezeCastTimer);
      this.freezeCastTimer = null;
      power.targeting = false;
      power.hammerMode = true;
      power.lastCenter = "";
      this.ui.setFreezeTargeting(false);
      this.ui.setHammerMode(true);
      this.ui.updatePowers(this);
      this.ui.updateFreezeStatus(power);
      this.ui.setFace("focus");
      this.ui.setStatus(
        `Martillo listo · golpea una celda congelada · ${power.frozen.size}/${power.maxFrozen} en el campo.`,
        "ice"
      );
      this.ui.flashPowerCard("freeze");
      this.sound.play("hammer");
      this.ui.toast("Martillo listo · rompe el hielo antes de que la celda se descongele.", "info");
      return true;
    }

    cancelFreeze(announce = false) {
      const power = this.powers.freeze;
      if (!power) return;
      if (this.freezeCastTimer) window.clearTimeout(this.freezeCastTimer);
      this.freezeCastTimer = null;
      const wasTargeting = power.targeting;
      const wasHammer = power.hammerMode;
      power.targeting = false;
      power.hammerMode = false;
      power.lastCenter = "";
      this.ui.setFreezeTargeting(false);
      this.ui.setHammerMode(false);
      this.ui.clearFreezeArea();
      this.ui.clearHammerHover();
      this.ui.updateFreezeStatus(power);
      this.ui.updatePowers(this);
      if (this.status === "playing") {
        this.ui.setFace("smile");
        this.ui.setStatus(this.defaultStatus(), "scan");
      }
      if (announce && (wasTargeting || wasHammer)) {
        const frozen = power.frozen.size;
        this.ui.toast(
          frozen > 0
            ? `Herramienta desarmada · ${frozen} celda${frozen === 1 ? "" : "s"} congelada${frozen === 1 ? "" : "s"} sigue${frozen === 1 ? "" : "n"} en el campo.`
            : "Cañón criogénico desarmado.",
          "info"
        );
      }
    }

    freezeCell(x, y) {
      const power = this.powers.freeze;
      if (!power || !power.targeting || this.status !== "playing" || this.defuseActive) {
        return false;
      }
      if (performance.now() >= power.castEndsAt) {
        if (power.frozen.size) this.enterHammerMode();
        else this.cancelFreeze(false);
        return false;
      }
      const now = performance.now();
      const size = power.areaSize;
      const offset = Math.floor((size - 1) / 2);
      let added = 0;
      for (let dy = 0; dy < size; dy += 1) {
        for (let dx = 0; dx < size; dx += 1) {
          const cell = this.board.getCell(x + dx - offset, y + dy - offset);
          if (!cell || cell.revealed || cell.flagged || cell.frozen || power.frozen.size >= power.maxFrozen) continue;
          cell.frozen = true;
          const key = `${cell.x},${cell.y}`;
          power.frozen.set(key, { key, cell, startedAt: now, expiresAt: now + power.thawDuration, duration: power.thawDuration });
          this.ui.animateFreezeCell(cell);
          added += 1;
        }
      }
      if (!added) return false;
      this.ui.clearHint();
      this.ui.updateFreezeStatus(power);
      this.ui.updatePowers(this);
      this.ui.updateHud(this);
      const freezeEl = this.ui.getCellElement(x, y);
      if (freezeEl && this.fx && this.fx.frostBurst) this.fx.frostBurst(freezeEl);
      this.sound.play("freeze");
      this.lastActionAt = now;
      this.startFreezeThawTicker();
      if (power.frozen.size >= power.maxFrozen) this.enterHammerMode();
      return true;
    }

    hammerCell(x, y) {
      const power = this.powers.freeze;
      if (!power || this.status !== "playing" || this.defuseActive) {
        return false;
      }
      const cell = this.board ? this.board.getCell(x, y) : null;
      if (!cell) return false;
      const key = `${x},${y}`;
      const entry = power.frozen.get(key);
      if (!entry || !cell.frozen) {
        this.ui.toast("El martillo solo rompe celdas congeladas.", "warn");
        this.ui.clearHammerHover();
        return false;
      }

      power.frozen.delete(key);
      this.ui.clearHint();
      cell.frozen = false;
      this.ui.clearHammerHover();
      this.lastActionAt = performance.now();
      this.sound.play("hammer");
      this.sound.play("iceShatter");

      const element = this.ui.getCellElement(x, y);
      if (element) {
        if (this.fx.iceShatter) this.fx.iceShatter(element, cell.mine);
        else this.fx.ice([element]);
      }

      if (cell.mine) {
        this.board.defuse(cell);
        this.ui.updateCell(cell);
        this.ui.completeFreeze([cell]);
        this.store.addCoins(10);
        this.ui.refreshProgression();
        this.ui.toast("¡Mina pulverizada con el martillo! +10 monedas.", "success");
        this.ui.updateHud(this);
      } else {
        const result = this.board.reveal(x, y);
        if (result.kind === "mine") {
          this.handleMine(cell, false);
        } else if (result.kind === "safe") {
          this.afterSafeReveal(result.changed);
          this.ui.completeFreeze([cell]);
        }
      }

      if (power.frozen.size === 0) {
        power.hammerMode = false;
        this.ui.setHammerMode(false);
        this.ui.updateFreezeStatus(power);
        this.ui.setFace("smile");
        this.ui.setStatus(this.defaultStatus(), "scan");
      } else {
        this.ui.updateFreezeStatus(power);
        this.ui.setStatus(
          `Martillo listo · quedan ${power.frozen.size} celda${power.frozen.size === 1 ? "" : "s"} congelada${power.frozen.size === 1 ? "" : "s"}.`,
          "ice"
        );
      }

      this.ui.updatePowers(this);
      this.checkWin();
      return true;
    }

    startFreezeThawTicker() {
      if (this.freezeThawTimer) return;
      this.freezeThawTimer = window.setInterval(() => this.updateThaw(), 100);
    }

    stopFreezeThawTicker() {
      if (this.freezeThawTimer) window.clearInterval(this.freezeThawTimer);
      this.freezeThawTimer = null;
    }

    updateThaw() {
      const power = this.powers.freeze;
      if (!power || power.frozen.size === 0) {
        this.stopFreezeThawTicker();
        return;
      }
      const now = performance.now();
      let changed = false;

      Array.from(power.frozen.values()).forEach((entry) => {
        const remaining = entry.expiresAt - now;
        if (remaining <= 0) {
          this.thawCell(entry, true);
          changed = true;
        } else {
          this.ui.updateFrozenThaw(entry.cell, remaining / entry.duration);
        }
      });

      if (changed || power.frozen.size > 0) {
        this.ui.updateFreezeStatus(power);
        this.ui.updatePowers(this);
      }
      if (power.frozen.size === 0) {
        this.stopFreezeThawTicker();
        if (power.hammerMode) {
          power.hammerMode = false;
          this.ui.setHammerMode(false);
          this.ui.setFace("smile");
          this.ui.setStatus(this.defaultStatus(), "scan");
        }
      }
    }

    thawCell(entry, announce = false) {
      const power = this.powers.freeze;
      if (!power || !entry) return;
      if (!power.frozen.has(entry.key)) return;
      power.frozen.delete(entry.key);
      entry.cell.frozen = false;
      this.ui.updateCell(entry.cell);
      this.ui.clearHammerHover();
      this.sound.play("thaw");
      if (announce) {
        this.ui.toast("La celda se descongeló por completo. El martillo ya no puede romperla.", "warn", 3000);
      }
      this.ui.updateFreezeStatus(power);
      this.ui.updatePowers(this);
      this.ui.updateHud(this);

      if (power.hammerMode && power.frozen.size > 0) {
        this.ui.setStatus(
          `Martillo listo · quedan ${power.frozen.size} celda${power.frozen.size === 1 ? "" : "s"} congelada${power.frozen.size === 1 ? "" : "s"} · el hielo derretido ya no se puede romper.`,
          "ice"
        );
      } else if (!power.hammerMode && power.targeting) {
        this.ui.setStatus(
          `Cañón criogénico armado · elige una celda · ${power.charges} carga${power.charges === 1 ? "" : "s"} · máx. ${power.maxFrozen} congeladas.`,
          "ice"
        );
      }
    }

    clearFrozenCells(updateUI = true) {
      const power = this.powers.freeze;
      if (!power) return;
      this.stopFreezeThawTicker();
      power.frozen.forEach((entry) => {
        entry.cell.frozen = false;
      });
      power.frozen.clear();
      power.targeting = false;
      power.hammerMode = false;
      if (updateUI) {
        this.ui.setFreezeTargeting(false);
        this.ui.setHammerMode(false);
        this.ui.clearFreezeArea();
        this.ui.clearHammerHover();
        this.ui.updateFreezeStatus(power);
      }
    }

    freezeSeconds(ms) {
      return Math.max(0, ms) / 1000;
    }

    activateImmortal() {
      const power = this.powers.immortal;
      if (power.active) {
        this.ui.toast(`El escudo ya está activo · ${power.clicks} clics restantes.`, "warn");
        return;
      }
      if (!this.guardPower("immortal")) return;

      power.charges -= 1;
      power.used += 1;
      power.active = true;
      power.clicks = power.maxClicks;

      this.ui.setShield(power.clicks);
      this.ui.setStatus(`Escudo de inmortalidad · ${power.clicks} clics de protección.`, "normal");
      this.ui.updatePowers(this);
      this.ui.updateHud(this);
      this.ui.flashPowerCard("immortal");
      if (this.fx && this.fx.shieldActivate) {
        this.fx.shieldActivate(this.ui.boardEl || this.ui.boardWrap);
      }
      this.sound.play("shieldActivate");
      this.sound.play("shield");
      this.ui.toast(`Inmortalidad activa · ${power.maxClicks} clics protegidos.`, "success");
    }

    spendShieldClick() {
      const power = this.powers.immortal;
      if (!power.active) return;
      power.clicks = Math.max(0, power.clicks - 1);
      this.ui.setShield(power.clicks);
      this.ui.updatePowers(this);
      this.ui.updateHud(this);
      if (this.fx && this.fx.shieldPulse && this.lastClickedCell) {
        const el = this.ui.getCellElement(this.lastClickedCell.x, this.lastClickedCell.y);
        if (el) this.fx.shieldPulse(el);
      }
      this.sound.play("hover");
    }

    afterShieldAction(shieldWasActive) {
      if (!shieldWasActive) return;
      if (this.powers.immortal.clicks <= 0) {
        this.endShield(true);
      }
    }

    endShield(announce = false) {
      const power = this.powers.immortal;
      if (!power.active) return;
      power.active = false;
      power.clicks = 0;
      this.ui.hideShield();
      this.ui.updatePowers(this);
      if (announce && this.status === "playing") {
        this.sound.play("shieldEnd");
        this.ui.toast("Escudo agotado. Vuelve a tener cuidado.", "warn");
        this.ui.setStatus("Escudo agotado · sin protección adicional.", "warn");
      }
    }

    // ------------------------------------------------------------
    // Desarme
    // ------------------------------------------------------------

    beginDefuse(cell) {
      const power = this.powers.defuse;
      power.charges -= 1;
      power.used += 1;
      this.defuseActive = true;
      this.pendingMine = cell;
      this.ui.updatePowers(this);
      this.ui.setFace("focus");
      this.ui.setStatus("MINA ACTIVA · detén la aguja dentro de la zona blanca.", "danger");
      this.ui.toast("¡Mina activada! Pulsa Espacio o haz clic cuando la aguja esté en blanco.", "danger", 4200);

      const density = this.board.mineCount / this.board.area;
      const targetWidth = U.clamp(43 - density * 55, 30, 40);
      const speed = 195 + density * 370;

      this.defuse.start({
        targetWidth,
        speed,
        onCut: (info) => {
          this.sound.play("cut");
          if (info.success) {
            this.fx.shield(this.ui.getCellElement(cell.x, cell.y));
          }
        },
        onResult: (success) => this.resolveDefuse(success),
      });
    }

    cutDefuse() {
      if (this.defuseActive) this.defuse.cut();
    }

    resolveDefuse(success) {
      this.defuseActive = false;
      const cell = this.pendingMine;
      this.pendingMine = null;
      this.ui.updatePowers(this);

      if (success && cell) {
        this.board.defuse(cell);
        this.ui.updateCell(cell);
        this.ui.updateHud(this);
        this.ui.setFace("smile");
        this.ui.setStatus(this.defaultStatus(), "scan");
        this.sound.play("defuseSuccess");
        const element = this.ui.getCellElement(cell.x, cell.y);
        if (element) {
          if (this.fx && this.fx.defuseCut) this.fx.defuseCut(element, true);
          else this.fx.defuse(element);
        }
        this.sound.play("coin");
        this.store.addCoins(10);
        this.ui.refreshProgression();
        this.ui.toast("Corte limpio · mina neutralizada. +10 monedas.", "success");
        this.checkWin();
      } else if (cell) {
        this.sound.play("defuseFail");
        this.lose(cell, "defuse");
      }
    }

    // ------------------------------------------------------------
    // Fin de partida
    // ------------------------------------------------------------

    win() {
      if (this.status !== "playing") return;
      this.status = "won";
      this.finished = true;
      this.stopTimer();
      this.endXray(true);
      this.cancelFreeze(false);
      this.clearFrozenCells(false);
      this.endShield(false);
      this.ui.clearHint();
      this.rewardDetails = BP.Progression.manualRewardDetails(
        this.mode, this.config, this.elapsedMs, this.board.flagsPlaced, this.board.minesDefused
      );
      this.board.flagAllMines();
      this.ui.updateAllCells();
      this.ui.setFace("win");
      this.ui.setStatus("Campo despejado · misión completada.", "success");
      this.ui.updateHud(this);
      this.ui.updatePowers(this);
      this.sound.play("win");
      this.fx.win();

      const reward = this.rewardDetails.total;
      const salvageBonus = Math.round(reward * (this.store.progression.upgrades.salvage || 0) * 0.1);
      const progression = this.store.progression;
      if (this.mode === "expert") {
        progression.expertStreak += 1;
        progression.bestExpertStreak = Math.max(progression.bestExpertStreak, progression.expertStreak);
      }
      const streakBonus = this.mode === "expert" ? BP.Progression.expertStreakBonus(reward, progression.expertStreak) : 0;
      this.store.progression.manualWins += 1;
      const usedPowers = Object.values(this.powers).reduce((sum, power) => sum + power.used, 0);
      const contracts = BP.Contracts.completeWin(this.store.progression, {
        mode: this.mode, elapsedMs: this.elapsedMs, usedPowers,
      });
      this.rewardDetails.salvageBonus = salvageBonus;
      this.rewardDetails.streakBonus = streakBonus;
      this.rewardDetails.contractBonus = contracts.total;
      this.lastReward = reward + salvageBonus + streakBonus + contracts.total;
      this.store.addCoins(this.lastReward);
      this.store.addProgressionLog(
        `Misión manual ${this.modeLabel} completada · +${BP.Progression.formatCoins(this.lastReward)} monedas`,
        "success"
      );

      this.lastRecord = this.saveResult(true);
      this.ui.refreshStats();
      this.ui.updateBest();
      this.ui.refreshProgression();
      this.ui.toast(
        `Victoria · +${BP.Progression.formatCoins(this.lastReward)} monedas${contracts.awarded.length ? ` · ${contracts.awarded.length} contrato(s)` : ""}.`,
        "success",
        4200
      );

      const data = this.buildResultData(true, "clear");
      this.resultTimeout = window.setTimeout(() => {
        this.ui.showResult(data);
        if (this.lastRecord && this.lastRecord.isRecord) {
          this.sound.play("record");
        }
      }, 1100);
    }

    lose(cell, reason = "mine") {
      if (this.status === "lost" || this.status === "won") return;
      this.status = "lost";
      this.finished = true;
      this.stopTimer();
      this.endXray(true);
      this.cancelFreeze(false);
      this.clearFrozenCells(false);
      this.endShield(false);
      this.ui.clearHint();

      this.board.revealAllMines(cell);
      this.ui.updateAllCells();
      this.ui.setFace("dead");
      this.ui.setStatus("BOOM · mina detonada. Misión fallida.", "danger");
      this.ui.updatePowers(this);

      const element = this.ui.getCellElement(cell.x, cell.y);
      if (element) this.fx.explosion(element);
      this.sound.play("explode");

      const revealed = this.board ? this.board.revealedSafeCount : 0;
      const totalSafe = this.board ? this.board.safeCount : 1;
      if (this.mode === "expert") this.store.progression.expertStreak = 0;
      const lossReward = BP.Progression.manualLossReward(this.mode, this.config, revealed, totalSafe);
      this.lastReward = lossReward;
      if (lossReward > 0) {
        this.store.addCoins(lossReward);
        this.store.addProgressionLog(
          `Derrota en ${this.modeLabel} · Rescate: +${BP.Progression.formatCoins(lossReward)} monedas`,
          "info"
        );
      }

      this.ui.toast(
        lossReward > 0
          ? `Mina detonada · Rescataste +${BP.Progression.formatCoins(lossReward)} monedas.`
          : "Mina detonada. Partida terminada.",
        "danger",
        3600
      );
      this.lastRecord = this.saveResult(false);
      this.ui.refreshStats();
      this.ui.updateHud(this);
      this.ui.refreshProgression();

      const data = this.buildResultData(false, reason);
      this.resultTimeout = window.setTimeout(() => this.ui.showResult(data), 1450);
    }

    saveResult(isWin) {
      const usedPowers = {
        xray: this.powers.xray.used,
        defuse: this.powers.defuse.used,
        immortal: this.powers.immortal.used,
        freeze: this.powers.freeze.used,
        hint: this.powers.hint.used,
      };
      const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        date: new Date().toISOString(),
        mode: this.mode,
        modeKey: this.modeKey,
        modeLabel: this.modeLabel,
        width: this.config.width,
        height: this.config.height,
        mines: this.config.mines,
        result: isWin ? "win" : "lose",
        timeMs: Math.round(this.elapsedMs),
        powers: usedPowers,
      };
      return this.store.record(entry, isWin);
    }

    buildResultData(isWin, reason) {
      const usedPowers =
        this.powers.xray.used +
        this.powers.defuse.used +
        this.powers.immortal.used +
        this.powers.freeze.used +
        this.powers.hint.used;
      return {
        result: isWin ? "win" : "lose",
        reason,
        timeMs: Math.round(this.elapsedMs),
        isRecord: Boolean(this.lastRecord && this.lastRecord.isRecord),
        bestMs: this.lastRecord && this.lastRecord.best ? this.lastRecord.best.timeMs : null,
        modeLabel: this.modeLabel,
        width: this.config.width,
        height: this.config.height,
        mines: this.config.mines,
        usedPowers,
        totalPowers: Object.values(this.powers).reduce((sum, power) => sum + power.maxCharges, 0),
        reward: this.lastReward,
        rewardDetails: this.rewardDetails,
        coins: this.store.progression.coins,
      };
    }
  }

  BP.Game = Game;
})();

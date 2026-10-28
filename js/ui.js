/* ============================================================
   BUSCAMINAS POWER · Coordinador principal de interfaz
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});
  const U = BP.Utils;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  class UI {
    constructor({ store, sound, fx }) {
      this.store = store;
      this.sound = sound;
      this.fx = fx;
      this.game = null;
      this.bots = null;
      this.currentView = "play";
      this.tipIndex = 0;
      this._lastCoins = store && store.progression ? store.progression.coins : 0;

      // Componentes modulares
      this.modals = new BP.ModalsComponent({ ui: this, store, sound, fx });
      this.boardView = new BP.BoardViewComponent({ ui: this, store, sound, fx });
      this.hq = new BP.HqComponent({ ui: this, store, sound, fx });
      this.spectator = new BP.SpectatorComponent({ ui: this, store, sound, fx });
      this.contracts = new BP.ContractsView(store);
      this.extractor = new BP.ExtractorComponent({ ui: this, store, sound, fx });

      // Elementos globales de navegación y barra lateral
      this.viewTabPlay = $("#viewTabPlay");
      this.viewTabSpectator = $("#viewTabSpectator");
      this.playView = $("#playView");
      this.spectatorView = $("#spectatorView");

      this.soundBtn = $("#soundBtn");
      this.soundIcon = $("#soundIcon");
      this.customPanel = $("#customPanel");
      this.customWidth = $("#customWidth");
      this.customHeight = $("#customHeight");
      this.customMines = $("#customMines");
      this.customHint = $("#customHint");
      this.tipText = $("#tipText");

      this.coinChip = $("#coinChip");
      this.coinCount = $("#coinCount");
      this.coreCoinsValue = $("#coreCoinsValue");
      this.coreBots = $("#coreBots");
      this.coreActive = $("#coreActive");
      this.coreBotWins = $("#coreBotWins");
      this.coreBotHint = $("#coreBotHint");
      this.coreHireCost = $("#coreHireCost");
      this.coreOpenBtn = $("#coreOpenBtn");
      this.coreHireBtn = $("#coreHireBtn");
      this.coreWatchBtn = $("#coreWatchBtn");

      this.bindGlobalEvents();
      this.updateSoundButton();
      this.startTipRotation();

      window.addEventListener("resize", () => {
        if (this.currentView === "play") this.boardView.fitCellSize();
      });
    }

    // Delegación de propiedades del tablero
    get boardFrame() { return this.boardView.boardFrame; }
    get boardEl() { return this.boardView.boardEl; }
    get boardWrap() { return this.boardView.boardWrap; }
    get boardViewport() { return this.boardView.boardViewport; }
    get activeModal() { return this.modals.activeModal; }
    get spectatorMode() { return this.spectator.spectatorMode; }
    set spectatorMode(val) { this.spectator.spectatorMode = val; }
    get selectedBotId() { return this.spectator.selectedBotId; }
    set selectedBotId(val) { this.spectator.selectedBotId = val; }

    attach(game, bots = null) {
      this.game = game;
      this.bots = bots;
      if (this.bots) {
        this.bots.onNetworkReward = ({ level, reward }) => {
          this.sound.play("coin");
          this.fx.coinBurst(this.coinChip, 22);
          this.fx.shakeHeavy();
          this.toast(`Operación ${level} completada · +${BP.Progression.formatCoins(reward)} monedas`, "success", 4200);
        };
        this.bots.onUpdate = () => {
          this.hq.updateBotLive();
          this.hq.updateHqSummary();
          this.spectator.renderSpectator();
          this.refreshProgression();
        };
      }
      this.refreshProgression();
      this.spectator.renderSpectator();
    }

    bindGlobalEvents() {
      // Dificultades
      $$(".diff-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const diff = btn.dataset.diff;
          if (!this.game) return;
          if (diff === "custom") {
            this.toggleCustomPanel();
            return;
          }
          const preset = BP.PRESETS[diff];
          if (!preset) return;
          this.hideCustomPanel();
          this.closeAllModals();
          this.store.updateSettings({ difficulty: diff });
          this.game.newGame(
            { width: preset.width, height: preset.height, mines: preset.mines },
            { mode: diff, modeKey: diff, label: preset.label }
          );
          this.sound.play("click");
        });
      });

      // Panel personalizado
      const applyCustom = () => this.applyCustomConfig();
      const customApplyBtn = $("#customApply");
      if (customApplyBtn) customApplyBtn.addEventListener("click", applyCustom);
      [this.customWidth, this.customHeight, this.customMines].forEach((input) => {
        if (!input) return;
        input.addEventListener("input", () => this.updateCustomHint());
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            applyCustom();
          }
        });
      });

      // Botón Sonido
      if (this.soundBtn) {
        this.soundBtn.addEventListener("click", () => {
          const enabled = this.sound.toggle();
          this.updateSoundButton();
          this.toast(enabled ? "Efectos de sonido activados." : "Sonido silenciado.", "info", 1800);
        });
      }

      // Cuartel & Récords
      const openHqBots = () => this.openHq("bots");
      const coinChip = $("#coinChip");
      const hqBtn = $("#hqBtn");
      if (coinChip) coinChip.addEventListener("click", openHqBots);
      if (hqBtn) hqBtn.addEventListener("click", openHqBots);
      if (this.coreOpenBtn) this.coreOpenBtn.addEventListener("click", openHqBots);
      if (this.coreHireBtn) this.coreHireBtn.addEventListener("click", () => this.handleHire());
      if (this.coreWatchBtn) this.coreWatchBtn.addEventListener("click", () => this.switchView("spectator"));

      const recordsBtn = $("#recordsBtn");
      const recordsBtn2 = $("#recordsBtn2");
      const helpBtn = $("#helpBtn");
      const newGameBtn = $("#newGameBtn");
      if (recordsBtn) recordsBtn.addEventListener("click", () => this.openRecords());
      if (recordsBtn2) recordsBtn2.addEventListener("click", () => this.openRecords());
      if (helpBtn) helpBtn.addEventListener("click", () => this.openHelp());
      if (newGameBtn) newGameBtn.addEventListener("click", () => this.startSameGame());

      // Pestañas principales (Mi Partida vs Bots en vivo)
      if (this.viewTabPlay) {
        this.viewTabPlay.addEventListener("click", () => this.switchView("play"));
      }
      if (this.viewTabSpectator) {
        this.viewTabSpectator.addEventListener("click", () => this.switchView("spectator"));
      }
    }

    switchView(view, botId = null) {
      if (botId) {
        this.selectedBotId = botId;
        this.spectatorMode = "single";
      }

      if (view === "spectator") {
        this.currentView = "spectator";
        if (this.viewTabPlay) {
          this.viewTabPlay.classList.remove("is-active");
          this.viewTabPlay.setAttribute("aria-selected", "false");
        }
        if (this.viewTabSpectator) {
          this.viewTabSpectator.classList.add("is-active");
          this.viewTabSpectator.setAttribute("aria-selected", "true");
        }
        if (this.playView) this.playView.hidden = true;
        if (this.spectatorView) this.spectatorView.hidden = false;
        this.spectator.renderSpectator(true);
        this.spectator.startLiveLoop();
      } else {
        this.currentView = "play";
        this.spectator.stopLiveLoop();
        if (this.viewTabSpectator) {
          this.viewTabSpectator.classList.remove("is-active");
          this.viewTabSpectator.setAttribute("aria-selected", "false");
        }
        if (this.viewTabPlay) {
          this.viewTabPlay.classList.add("is-active");
          this.viewTabPlay.setAttribute("aria-selected", "true");
        }
        if (this.spectatorView) this.spectatorView.hidden = true;
        if (this.playView) this.playView.hidden = false;
        this.boardView.fitCellSize();
      }
    }

    refreshProgression() {
      if (!this.store) return;
      const state = this.store.progression;
      const P = BP.Progression;
      this.contracts.render();
      this.extractor.render();
      const activeCount = this.bots ? this.bots.activeCount() : 0;
      const concurrency = P.concurrency(state);
      const maxBots = P.maxBots(state);

      const formattedCoins = P.formatCoins(state.coins);
      const prevCoins = typeof this._lastCoins === "number" ? this._lastCoins : state.coins;
      if (this.coinCount) {
        this.coinCount.textContent = formattedCoins;
      }
      if (state.coins > prevCoins && this.coinChip) {
        this.coinChip.classList.remove("is-bump");
        void this.coinChip.offsetWidth;
        this.coinChip.classList.add("is-bump");
      }
      this._lastCoins = state.coins;

      if (this.coreCoinsValue) this.coreCoinsValue.textContent = formattedCoins;
      if (this.coreBots) this.coreBots.textContent = `${state.bots.length}/${maxBots}`;
      if (this.coreActive) this.coreActive.textContent = `${activeCount}/${concurrency}`;
      if (this.coreBotWins) this.coreBotWins.textContent = P.formatNumber(state.botWins);

      const cost = P.hireCost(state.bots.length);
      if (this.coreHireCost) this.coreHireCost.textContent = P.formatCoins(cost);

      if (this.coreHireBtn) {
        const canHire = state.bots.length < maxBots && state.coins >= cost;
        this.coreHireBtn.disabled = !canHire;
      }

      if (this.coreBotHint) {
        if (state.bots.length === 0) {
          this.coreBotHint.textContent = `Gana monedas para contratar tu primer bot (${P.formatCoins(cost)} monedas).`;
        } else if (activeCount < state.bots.length) {
          this.coreBotHint.textContent = `${activeCount} de ${state.bots.length} bots trabajando. Mejora Concurrencia para activar más.`;
        } else {
          this.coreBotHint.textContent = `${activeCount} bot(s) activos despejando sectores en segundo plano.`;
        }
      }

      this.hq.updateHqSummary();
      if (this.spectator) this.spectator.updateTurboUI();
    }

    refreshStats() {
      if (!this.store) return;
      const agg = this.store.getAggregate();
      const played = agg.played || 0;
      const won = agg.won || 0;
      const winRateEl = $("#winRate");
      if (winRateEl) {
        winRateEl.textContent = `${played > 0 ? Math.round((won / played) * 100) : 0}%`;
      }
      this.updateBest();
    }

    updateBest() {
      if (!this.store || !this.game) return;
      const modeKey = this.game.modeKey;
      const best = this.store.getBest(modeKey);
      const bestTimeEl = $("#bestTime");
      const bestChip = $("#bestChip");
      if (bestTimeEl) {
        bestTimeEl.textContent = best && best.timeMs != null ? U.formatClock(best.timeMs) : "--:--";
      }
      if (bestChip) {
        bestChip.textContent = best && best.timeMs != null ? `RÉCORD ${U.formatClock(best.timeMs)}` : "SIN RÉCORD";
      }
    }

    updateSoundButton() {
      if (!this.soundBtn || !this.soundIcon) return;
      const enabled = Boolean(this.sound && this.sound.enabled);
      this.soundBtn.setAttribute("aria-pressed", String(enabled));
      this.soundBtn.title = enabled ? "Sonido activado" : "Sonido silenciado";
      this.soundIcon.querySelector("use").setAttribute("href", enabled ? "#i-volume" : "#i-mute");
    }

    startTipRotation() {
      if (!this.tipText) return;
      this.tipIndex = 0;
      this.tipText.textContent = BP.TIPS[0] || "";
      window.setInterval(() => {
        if (!BP.TIPS || BP.TIPS.length === 0) return;
        this.tipIndex = (this.tipIndex + 1) % BP.TIPS.length;
        this.tipText.textContent = BP.TIPS[this.tipIndex];
      }, 9500);
    }

    startSameGame() {
      if (this.game) this.game.newGame();
    }

    setDifficultyActive(mode) {
      $$(".diff-btn").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.diff === mode);
      });
    }

    toggleCustomPanel(force) {
      if (!this.customPanel) return;
      const open = typeof force === "boolean" ? force : this.customPanel.hidden;
      this.customPanel.hidden = !open;
      if (open) {
        this.updateCustomHint();
        if (this.customWidth) this.customWidth.focus();
      }
    }

    hideCustomPanel() {
      if (this.customPanel) this.customPanel.hidden = true;
    }

    syncCustomInputs(custom) {
      if (!custom) return;
      if (this.customWidth) this.customWidth.value = custom.width;
      if (this.customHeight) this.customHeight.value = custom.height;
      if (this.customMines) this.customMines.value = custom.mines;
      this.updateCustomHint();
    }

    updateCustomHint() {
      if (!this.customHint) return;
      const w = Number(this.customWidth ? this.customWidth.value : 16);
      const h = Number(this.customHeight ? this.customHeight.value : 16);
      const m = Number(this.customMines ? this.customMines.value : 40);
      const conf = BP.normalizeConfig(w, h, m);
      this.customHint.textContent = `${conf.width}×${conf.height} (${conf.width * conf.height} celdas) · ${conf.mines} minas (~${Math.round((conf.mines / (conf.width * conf.height)) * 100)}% densidad)`;
    }

    applyCustomConfig() {
      const w = Number(this.customWidth.value);
      const h = Number(this.customHeight.value);
      const m = Number(this.customMines.value);
      const conf = BP.normalizeConfig(w, h, m);
      this.syncCustomInputs(conf);
      this.hideCustomPanel();
      this.closeAllModals();
      this.store.updateSettings({ difficulty: "custom", custom: conf });
      this.game.newGame(conf, {
        mode: "custom",
        modeKey: BP.modeKeyFor("custom", conf),
        label: `Personalizado ${conf.width}×${conf.height}`,
      });
      this.sound.play("click");
    }

    // Métodos delegados a BoardViewComponent
    buildBoard(board) { this.boardView.buildBoard(board); }
    fitCellSize() { this.boardView.fitCellSize(); }
    getCellElement(x, y) { return this.boardView.getCellElement(x, y); }
    updateCell(cell) { this.boardView.updateCell(cell); }
    updateAllCells() { this.boardView.updateAllCells(); }
    revealCells(cells) { this.boardView.revealCells(cells); }
    animateFreezeCell(cell) { this.boardView.animateFreezeCell(cell); }
    updateFrozenThaw(cell, ratio) { this.boardView.updateFrozenThaw(cell, ratio); }
    completeFreeze(cells) { this.boardView.completeFreeze(cells); }
    updateHud(game) { this.boardView.updateHud(game); }
    updateTimer(ms) { this.boardView.updateTimer(ms); }
    setStatus(text, tone) { this.boardView.setStatus(text, tone); }
    setFace(state) { this.boardView.setFace(state); }
    showStartHint(show) { this.boardView.showStartHint(show); }
    setShield(clicks) { this.boardView.setShield(clicks); }
    hideShield() { this.boardView.hideShield(); }
    updatePowers(game) { this.boardView.updatePowers(game); }
    flashPowerCard(id) { this.boardView.flashPowerCard(id); }
    setFreezeTargeting(on) { this.boardView.setFreezeTargeting(on); }
    setHammerMode(on) { this.boardView.setHammerMode(on); }
    updateFreezeStatus(power) { this.boardView.updateFreezeStatus(power); }
    setFreezeArea(x, y, radius) { this.boardView.setFreezeArea(x, y, radius); }
    clearFreezeArea() { this.boardView.clearFreezeArea(); }
    setHammerHover(x, y) { this.boardView.setHammerHover(x, y); }
    clearHammerHover() { this.boardView.clearHammerHover(); }
    startXray(endsAt, dur) { this.boardView.startXray(endsAt, dur); }
    endXray(silent) { this.boardView.endXray(silent); }
    cancelPeek() { this.boardView.clearPeek(); }
    clearPeek() { this.boardView.clearPeek(); }

    // Métodos delegados a ModalsComponent
    openModal(modal) { this.modals.openModal(modal); }
    closeModal(modal) { this.modals.closeModal(modal); }
    closeAllModals(except) { this.modals.closeAllModals(except); }
    openHelp() { this.modals.openHelp(); }
    openRecords() { this.modals.openRecords(); }
    showResult(data) { this.modals.showResult(data); }
    toast(msg, type, dur) { this.modals.toast(msg, type, dur); }

    // Métodos delegados a HqComponent
    openHq(tab) { this.hq.openHq(tab); }
    renderHq() { this.hq.renderHq(); }
    setHqTab(tab) { this.hq.setHqTab(tab); }
    renderHqBots() { this.hq.renderHqBots(); }
    renderHqUpgrades() { this.hq.renderHqUpgrades(); }
    renderHqSkills() { this.hq.renderHqSkills(); }
    renderHqLog() { this.hq.renderHqLog(); }
    updateBotLive() { this.hq.updateBotLive(); }
    handleHire() { this.hq.handleHire(); }

    // Métodos delegados a SpectatorComponent
    renderSpectator(rebuild) { this.spectator.renderSpectator(rebuild); }
  }

  BP.UI = UI;
})();

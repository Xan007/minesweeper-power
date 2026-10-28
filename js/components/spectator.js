/* ============================================================
   BUSCAMINAS POWER · Componente de monitoreo de bots en tiempo real
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});
  const U = BP.Utils;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const THOUGHT_FACES = {
    danger: "💥",
    win: "🏆",
    mistake: "⚠️",
    guess: "🎲",
    intuition: "💡",
    skill: "⚡",
    deduction: "🧠",
    safe: "✅",
    info: "💭",
  };

  const THOUGHT_KINDS = {
    danger: "EXPLOSIÓN / FALLO",
    win: "SECTOR COMPLETADO",
    mistake: "FALLO DE CÁLCULO",
    guess: "CONJETURA / RIESGO",
    intuition: "INTUICIÓN PROBABILÍSTICA",
    skill: "ACTIVACIÓN DE ARSENAL",
    deduction: "DEDUCCIÓN LÓGICA",
    safe: "JUGADA SEGURA",
    info: "PROCESANDO",
  };

  class SpectatorComponent {
    constructor({ ui, store, sound, fx }) {
      this.ui = ui;
      this.store = store;
      this.sound = sound;
      this.fx = fx;

      this.spectatorMode = "all";
      this.selectedBotId = null;

      this.viewActiveBotsBadge = $("#viewActiveBotsBadge");
      this.spectatorView = $("#spectatorView");
      this.specModeAllBtn = $("#specModeAllBtn");
      this.specModeSingleBtn = $("#specModeSingleBtn");
      this.specTotalBotsBadge = $("#specTotalBotsBadge");
      this.specBotSelector = $("#specBotSelector");
      this.specEmpty = $("#specEmpty");
      this.specMultiContainer = $("#specMultiContainer");
      this.specMultiGrid = $("#specMultiGrid");
      this.specMultiActiveCount = $("#specMultiActiveCount");
      this.specMultiTotalCoins = $("#specMultiTotalCoins");
      this.networkTitle = $("#networkTitle");
      this.networkGoal = $("#networkGoal");
      this.networkProgress = $("#networkProgress");
      this.networkHint = $("#networkHint");
      this.networkScans = $("#networkScans");

      this.specBody = $("#specBody");
      this.specBackToAllBtn = $("#specBackToAllBtn");
      this.specBoard = $("#specBoard");
      this.specBoardWrap = $("#specBoardWrap");
      this.specBotName = $("#specBotName");
      this.specStatusPill = $("#specStatusPill");
      this.specStatusText = $("#specStatusText");
      this.specDiffSelect = $("#specDiffSelect");
      this.specProgressBar = $("#specProgressBar");
      this.specProgressNum = $("#specProgressNum");
      this.specMetaMines = $("#specMetaMines");
      this.specMetaSteps = $("#specMetaSteps");
      this.specMetaTime = $("#specMetaTime");
      this.specMetaSpeed = $("#specMetaSpeed");
      this.specThoughtFace = $("#specThoughtFace");
      this.specThoughtKind = $("#specThoughtKind");
      this.specThoughtText = $("#specThoughtText");
      this.specThoughtList = $("#specThoughtList");
      this.specAccuracyVal = $("#specAccuracyVal");
      this.specAccuracySub = $("#specAccuracySub");
      this.specSpeedVal = $("#specSpeedVal");
      this.specSpeedSub = $("#specSpeedSub");
      this.specWinsVal = $("#specWinsVal");
      this.specLossesVal = $("#specLossesVal");
      this.specCoinsVal = $("#specCoinsVal");
      this.specSkillsChips = $("#specSkillsChips");
      this.specHireCost = $("#specHireCost");
      this.specEmptyHireCost = $("#specEmptyHireCost");
      this.specHireBtn = $("#specHireBtn");
      this.specHireEmptyBtn = $("#specHireEmptyBtn");
      this.specHqBtn = $("#specHqBtn");
      this.specTurboControl = $("#specTurboControl");
      this.specTurboBtn = $("#specTurboBtn");
      this.specTurboCost = $("#specTurboCost");
      this.specTurboStatus = $("#specTurboStatus");
      this.specTurboTimer = $("#specTurboTimer");
      this.specTurboBar = $("#specTurboBar");
      this.specTurboRecharge = $("#specTurboRecharge");
      this.specTurboRechargeTimer = $("#specTurboRechargeTimer");
      this.specTurboRechargeBar = $("#specTurboRechargeBar");

      this.liveRaf = null;
      this.lastSelectorKey = null;
      this.lastTopThought = null;

      this.bindEvents();
    }

    get bots() {
      return this.ui.bots;
    }

    bindEvents() {
      if (this.specTurboBtn) {
        this.specTurboBtn.addEventListener("click", () => this.handleActivateTurbo());
      }
      if (this.specModeAllBtn) {
        this.specModeAllBtn.addEventListener("click", () => {
          this.spectatorMode = "all";
          this.renderSpectator(true);
        });
      }

      if (this.specModeSingleBtn) {
        this.specModeSingleBtn.addEventListener("click", () => {
          this.spectatorMode = "single";
          this.renderSpectator(true);
        });
      }

      if (this.specBackToAllBtn) {
        this.specBackToAllBtn.addEventListener("click", () => {
          this.spectatorMode = "all";
          this.renderSpectator(true);
        });
      }

      if (this.specHireBtn) {
        this.specHireBtn.addEventListener("click", () => this.ui.handleHire());
      }
      if (this.specHireEmptyBtn) {
        this.specHireEmptyBtn.addEventListener("click", () => this.ui.handleHire());
      }
      if (this.specHqBtn) {
        this.specHqBtn.addEventListener("click", () => this.ui.openHq("upgrades"));
      }

      if (this.specDiffSelect) {
        this.specDiffSelect.addEventListener("change", (e) => {
          if (this.selectedBotId && this.bots) {
            this.bots.assignBot(this.selectedBotId, e.target.value);
            this.renderSpectator(true);
          }
        });
      }

      if (this.specBotSelector) {
        this.specBotSelector.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-spec-bot]");
          if (btn) {
            this.selectedBotId = btn.dataset.specBot;
            this.renderSpectator(true);
          }
        });
      }

      if (this.specMultiGrid) {
        this.specMultiGrid.addEventListener("click", (e) => {
          const detailBtn = e.target.closest("[data-watch-single]");
          if (detailBtn) {
            this.selectedBotId = detailBtn.dataset.watchSingle;
            this.spectatorMode = "single";
            this.renderSpectator(true);
          }
        });

        this.specMultiGrid.addEventListener("change", (e) => {
          const select = e.target.closest("[data-spec-card-diff]");
          if (select && this.bots) {
            this.bots.assignBot(select.dataset.specCardDiff, select.value);
            this.renderSpectator(true);
          }
        });
      }
    }

    handleActivateTurbo() {
      if (!this.bots) return;
      const res = this.bots.activateTurbo();
      if (!res.ok) {
        if (res.reason === "coins") {
          this.sound.play("warn");
          const rechargeRemSec = Math.ceil(this.bots.turboFreeRechargeRemainingMs / 1000);
          this.ui.toast(
            `Sin monedas. Recarga gratis en ${rechargeRemSec}s o gana más monedas.`,
            "warn",
            3000
          );
        }
        return;
      }
      this.sound.play("sparkle");
      if (this.fx && this.specTurboBtn) {
        this.fx.coinBurst(this.specTurboBtn);
      }
      const dur = Math.round(BP.Progression.TURBO_DURATION_MS / 1000);
      const msg = res.isFree
        ? `¡TURBO gratuito activado! Velocidad 4.5× por ${dur}s.`
        : `¡TURBO activado! -${res.cost} monedas · 4.5× por ${dur}s.`;
      this.ui.toast(msg, "success", 2800);
      this.updateTurboUI();
      this.ui.refreshProgression();
    }

    updateTurboUI() {
      if (!this.bots || !this.store) return;
      const state = this.store.progression;
      const P = BP.Progression;

      const network = state.network;
      const goal = P.networkGoal(network.level);
      const unlocked = state.bots.length >= 2;
      if (this.networkTitle) this.networkTitle.textContent = unlocked ? `Operación ${network.level}` : "Red de bots";
      if (this.networkGoal) this.networkGoal.textContent = unlocked ? `${network.progress} / ${goal} victorias · +${P.formatCoins(P.networkReward(network.level))}` : "Bloqueada";
      if (this.networkProgress) this.networkProgress.style.width = unlocked ? `${100 * network.progress / goal}%` : "0%";
      if (this.networkHint) this.networkHint.textContent = unlocked
        ? "Cada victoria aporta un escaneo para otro bot. Completa la operación para ganar monedas."
        : "Contrata un segundo bot en el Cuartel para desbloquear operaciones y apoyo compartido.";
      if (this.networkScans) this.networkScans.textContent = unlocked ? `Escaneos disponibles: ${network.scans.length}/6 · apoyos usados: ${network.assists}` : "";
      const isTurbo = this.bots.isTurboActive;
      const freeReady = this.bots.turboFreeRechargeReady;
      const cost = P.turboCost(state.turboCount || 0);
      const rechargeRemSec = Math.ceil(this.bots.turboFreeRechargeRemainingMs / 1000);
      const totalRechargeSec = 120;
      const rechargePct = Math.max(0, Math.min(100, 100 - (this.bots.turboFreeRechargeRemainingMs / (totalRechargeSec * 1000)) * 100));

      if (this.specTurboBtn) {
        this.specTurboBtn.classList.toggle("is-active", isTurbo);
        this.specTurboBtn.classList.toggle("is-free-ready", freeReady && !isTurbo);
        // Deshabilitado solo si Turbo activo Y no hay monedas Y no hay carga gratis
        this.specTurboBtn.disabled = isTurbo;
      }

      if (this.specTurboCost) {
        if (freeReady) {
          this.specTurboCost.textContent = "GRATIS";
          this.specTurboCost.classList.add("is-free");
        } else {
          this.specTurboCost.textContent = P.formatCoins(cost);
          this.specTurboCost.classList.remove("is-free");
        }
      }

      if (this.specTurboStatus) {
        this.specTurboStatus.hidden = !isTurbo;
      }

      if (isTurbo) {
        const remMs = this.bots.turboRemainingMs;
        const totalMs = P.TURBO_DURATION_MS;
        const pct = Math.max(0, Math.min(100, (remMs / totalMs) * 100));
        const sec = (remMs / 1000).toFixed(1);
        if (this.specTurboTimer) this.specTurboTimer.textContent = `${sec}s`;
        if (this.specTurboBar) this.specTurboBar.style.width = `${pct}%`;
      }

      // Mostrar recarga automática si no hay Turbo activo
      if (!isTurbo) {
        if (this.specTurboRecharge) {
          this.specTurboRecharge.hidden = freeReady;
          if (!freeReady && this.specTurboRechargeTimer) {
            this.specTurboRechargeTimer.textContent = `${rechargeRemSec}s`;
            if (this.specTurboRechargeBar) {
              this.specTurboRechargeBar.style.width = `${rechargePct}%`;
            }
          }
        }
      } else if (this.specTurboRecharge) {
        this.specTurboRecharge.hidden = true;
      }
    }

    startLiveLoop() {
      if (this.liveRaf) return;
      const step = () => {
        if (this.ui.currentView === "spectator" && this.spectatorView && !this.spectatorView.hidden) {
          this.updateLiveTick();
          this.liveRaf = requestAnimationFrame(step);
        } else {
          this.liveRaf = null;
        }
      };
      this.liveRaf = requestAnimationFrame(step);
    }

    stopLiveLoop() {
      if (this.liveRaf) {
        cancelAnimationFrame(this.liveRaf);
        this.liveRaf = null;
      }
    }

    updateLiveTick() {
      this.updateTurboUI();
      const now = performance.now();
      const isMulti = this.spectatorMode !== "single";

      if (isMulti) {
        if (!this.specMultiGrid) return;
        const cards = this.specMultiGrid.querySelectorAll(".spec-bot-card");
        cards.forEach((card) => {
          const botId = card.dataset.botCardId;
          const runner = this.bots ? this.bots.getRunner(botId) : null;
          if (!runner) return;

          const timeEl = card.querySelector(".mini-stat-time");
          const speedEl = card.querySelector(".mini-stat-speed");
          const minesEl = card.querySelector(".mini-stat-mines");
          const stepsEl = card.querySelector(".mini-stat-steps");
          const barFill = card.querySelector(".spec-card-bar-fill");
          const pctEl = card.querySelector(".spec-card-progress-pct");
          const cellsCountEl = card.querySelector(".spec-card-cells-count");
          const thoughtMsg = card.querySelector(".spec-thought-msg");
          const thoughtIco = card.querySelector(".spec-thought-ico");
          const thoughtWrap = card.querySelector(".spec-card-thought");
          const turboTag = card.querySelector(".spec-card-turbo-tag");
          const dot = card.querySelector(".spec-status-dot");
          const statusText = card.querySelector(".spec-card-status-text");
          const coinsEl = card.querySelector(".mini-stat-coins");
          const scoreEl = card.querySelector(".mini-stat-score");

          if (dot) dot.className = `spec-status-dot${runner.isActive ? " is-live" : ""}`;
          if (statusText) statusText.textContent = runner.statusLabel();
          if (coinsEl && runner.bot) coinsEl.textContent = BP.Progression.formatCoins(runner.bot.coins || 0);
          if (scoreEl && runner.bot) scoreEl.textContent = `${runner.bot.wins}V / ${runner.bot.losses}D`;

          // Tiempo
          if (timeEl && runner.startedAt) {
            const elapsed = runner.done && runner.finishedAt
              ? Math.max(0, (runner.finishedAt - runner.startedAt) / 1000).toFixed(1)
              : Math.max(0, (now - runner.startedAt) / 1000).toFixed(1);
            timeEl.textContent = `${elapsed}s`;

            if (speedEl) {
              speedEl.textContent = `${runner.cellsPerSec} c/s`;
            }
          }

          // Progreso
          if (runner.board) {
            const progressPct = Math.round(runner.progress * 100);
            if (barFill) {
              barFill.style.width = `${progressPct}%`;
              barFill.className = `spec-card-bar-fill is-${runner.status}`;
            }
            if (pctEl) pctEl.textContent = `${progressPct}%`;
            if (cellsCountEl) {
              cellsCountEl.textContent = `${runner.board.revealedSafeCount}/${runner.board.safeCount} celdas`;
            }
            if (minesEl) {
              minesEl.textContent = String(Math.max(0, runner.board.mineCount - runner.board.flagsPlaced));
            }
          }
          if (stepsEl) stepsEl.textContent = String(runner.steps);

          // Pensamiento
          if (thoughtWrap) {
            thoughtWrap.className = `spec-card-thought is-${runner.thoughtType || "info"}`;
            if (thoughtIco) thoughtIco.textContent = THOUGHT_FACES[runner.thoughtType] || "🧠";
            if (thoughtMsg) thoughtMsg.textContent = runner.currentThought || "Resolviendo...";
          }

          // Tag turbo
          if (turboTag) {
            const isActive = this.bots && this.bots.isTurboActive;
            turboTag.hidden = !isActive;
          }

          // Pintar mini-tablero en tiempo real
          const miniBoardEl = card.querySelector(".spec-mini-board");
          if (miniBoardEl && runner.board) {
            this.paintBoardCells(miniBoardEl, runner.board, runner.targetCell);
          }
        });

        if (this.specMultiTotalCoins && this.store && this.store.progression) {
          const totalBotCoins = (this.store.progression.bots || []).reduce((acc, b) => acc + (b.coins || 0), 0);
          this.specMultiTotalCoins.textContent = BP.Progression.formatCoins(totalBotCoins);
        }
      } else {
        if (!this.selectedBotId) return;
        const runner = this.bots ? this.bots.getRunner(this.selectedBotId) : null;
        if (!runner || !runner.board || !runner.startedAt) return;

        const elapsed = runner.done && runner.finishedAt
          ? Math.max(0, (runner.finishedAt - runner.startedAt) / 1000).toFixed(1)
          : Math.max(0, (now - runner.startedAt) / 1000).toFixed(1);

        if (this.specMetaTime) this.specMetaTime.textContent = `${elapsed}s`;
        if (this.specMetaSpeed) {
          this.specMetaSpeed.textContent = `${runner.cellsPerSec} c/s`;
          if (this.specSpeedSub) this.specSpeedSub.textContent = `${runner.cellsPerSec} celdas/s`;
        }

        // Progreso barra
        const progressPct = Math.round(runner.progress * 100);
        if (this.specProgressBar) this.specProgressBar.style.width = `${progressPct}%`;
        if (this.specProgressNum) this.specProgressNum.textContent = `${progressPct}%`;

        // Minas y pasos
        if (runner.board) {
          const remainingMines = Math.max(0, runner.board.mineCount - runner.board.flagsPlaced);
          if (this.specMetaMines) this.specMetaMines.textContent = String(remainingMines);
        }
        if (this.specMetaSteps) this.specMetaSteps.textContent = String(runner.steps);

        if (this.specStatusPill) {
          this.specStatusPill.className = `spec-pill-status is-${runner.status}`;
        }
        if (this.specStatusText) {
          this.specStatusText.textContent = runner.statusLabel();
        }
        if (this.specWinsVal && runner.bot) this.specWinsVal.textContent = String(runner.bot.wins);
        if (this.specLossesVal && runner.bot) this.specLossesVal.textContent = String(runner.bot.losses);
        if (this.specCoinsVal && runner.bot) this.specCoinsVal.textContent = BP.Progression.formatCoins(runner.bot.coins || 0);

        // Pensamiento en tiempo real
        if (this.specThoughtFace) this.specThoughtFace.textContent = THOUGHT_FACES[runner.thoughtType] || "🧠";
        if (this.specThoughtKind) this.specThoughtKind.textContent = THOUGHT_KINDS[runner.thoughtType] || "PENSAMIENTO ACTUAL";
        if (this.specThoughtText) this.specThoughtText.textContent = runner.currentThought || "Analizando celdas...";

        // Pintar tablero del bot seleccionado
        if (this.specBoard && runner.board) {
          const wrap = this.specBoardWrap;
          const maxW = wrap ? Math.max(280, wrap.clientWidth - 24) : 400;
          const maxH = wrap ? Math.max(200, wrap.clientHeight - 24) : 320;
          const fitCell = Math.max(16, Math.min(26, Math.floor(Math.min(maxW / runner.board.width, maxH / runner.board.height))));
          this.paintBoardCells(this.specBoard, runner.board, runner.targetCell, fitCell);
        }
      }
    }

    renderSpectator(fullRebuild = false) {
      if (!this.store || !this.store.progression || !this.spectatorView) return;
      const state = this.store.progression;
      const P = BP.Progression;
      const activeCount = this.bots ? this.bots.activeCount() : 0;
      const bots = state.bots || [];

      if (this.viewActiveBotsBadge) this.viewActiveBotsBadge.textContent = String(activeCount);
      if (this.specTotalBotsBadge) this.specTotalBotsBadge.textContent = String(bots.length);

      if (this.spectatorView.hidden && this.ui.currentView !== "spectator") {
        this.stopLiveLoop();
        return;
      }

      this.updateTurboUI();
      this.startLiveLoop();

      const cost = P.hireCost(bots.length);
      if (this.specHireCost) this.specHireCost.textContent = P.formatCoins(cost);
      if (this.specEmptyHireCost) this.specEmptyHireCost.textContent = P.formatCoins(cost);

      if (bots.length === 0) {
        if (this.specEmpty) this.specEmpty.hidden = false;
        if (this.specMultiContainer) this.specMultiContainer.hidden = true;
        if (this.specBody) this.specBody.hidden = true;
        if (this.specBotSelector) this.specBotSelector.innerHTML = "";
        return;
      }

      if (this.specEmpty) this.specEmpty.hidden = true;

      const isMulti = this.spectatorMode !== "single";
      if (this.specModeAllBtn) this.specModeAllBtn.classList.toggle("is-active", isMulti);
      if (this.specModeSingleBtn) this.specModeSingleBtn.classList.toggle("is-active", !isMulti);

      if (isMulti) {
        if (this.specMultiContainer) this.specMultiContainer.hidden = false;
        if (this.specBody) this.specBody.hidden = true;
        if (this.specBotSelector) this.specBotSelector.hidden = true;
        this.renderMultiSpectator(bots, activeCount, fullRebuild);
      } else {
        if (this.specMultiContainer) this.specMultiContainer.hidden = true;
        if (this.specBody) this.specBody.hidden = false;
        if (this.specBotSelector) this.specBotSelector.hidden = false;

        if (!this.selectedBotId || !bots.some((b) => b.id === this.selectedBotId)) {
          this.selectedBotId = bots[0].id;
        }

        const selectedBot = bots.find((b) => b.id === this.selectedBotId) || bots[0];
        const runner = this.bots ? this.bots.getRunner(selectedBot.id) : null;
        this.renderSingleSpectator(selectedBot, runner, state, bots, activeCount, fullRebuild);
      }
    }

    renderMultiSpectator(bots, activeCount, fullRebuild) {
      if (!this.specMultiGrid) return;
      const P = BP.Progression;
      const state = this.store.progression;

      if (this.specMultiActiveCount) {
        this.specMultiActiveCount.textContent = `${activeCount}/${P.concurrency(state)}`;
      }
      if (this.specMultiTotalCoins) {
        const totalBotCoins = bots.reduce((sum, b) => sum + (b.coins || 0), 0);
        this.specMultiTotalCoins.textContent = P.formatCoins(totalBotCoins);
      }

      const existingCards = new Map();
      this.specMultiGrid.querySelectorAll(".spec-bot-card").forEach((card) => {
        existingCards.set(card.dataset.botCardId, card);
      });

      const currentBotIds = new Set(bots.map((b) => b.id));
      existingCards.forEach((card, id) => {
        if (!currentBotIds.has(id)) card.remove();
      });

      bots.forEach((bot, index) => {
        const isActive = index < activeCount;
        const runner = this.bots ? this.bots.getRunner(bot.id) : null;
        let card = existingCards.get(bot.id);

        if (!card || fullRebuild) {
          if (card) card.remove();
          card = document.createElement("article");
          card.className = "spec-bot-card";
          card.dataset.botCardId = bot.id;

          card.innerHTML = `
            <header class="spec-card-head">
              <div class="spec-card-identity">
                <span class="spec-card-avatar">${U.icon("i-bot")}</span>
                <div>
                  <h4 class="spec-card-name">${U.escapeHtml(bot.name)}</h4>
                  <div class="spec-card-status-pill">
                    <span class="spec-status-dot${isActive ? " is-live" : ""}"></span>
                    <span class="spec-card-status-text">${runner ? runner.statusLabel() : (isActive ? "Iniciando" : "En cola")}</span>
                    <span class="spec-card-turbo-tag" title="Turbo activo (4.5× velocidad)" hidden>⚡ TURBO</span>
                  </div>
                </div>
              </div>
              <div class="spec-card-ctrls">
                <select class="spec-card-diff-select" data-spec-card-diff="${bot.id}" aria-label="Dificultad de ${U.escapeHtml(bot.name)}">
                  <option value="beginner"${bot.difficulty === "beginner" ? " selected" : ""}>Principiante</option>
                  <option value="intermediate"${bot.difficulty === "intermediate" ? " selected" : ""}>Intermedio</option>
                  <option value="expert"${bot.difficulty === "expert" ? " selected" : ""}>Experto</option>
                </select>
                <button class="spec-card-action-btn" type="button" data-watch-single="${bot.id}" title="Ver cerebro IA y detalles en grande">
                  ${U.icon("i-chip")}
                  <span>Detalle</span>
                </button>
              </div>
            </header>

            <div class="spec-card-board-wrap">
              <div class="spec-mini-board" data-mini-board="${bot.id}"></div>
            </div>

            <div class="spec-card-progress-wrap">
              <div class="spec-card-bar-track">
                <div class="spec-card-bar-fill" style="width: 0%"></div>
              </div>
              <div class="spec-card-bar-info">
                <strong class="spec-card-progress-pct">0%</strong>
                <span class="spec-card-cells-count">0/0 celdas</span>
              </div>
            </div>

            <div class="spec-card-stats-row">
              <span title="Tiempo transcurrido"><svg class="icon"><use href="#i-clock"></use></svg> <b class="mini-stat-time">0.0s</b></span>
              <span title="Velocidad en tiempo real"><svg class="icon"><use href="#i-bolt"></use></svg> <b class="mini-stat-speed">0.0 c/s</b></span>
              <span title="Minas restantes"><svg class="icon"><use href="#i-bomb"></use></svg> <b class="mini-stat-mines">0</b></span>
              <span title="Acciones"><svg class="icon"><use href="#i-target"></use></svg> <b class="mini-stat-steps">0</b></span>
              <span title="Monedas ganadas"><svg class="icon"><use href="#i-coin"></use></svg> <b class="mini-stat-coins">0</b></span>
            </div>

            <div class="spec-card-thought is-info">
              <span class="spec-thought-ico">🧠</span>
              <p class="spec-thought-msg">Iniciando bot...</p>
            </div>

            <footer class="spec-card-foot">
              <div class="spec-card-arsenal"></div>
              <div class="spec-card-score"><span class="mini-stat-score">${bot.wins}V / ${bot.losses}D</span></div>
            </footer>
          `;
          this.specMultiGrid.appendChild(card);
        }

        const dot = card.querySelector(".spec-status-dot");
        const statusText = card.querySelector(".spec-card-status-text");
        const turboTag = card.querySelector(".spec-card-turbo-tag");
        if (dot) dot.className = `spec-status-dot${isActive ? " is-live" : ""}`;
        if (statusText) statusText.textContent = runner ? runner.statusLabel() : (isActive ? "Iniciando" : "En cola");
        if (turboTag) turboTag.hidden = !(this.bots && this.bots.isTurboActive && isActive);

        const diffSelect = card.querySelector(".spec-card-diff-select");
        if (diffSelect && diffSelect.value !== bot.difficulty) diffSelect.value = bot.difficulty;

        const progressRatio = runner ? runner.progress : 0;
        const progressPct = Math.round(progressRatio * 100);
        const barFill = card.querySelector(".spec-card-bar-fill");
        const pctEl = card.querySelector(".spec-card-progress-pct");
        const cellsCountEl = card.querySelector(".spec-card-cells-count");

        if (barFill) {
          barFill.style.width = `${progressPct}%`;
          barFill.className = `spec-card-bar-fill${runner ? ` is-${runner.status}` : ""}`;
        }
        if (pctEl) pctEl.textContent = `${progressPct}%`;
        if (cellsCountEl && runner && runner.board) {
          cellsCountEl.textContent = `${runner.board.revealedSafeCount}/${runner.board.safeCount} celdas`;
        }

        const timeEl = card.querySelector(".mini-stat-time");
        const speedEl = card.querySelector(".mini-stat-speed");
        const minesEl = card.querySelector(".mini-stat-mines");
        const stepsEl = card.querySelector(".mini-stat-steps");
        const coinsEl = card.querySelector(".mini-stat-coins");
        const scoreEl = card.querySelector(".mini-stat-score");

        if (timeEl) {
          const elapsed = runner && runner.startedAt
            ? (runner.done && runner.finishedAt
                ? Math.max(0, (runner.finishedAt - runner.startedAt) / 1000).toFixed(1)
                : Math.max(0, (performance.now() - runner.startedAt) / 1000).toFixed(1))
            : "0.0";
          timeEl.textContent = `${elapsed}s`;
          if (speedEl) {
            speedEl.textContent = `${runner ? runner.cellsPerSec : "0.0"} c/s`;
          }
        }
        if (minesEl && runner && runner.board) {
          minesEl.textContent = String(Math.max(0, runner.board.mineCount - runner.board.flagsPlaced));
        }
        if (stepsEl) stepsEl.textContent = String(runner ? runner.steps : 0);
        if (coinsEl) coinsEl.textContent = P.formatCoins(bot.coins || 0);
        if (scoreEl) scoreEl.textContent = `${bot.wins}V / ${bot.losses}D`;

        const thoughtWrap = card.querySelector(".spec-card-thought");
        const thoughtIco = card.querySelector(".spec-thought-ico");
        const thoughtMsg = card.querySelector(".spec-thought-msg");
        if (thoughtWrap && runner) {
          thoughtWrap.className = `spec-card-thought is-${runner.thoughtType || "info"}`;
          if (thoughtIco) thoughtIco.textContent = THOUGHT_FACES[runner.thoughtType] || "🧠";
          if (thoughtMsg) thoughtMsg.textContent = runner.currentThought || "Resolviendo...";
        }

        const arsenalWrap = card.querySelector(".spec-card-arsenal");
        if (arsenalWrap) {
          const equipped = bot.skills || {};
          arsenalWrap.innerHTML = P.SKILL_IDS.map((id) => {
            const def = P.SKILL_DEFS[id];
            const isEq = Boolean(equipped[id]);
            const charges = runner && runner.charges ? (runner.charges[id] || 0) : 0;
            return `
              <span class="spec-card-skill-pip${isEq ? " is-equipped" : ""}" title="${def.name}: ${charges} cargas">
                ${U.icon(def.icon)}
                <span>${isEq ? charges : "-"}</span>
              </span>
            `;
          }).join("");
        }

        const miniBoardEl = card.querySelector(".spec-mini-board");
        if (miniBoardEl && runner && runner.board) {
          this.paintBoardCells(miniBoardEl, runner.board, runner.targetCell);
        }
      });
    }

    renderSingleSpectator(selectedBot, runner, state, bots, activeCount, fullRebuild) {
      const P = BP.Progression;

      const selectorKey = `${bots.map((b) => b.id).join(",")}:${this.selectedBotId}:${activeCount}`;
      if (this.specBotSelector && (fullRebuild || this.lastSelectorKey !== selectorKey)) {
        this.lastSelectorKey = selectorKey;
        this.specBotSelector.innerHTML = bots
          .map((bot, index) => {
            const isSelected = bot.id === this.selectedBotId;
            const isActive = index < activeCount;
            const r = this.bots ? this.bots.getRunner(bot.id) : null;
            const progress = r ? Math.round(r.progress * 100) : 0;
            return `
              <button class="spec-chip-btn${isSelected ? " is-active" : ""}"
                type="button"
                data-spec-bot="${U.escapeHtml(bot.id)}"
                title="${U.escapeHtml(bot.name)} · ${isActive ? "Activo" : "En cola"} · ${progress}%">
                <span class="spec-chip-dot${isActive ? " is-live" : ""}"></span>
                <span>${U.escapeHtml(bot.name)}</span>
              </button>
            `;
          })
          .join("");
      }

      if (this.specBotName) this.specBotName.textContent = selectedBot.name;
      if (this.specStatusText) this.specStatusText.textContent = runner ? runner.statusLabel() : "En espera";
      if (this.specDiffSelect && this.specDiffSelect.value !== selectedBot.difficulty) {
        this.specDiffSelect.value = selectedBot.difficulty;
      }

      const progressRatio = runner ? runner.progress : 0;
      const progressPct = Math.round(progressRatio * 100);
      if (this.specProgressBar) this.specProgressBar.style.width = `${progressPct}%`;
      if (this.specProgressNum) this.specProgressNum.textContent = `${progressPct}%`;

      if (runner && runner.board) {
        const remainingMines = Math.max(0, runner.board.mineCount - runner.board.flagsPlaced);
        if (this.specMetaMines) this.specMetaMines.textContent = String(remainingMines);
        if (this.specMetaSteps) this.specMetaSteps.textContent = String(runner.steps);
        const elapsedSec = runner.done && runner.finishedAt
          ? Math.max(0, (runner.finishedAt - runner.startedAt) / 1000).toFixed(1)
          : Math.max(0, (performance.now() - runner.startedAt) / 1000).toFixed(1);
        if (this.specMetaTime) this.specMetaTime.textContent = `${elapsedSec}s`;
        if (this.specMetaSpeed) this.specMetaSpeed.textContent = `${runner.cellsPerSec} c/s`;
      }

      const accuracy = runner ? runner.accuracy : P.botAccuracy(state);
      const accPct = Math.round(accuracy * 100);
      if (this.specAccuracyVal) this.specAccuracyVal.textContent = `${accPct}%`;
      if (this.specAccuracySub) {
        const lvl = state.upgrades.intelligence || 0;
        this.specAccuracySub.textContent = `Nivel ${lvl} · elección de menor riesgo`;
      }
      const baseStepMs = P.botStepMs(state);
      const speedMult = this.bots ? this.bots.speedMultiplier : 1;
      const isTurbo = Boolean(this.bots && this.bots.isTurboActive);
      const stepMs = Math.max(30, Math.round(baseStepMs / speedMult));
      if (this.specSpeedVal) this.specSpeedVal.textContent = isTurbo ? `${(stepMs / 1000).toFixed(2)}s ⚡` : `${(stepMs / 1000).toFixed(2)}s`;
      if (this.specSpeedSub) this.specSpeedSub.textContent = isTurbo ? `${runner ? runner.cellsPerSec : "0.0"} c/s (Turbo 4.5×)` : `${runner ? runner.cellsPerSec : "0.0"} celdas/s`;
      if (this.specWinsVal) this.specWinsVal.textContent = P.formatNumber(selectedBot.wins);
      if (this.specLossesVal) this.specLossesVal.textContent = `${P.formatNumber(selectedBot.losses)} fallos`;
      if (this.specCoinsVal) this.specCoinsVal.textContent = P.formatCoins(selectedBot.coins);

      if (this.specSkillsChips) {
        const equipped = selectedBot.skills || {};
        this.specSkillsChips.innerHTML = P.SKILL_IDS.map((id) => {
          const def = P.SKILL_DEFS[id];
          const isEq = Boolean(equipped[id]);
          const charges = runner && runner.charges ? (runner.charges[id] || 0) : 0;
          return `
            <span class="spec-skill-tag${isEq ? " is-active" : ""}">
              ${U.icon(def.icon)}
              <span>${def.short}${isEq ? ` (${charges})` : ""}</span>
            </span>
          `;
        }).join("");
      }

      if (runner) {
        if (this.specThoughtFace) this.specThoughtFace.textContent = THOUGHT_FACES[runner.thoughtType] || "🧠";
        if (this.specThoughtKind) this.specThoughtKind.textContent = THOUGHT_KINDS[runner.thoughtType] || "PENSAMIENTO ACTUAL";
        if (this.specThoughtText) this.specThoughtText.textContent = runner.currentThought || "Analizando celdas...";

        if (this.specThoughtList && runner.thoughtHistory) {
          const topThought = runner.thoughtHistory[0] ? runner.thoughtHistory[0].text : "";
          if (fullRebuild || this.lastTopThought !== topThought) {
            this.lastTopThought = topThought;
            this.specThoughtList.innerHTML = runner.thoughtHistory
              .map((item) => `
                <div class="thought-item is-${item.type}">
                  <span class="th-time">${U.escapeHtml(item.time)}</span>
                  <span class="th-text">${U.escapeHtml(item.text)}</span>
                </div>
              `)
              .join("");
          }
        }
      }

      if (this.specBoard && runner && runner.board) {
        const wrap = this.specBoardWrap;
        const maxW = wrap ? Math.max(280, wrap.clientWidth - 24) : 400;
        const maxH = wrap ? Math.max(200, wrap.clientHeight - 24) : 320;
        const fitCell = Math.max(16, Math.min(26, Math.floor(Math.min(maxW / runner.board.width, maxH / runner.board.height))));
        this.paintBoardCells(this.specBoard, runner.board, runner.targetCell, fitCell);
      }
    }

    paintBoardCells(container, board, targetCell, explicitCellSize = null) {
      const currentCols = container.style.getPropertyValue("--cols");
      const currentRows = container.style.getPropertyValue("--rows");
      const needRebuild = container.children.length !== board.area ||
        currentCols !== String(board.width) ||
        currentRows !== String(board.height);

      const cellSize = explicitCellSize || (board.width > 20 ? 10 : (board.width > 12 ? 14 : 19));
      container.style.setProperty("--cols", String(board.width));
      container.style.setProperty("--rows", String(board.height));
      container.style.setProperty("--cell", `${cellSize}px`);

      if (needRebuild) {
        container.innerHTML = "";
        const frag = document.createDocumentFragment();
        for (let y = 0; y < board.height; y += 1) {
          for (let x = 0; x < board.width; x += 1) {
            const el = document.createElement("div");
            el.className = "cell";
            el.dataset.x = String(x);
            el.dataset.y = String(y);
            frag.appendChild(el);
          }
        }
        container.appendChild(frag);
      }

      const children = container.children;
      let idx = 0;
      for (let y = 0; y < board.height; y += 1) {
        for (let x = 0; x < board.width; x += 1) {
          const cell = board.getCell(x, y);
          const el = children[idx++];
          if (!cell || !el) continue;

          const isTarget = Boolean(targetCell && targetCell.x === x && targetCell.y === y);
          const stateKey = `${cell.revealed ? 1 : 0}_${cell.mine ? 1 : 0}_${cell.adjacent}_${cell.flagged ? 1 : 0}_${cell.defused ? 1 : 0}_${cell.exploded ? 1 : 0}_${cell.frozen ? 1 : 0}_${isTarget ? 1 : 0}`;
          if (el._renderKey === stateKey) continue;
          el._renderKey = stateKey;

          let cls = "cell";
          let inner = "";

          if (cell.revealed) {
            cls += " is-revealed";
            if (cell.mine) {
              cls += " is-mine-revealed";
              if (cell.defused) cls += " is-defused";
              if (cell.exploded) cls += " is-exploded";
              inner = U.icon("i-bomb") + (cell.defused ? '<span class="cell-defused-tag">OK</span>' : "");
            } else if (cell.adjacent > 0) {
              cls += " is-number";
              el.dataset.n = String(cell.adjacent);
              inner = `<span class="num">${cell.adjacent}</span>`;
            }
          } else if (cell.flagged) {
            cls += " is-flagged";
            inner = U.icon("i-flag");
          } else if (cell.frozen) {
            cls += " is-frozen";
            inner = U.icon("i-snow");
          }

          if (!cell.revealed || cell.adjacent <= 0 || cell.mine) {
            if (el.dataset.n) delete el.dataset.n;
          }

          if (isTarget) {
            cls += " is-bot-target";
          }

          if (el.className !== cls) el.className = cls;
          if (el.innerHTML !== inner) el.innerHTML = inner;
        }
      }
    }
  }

  BP.SpectatorComponent = SpectatorComponent;
})();

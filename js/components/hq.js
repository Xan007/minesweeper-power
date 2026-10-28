/* ============================================================
   BUSCAMINAS POWER · Componente del Cuartel de Operaciones (HQ)
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});
  const U = BP.Utils;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  class HqComponent {
    constructor({ ui, store, sound, fx }) {
      this.ui = ui;
      this.store = store;
      this.sound = sound;
      this.fx = fx;

      this.hqTab = "bots";
      this.hqModal = $("#hqModal");
      this.hqTitle = $("#hqTitle");
      this.hqCoins = $("#hqCoins");
      this.hqCoreLevel = $("#hqCoreLevel");
      this.hqBots = $("#hqBots");
      this.hqConcurrency = $("#hqConcurrency");
      this.hqBotsCount = $("#hqBotsCount");
      this.hqBotWins = $("#hqBotWins");
      this.hqHireBtn = $("#hqHireBtn");
      this.hqHireCost = $("#hqHireCost");
      this.hqCapacityHint = $("#hqCapacityHint");
      this.hqBotList = $("#hqBotList");
      this.hqUpgradeList = $("#hqUpgradeList");
      this.hqSkillList = $("#hqSkillList");
      this.hqLogList = $("#hqLogList");
      this.hqFoot = $("#hqFoot");

      this.bindEvents();
    }

    get bots() {
      return this.ui.bots;
    }

    bindEvents() {
      if (!this.hqModal) return;
      this.hqModal.addEventListener("click", (event) => this.handleHqClick(event));
      this.hqModal.addEventListener("change", (event) => this.handleHqChange(event));

      if (this.hqHireBtn) {
        this.hqHireBtn.addEventListener("click", () => this.handleHire());
      }
    }

    openHq(tab = "bots") {
      this.setHqTab(tab, false);
      this.renderHq();
      this.ui.openModal(this.hqModal);
      this.sound.play("click");
    }

    renderHq() {
      if (!this.store || !this.hqModal) return;
      this.updateHqSummary();
      const tab = this.hqTab || "bots";
      if (tab === "bots") this.renderHqBots();
      else if (tab === "upgrades") this.renderHqUpgrades();
      else if (tab === "skills") this.renderHqSkills();
      else if (tab === "log") this.renderHqLog();
    }

    updateHqSummary() {
      const state = this.store.progression;
      const P = BP.Progression;
      const activeCount = this.bots ? this.bots.activeCount() : 0;
      const maxBots = P.maxBots(state);
      const concurrency = P.concurrency(state);

      if (this.hqCoins) this.hqCoins.textContent = P.formatCoins(state.coins);
      if (this.hqCoreLevel) {
        const sum = Object.values(state.upgrades).reduce((s, v) => s + (Number(v) || 0), 0);
        this.hqCoreLevel.textContent = `Nivel ${1 + sum}`;
      }
      if (this.hqBots) this.hqBots.textContent = `${state.bots.length}/${maxBots}`;
      if (this.hqConcurrency) this.hqConcurrency.textContent = `${activeCount}/${concurrency}`;
      if (this.hqBotsCount) this.hqBotsCount.textContent = `${state.bots.length}/${maxBots} (${activeCount}/${concurrency} activos)`;
      if (this.hqBotWins) this.hqBotWins.textContent = P.formatNumber(state.botWins);

      const hireCost = P.hireCost(state.bots.length);
      if (this.hqHireCost) this.hqHireCost.textContent = P.formatCoins(hireCost);

      if (this.hqHireBtn) {
        const canHire = state.bots.length < maxBots && state.coins >= hireCost;
        this.hqHireBtn.disabled = !canHire;
      }

      if (this.hqCapacityHint) {
        if (state.bots.length >= maxBots) {
          this.hqCapacityHint.textContent = "Capacidad del núcleo al máximo. Mejora 'Capacidad' en Mejoras para contratar más.";
        } else {
          this.hqCapacityHint.textContent = `Espacio libre: puedes contratar ${maxBots - state.bots.length} bot(s) más. Concurrencia actual: ${concurrency} simultáneo(s).`;
        }
      }

      if (this.hqFoot) {
        this.hqFoot.textContent = `${P.formatNumber(state.manualWins)} victorias manuales · ${P.formatNumber(state.botWins)} victorias de bots · guardado local.`;
      }
    }

    setHqTab(tab, render = true) {
      const target = tab || "bots";
      if (target === "spectator") {
        this.ui.closeModal(this.hqModal);
        this.ui.switchView("spectator");
        return;
      }
      this.hqTab = target;
      if (!this.hqModal) return;

      $$("[data-hq-tab]", this.hqModal).forEach((btn) => {
        const active = btn.dataset.hqTab === target;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", String(active));
      });

      $$("[data-hq-panel]", this.hqModal).forEach((panel) => {
        panel.hidden = panel.dataset.hqPanel !== target;
      });

      if (render) this.renderHq();
    }

    renderHqBots() {
      if (!this.hqBotList || !this.store) return;
      const state = this.store.progression;
      const P = BP.Progression;
      const activeCount = this.bots ? this.bots.activeCount() : 0;

      if (!state.bots || state.bots.length === 0) {
        this.hqBotList.innerHTML = `
          <div class="hq-empty">
            <span class="hq-empty-icon">${U.icon("i-bot")}</span>
            <h4>Sin bots en el escuadrón</h4>
            <p>Gana una partida manual para conseguir monedas y contrata tu primer bot. El primero cuesta ${P.formatCoins(P.hireCost(0))} monedas.</p>
          </div>
        `;
        return;
      }

      this.hqBotList.innerHTML = state.bots
        .map((bot, index) => {
          const runner = this.bots ? this.bots.getRunner(bot.id) : null;
          const isActive = index < activeCount;
          const statusText = runner ? runner.statusLabel() : (isActive ? "Iniciando" : "En cola de concurrencia");
          const progress = runner ? Math.round(runner.progress * 100) : 0;
          const difficultyOptions = P.BOT_DIFFICULTIES.map((id) => {
            const def = BP.PRESETS[id];
            const sel = bot.difficulty === id ? "selected" : "";
            return `<option value="${id}" ${sel}>${def.label}</option>`;
          }).join("");

          const skillChips = P.SKILL_IDS.map((id) => {
            const def = P.SKILL_DEFS[id];
            const unlocked = Boolean(state.skills[id]);
            const equipped = Boolean(bot.skills && bot.skills[id]);
            const charges = P.botSkillCharges(id, state.skills[id]);
            const cls = ["bot-skill-chip", equipped ? "is-equipped" : "", !unlocked ? "is-locked" : ""].filter(Boolean).join(" ");
            const title = !unlocked ? "Bloqueado: sube de nivel esta habilidad primero" : (equipped ? `Equipado (${charges} cargas/tablero). Clic para quitar.` : `Desactivado. Clic para equipar (${charges} cargas).`);
            return `
              <button class="${cls}" type="button" data-hq-action="toggle-skill" data-bot="${U.escapeHtml(bot.id)}" data-skill="${id}" title="${U.escapeHtml(title)}">
                ${U.icon(def.icon)}
                <span>${def.short}</span>
              </button>
            `;
          }).join("");

          return `
            <article class="bot-card" data-bot-id="${U.escapeHtml(bot.id)}">
              <div class="bot-card-head">
                <div class="bot-card-title">
                  <span class="bot-avatar">${U.icon("i-bot")}</span>
                  <div>
                    <h4>${U.escapeHtml(bot.name)}</h4>
                    <span class="bot-sub">
                      <span class="bot-status-dot ${isActive ? "is-live" : ""}"></span>
                      ${isActive ? "Activo" : "En cola"} · ${U.formatDate(bot.createdAt)}
                    </span>
                  </div>
                </div>
                <div class="bot-card-badge ${isActive ? "is-active" : "is-queued"}">
                  <span class="bot-status-label">${statusText}</span>
                </div>
              </div>

              <div class="bot-progress-block">
                <div class="bot-progress-header">
                  <span class="bot-progress-label">
                    ${runner && runner.board ? `${runner.board.revealedSafeCount}/${runner.board.safeCount} celdas` : "En espera"}
                  </span>
                  <span class="bot-progress-num">${progress}%</span>
                </div>
                <div class="bot-progress-track">
                  <div class="bot-progress-bar bot-progress-bar--${runner ? runner.status : "idle"}" style="width: ${progress}%"></div>
                </div>
              </div>

              <div class="bot-card-row">
                <label class="bot-diff-label">
                  <span>Dificultad:</span>
                  <select data-bot-difficulty="${U.escapeHtml(bot.id)}">${difficultyOptions}</select>
                </label>
                <div class="bot-stats-row">
                  <span title="Victorias / Derrotas"><b class="stat-wins">${bot.wins}</b>V · <b class="stat-losses">${bot.losses}</b>D</span>
                  <span title="Monedas ganadas por este bot"><b class="stat-coins">${P.formatCoins(bot.coins)}</b> <svg class="icon"><use href="#i-coin"></use></svg></span>
                </div>
              </div>

              <div class="bot-skills-row">
                <span class="bot-skills-sub">Arsenal:</span>
                <div class="bot-skills-grid">${skillChips}</div>
              </div>

              <div class="bot-actions-row">
                <button class="ghost-btn ghost-btn--small" type="button" data-hq-action="watch-bot" data-bot="${U.escapeHtml(bot.id)}">
                  ${U.icon("i-eye")} Ver en vivo
                </button>
              </div>
            </article>
          `;
        })
        .join("");
    }

    updateBotLive() {
      if (this.hqTab !== "bots" || !this.hqBotList || !this.bots) return;
      const state = this.store.progression;
      const activeCount = this.bots.activeCount();

      $$(".bot-card", this.hqBotList).forEach((card) => {
        const id = card.dataset.botId;
        const index = state.bots.findIndex((b) => b.id === id);
        if (index === -1) return;
        const bot = state.bots[index];
        const runner = this.bots.getRunner(id);
        const isActive = index < activeCount;

        const dot = card.querySelector(".bot-status-dot");
        const label = card.querySelector(".bot-status-label");
        const bar = card.querySelector(".bot-progress-bar");
        const num = card.querySelector(".bot-progress-num");
        const coins = card.querySelector(".stat-coins");
        const wins = card.querySelector(".stat-wins");
        const losses = card.querySelector(".stat-losses");
        const progressLabel = card.querySelector(".bot-progress-label");

        if (dot) dot.classList.toggle("is-live", isActive);
        if (label) label.textContent = runner ? runner.statusLabel() : (isActive ? "Iniciando" : "En cola");
        const progress = runner ? Math.round(runner.progress * 100) : 0;
        if (bar) {
          bar.style.width = `${progress}%`;
          if (runner) bar.className = `bot-progress-bar bot-progress-bar--${runner.status}`;
        }
        if (num) num.textContent = `${progress}%`;
        if (progressLabel && runner && runner.board) {
          progressLabel.textContent = `${runner.board.revealedSafeCount}/${runner.board.safeCount} celdas`;
        }
        if (coins) coins.textContent = BP.Progression.formatCoins(bot.coins);
        if (wins) wins.textContent = String(bot.wins);
        if (losses) losses.textContent = String(bot.losses);
      });
    }

    renderHqUpgrades() {
      if (!this.hqUpgradeList || !this.store) return;
      const state = this.store.progression;
      const P = BP.Progression;

      this.hqUpgradeList.innerHTML = Object.keys(P.UPGRADE_DEFS)
        .map((id) => {
          const def = P.UPGRADE_DEFS[id];
          const level = state.upgrades[id] || 0;
          const maxed = level >= def.maxLevel;
          const cost = P.upgradeCost(id, level);
          const canAfford = !maxed && state.coins >= cost;
          let levelPips = "";
          for (let i = 0; i < def.maxLevel; i += 1) {
            levelPips += `<i class="${i < level ? "is-filled" : ""}"></i>`;
          }

          return `
            <div class="upgrade-card ${maxed ? "is-maxed" : ""}">
              <div class="upgrade-icon">${U.icon(def.icon)}</div>
              <div class="upgrade-body">
                <div class="upgrade-top">
                  <h4>${U.escapeHtml(def.name)}</h4>
                  <span class="upgrade-level">Nivel ${level}/${def.maxLevel}</span>
                </div>
                <p class="upgrade-desc">${U.escapeHtml(def.description)}</p>
                <div class="upgrade-meter">${levelPips}</div>
                <div class="upgrade-effect">
                  <span>Actual: <b>${def.effect(level)}</b></span>
                  ${!maxed ? `<span>Siguiente: <b>${def.next(level)}</b></span>` : '<span class="is-cap">Nivel máximo alcanzado</span>'}
                </div>
              </div>
              <div class="upgrade-action">
                ${maxed
                  ? '<span class="max-badge">MAX</span>'
                  : `<button class="primary-btn primary-btn--small" type="button" data-hq-action="buy-upgrade" data-id="${id}" ${!canAfford ? "disabled" : ""}>
                      Mejorar ${P.formatCoins(cost)} <svg class="icon"><use href="#i-coin"></use></svg>
                    </button>`}
              </div>
            </div>
          `;
        })
        .join("");
    }

    renderHqSkills() {
      if (!this.hqSkillList || !this.store) return;
      const state = this.store.progression;
      const P = BP.Progression;

      this.hqSkillList.innerHTML = P.SKILL_IDS.map((id) => {
        const def = P.SKILL_DEFS[id];
        const level = state.skills[id] || 0;
        const maxed = level >= def.maxLevel;
        const cost = P.skillCost(id, level);
        const canAfford = !maxed && state.coins >= cost;
        let levelPips = "";
        for (let i = 0; i < def.maxLevel; i += 1) {
          levelPips += `<i class="${i < level ? "is-filled" : ""}"></i>`;
        }

        return `
          <div class="skill-card ${maxed ? "is-maxed" : ""}">
            <div class="skill-card-head">
              <span class="skill-icon">${U.icon(def.icon)}</span>
              <div>
                <h4>${U.escapeHtml(def.name)}</h4>
                <span class="skill-level">${level === 0 ? "Bloqueado" : `Nivel ${level}/${def.maxLevel}`}</span>
              </div>
            </div>
            <div class="upgrade-meter">${levelPips}</div>
            <div class="skill-perks">
              <p><b>Manual:</b> ${def.manual(Math.max(1, level))}</p>
              <p><b>Bot:</b> ${level === 0 ? "Bloqueado para bots" : def.bot(level)}</p>
            </div>
            <div class="skill-action">
              ${maxed
                ? '<span class="max-badge">MAX</span>'
                : `<button class="primary-btn primary-btn--small" type="button" data-hq-action="buy-skill" data-id="${id}" ${!canAfford ? "disabled" : ""}>
                    ${level === 0 ? "Desbloquear" : "Mejorar"} ${P.formatCoins(cost)} <svg class="icon"><use href="#i-coin"></use></svg>
                  </button>`}
            </div>
          </div>
        `;
      }).join("");
    }

    renderHqLog() {
      if (!this.hqLogList || !this.store) return;
      const log = this.store.progression.log || [];
      if (log.length === 0) {
        this.hqLogList.innerHTML = '<div class="hq-empty">Sin eventos registrados aún.</div>';
        return;
      }
      this.hqLogList.innerHTML = log
        .map((entry) => `
          <div class="hq-log-item is-${entry.type || "info"}">
            <span class="hq-log-date">${U.formatDate(entry.date)}</span>
            <span class="hq-log-msg">${U.escapeHtml(entry.message)}</span>
          </div>
        `)
        .join("");
    }

    handleHqClick(event) {
      const tabButton = event.target.closest("[data-hq-tab]");
      if (tabButton) {
        this.setHqTab(tabButton.dataset.hqTab);
        this.sound.play("click");
        return;
      }

      const actionButton = event.target.closest("[data-hq-action]");
      if (!actionButton) return;
      const action = actionButton.dataset.hqAction;

      if (action === "buy-upgrade") {
        this.handleBuyUpgrade(actionButton.dataset.id);
      } else if (action === "buy-skill") {
        this.handleBuySkill(actionButton.dataset.id);
      } else if (action === "toggle-skill") {
        this.handleToggleBotSkill(actionButton.dataset.bot, actionButton.dataset.skill);
      } else if (action === "watch-bot") {
        this.ui.closeModal(this.hqModal);
        this.ui.switchView("spectator", actionButton.dataset.bot);
      }
    }

    handleHqChange(event) {
      const select = event.target.closest("[data-bot-difficulty]");
      if (!select || !this.bots) return;
      const botId = select.dataset.botDifficulty;
      const difficulty = select.value;
      this.bots.assignBot(botId, difficulty);
      this.sound.play("click");
      this.ui.toast(`Bot asignado a ${BP.PRESETS[difficulty].label}.`, "info");
    }

    handleHire() {
      if (!this.bots) return;
      const result = this.bots.hireBot();
      if (!result.ok) {
        if (result.reason === "capacity") {
          this.ui.toast("Capacidad al máximo. Mejora 'Capacidad del núcleo' para contratar más.", "warn", 3600);
          this.setHqTab("upgrades");
        } else if (result.reason === "coins") {
          this.ui.toast(`Monedas insuficientes. Necesitas ${BP.Progression.formatCoins(result.cost)} monedas.`, "warn", 3600);
        }
        return;
      }
      this.sound.play("coin");
      this.ui.toast(`¡${result.bot.name} se une al escuadrón!`, "success", 3200);
      this.ui.refreshProgression();
      this.renderHqBots();
      this.ui.renderSpectator(true);
    }

    handleBuyUpgrade(id) {
      if (!this.bots) return;
      const result = this.bots.buyUpgrade(id);
      if (!result.ok) {
        if (result.reason === "coins") {
          this.ui.toast("Monedas insuficientes para esta mejora.", "warn");
        }
        return;
      }
      this.sound.play("coin");
      const def = BP.Progression.UPGRADE_DEFS[id];
      this.ui.toast(`${def.name} subió al nivel ${result.level}.`, "success", 3000);
      this.ui.refreshProgression();
      this.renderHqUpgrades();
    }

    handleBuySkill(id) {
      if (!this.bots) return;
      const result = this.bots.buySkill(id);
      if (!result.ok) {
        if (result.reason === "coins") {
          this.ui.toast("Monedas insuficientes para esta habilidad.", "warn");
        }
        return;
      }
      this.sound.play("coin");
      const def = BP.Progression.SKILL_DEFS[id];
      this.ui.toast(`${def.name} subió al nivel ${result.level}.`, "success", 3000);
      this.ui.refreshProgression();
      this.renderHqSkills();
    }

    handleToggleBotSkill(botId, skillId) {
      if (!this.bots) return;
      const result = this.bots.toggleBotSkill(botId, skillId);
      if (!result.ok) {
        if (result.reason === "locked") {
          this.ui.toast("Primero compra esa habilidad en la pestaña Habilidades.", "warn", 3200);
          this.setHqTab("skills");
        }
        return;
      }
      this.sound.play("click");
      this.ui.toast(
        result.equipped ? "Habilidad equipada en el bot." : "Habilidad desequipada del bot.",
        "success",
        2000
      );
      this.ui.refreshProgression();
      this.renderHqBots();
      this.ui.renderSpectator(true);
    }
  }

  BP.HqComponent = HqComponent;
})();

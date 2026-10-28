/* ============================================================
   BUSCAMINAS POWER · Componente de modales, récords y avisos
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});
  const U = BP.Utils;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  class ModalsComponent {
    constructor({ ui, store, sound, fx }) {
      this.ui = ui;
      this.store = store;
      this.sound = sound;
      this.fx = fx;

      this.activeModal = null;
      this.lastFocus = null;
      this.resetArmed = false;
      this.resetTimer = null;

      this.toasts = $("#toasts");
      this.helpModal = $("#helpModal");
      this.recordsModal = $("#recordsModal");
      this.recordsSummary = $("#recordsSummary");
      this.bestGrid = $("#bestGrid");
      this.historyList = $("#historyList");
      this.resetRecordsBtn = $("#resetStatsBtn");

      this.resultModal = $("#resultModal");
      this.resultCard = this.resultModal ? this.resultModal.querySelector(".modal-card") : null;
      this.resultBadge = $("#resultBadge");
      this.resultTitle = $("#resultTitle");
      this.resultSub = $("#resultSub");
      this.resultMeta = $("#resultMeta");
      this.resultCoinsValue = $("#resultCoinsValue");
      this.resultTime = $("#resultTime");
      this.resultActions = $("#resultActions");
      this.resultCoinsRow = $("#resultCoinsRow");
      this.resultCoinsReason = $("#resultCoinsReason");
      this.resultAgainBtn = $("#resultAgainBtn");
      this.resultChangeBtn = $("#resultChangeBtn");
      this.resultDetails = $("#resultDetails");
      this.resultKicker = $("#resultKicker");
      this.newRecordBadge = $("#newRecordBadge");
      this.resultEmblemIcon = $("#resultEmblemIcon use");

      this.bindEvents();
    }

    bindEvents() {
      $$("[data-close-modal]").forEach((element) => {
        element.addEventListener("click", () => {
          const modal = element.closest(".modal");
          this.closeModal(modal);
        });
      });

      if (this.resetRecordsBtn) {
        this.resetRecordsBtn.addEventListener("click", () => this.handleResetStats());
      }

      if (this.resultAgainBtn) {
        this.resultAgainBtn.addEventListener("click", () => {
          this.closeModal(this.resultModal);
          this.ui.startSameGame();
        });
      }
      if (this.resultChangeBtn) this.resultChangeBtn.addEventListener("click", () => this.closeModal(this.resultModal));

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.activeModal) {
          this.closeModal(this.activeModal);
        } else if (event.key === "Tab" && this.activeModal) {
          this.trapFocus(event);
        }
      });
    }

    openModal(modal) {
      if (!modal) return;
      this.closeAllModals(modal);
      this.lastFocus = document.activeElement;
      this.activeModal = modal;
      modal.setAttribute("aria-hidden", "false");
      modal.classList.add("is-open");
      document.body.classList.add("modal-open");

      const focusable = modal.querySelector(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) focusable.focus();
    }

    closeModal(modal) {
      if (!modal) return;
      modal.setAttribute("aria-hidden", "true");
      modal.classList.remove("is-open");
      if (this.activeModal === modal) this.activeModal = null;
      if (!document.querySelector('.modal[aria-hidden="false"]')) {
        document.body.classList.remove("modal-open");
      }
      if (this.lastFocus && typeof this.lastFocus.focus === "function") {
        this.lastFocus.focus();
        this.lastFocus = null;
      }
    }

    closeAllModals(except = null) {
      $$(".modal").forEach((modal) => {
        if (modal !== except) this.closeModal(modal);
      });
    }

    trapFocus(event) {
      if (!this.activeModal) return;
      const focusables = $$(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        this.activeModal
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    openHelp() {
      this.openModal(this.helpModal);
      this.sound.play("click");
    }

    openRecords() {
      this.renderRecords();
      this.openModal(this.recordsModal);
      this.sound.play("click");
    }

    renderRecords() {
      if (!this.store) return;
      const agg = this.store.getAggregate();
      const played = agg.played || 0;
      const won = agg.won || 0;
      const rate = played > 0 ? Math.round((won / played) * 100) : 0;

      if (this.recordsSummary) {
        this.recordsSummary.innerHTML = `
          <div class="rec-stat"><strong>${played}</strong><span>Partidas</span></div>
          <div class="rec-stat"><strong>${won}</strong><span>Victorias</span></div>
          <div class="rec-stat"><strong>${rate}%</strong><span>Tasa de victoria</span></div>
          <div class="rec-stat"><strong>${agg.bestMs != null ? U.formatClock(agg.bestMs) : "--:--"}</strong><span>Mejor global</span></div>
        `;
      }

      if (this.bestGrid) {
        const cards = [];
        ["beginner", "intermediate", "expert"].forEach((k) => {
          cards.push(this.buildBestCard(BP.PRESETS[k].label, this.store.getBest(k)));
        });
        const customBest = this.store.getBestCustom();
        let customLabel = "Personalizado";
        if (customBest && customBest.modeKey) {
          const parts = customBest.modeKey.split(":")[1];
          if (parts) customLabel = `Personalizado ${parts}`;
        }
        cards.push(this.buildBestCard(customLabel, customBest));
        this.bestGrid.innerHTML = cards.join("");
      }

      if (this.historyList) {
        const history = this.store.getHistory();
        if (history.length === 0) {
          this.historyList.innerHTML = '<div class="history-empty">Todavía no hay partidas registradas. El campo minado espera.</div>';
        } else {
          this.historyList.innerHTML = history
            .map((entry) => {
              const win = entry.result === "win";
              const powers = entry.powers || {};
              const used = Object.values(powers).reduce((s, v) => s + (Number(v) || 0), 0);
              const breakdown = `Visión ${Number(powers.xray) || 0} · Desarme ${Number(powers.defuse) || 0} · Escudo ${Number(powers.immortal) || 0} · Crio ${Number(powers.freeze) || 0} · Consejero ${Number(powers.hint) || 0}`;
              return `
                <div class="history-row">
                  <div class="history-mode">${U.escapeHtml(entry.modeLabel)}<small>${entry.width}×${entry.height} · ${entry.mines} minas</small></div>
                  <div class="history-result ${win ? "is-win" : "is-lose"}">${win ? "Victoria" : "Derrota"}</div>
                  <div class="history-time">${U.formatPrecise(entry.timeMs)}</div>
                  <div class="history-date">${U.formatDate(entry.date)}</div>
                  <div class="history-powers" title="${U.escapeHtml(breakdown)}">${used} usos</div>
                </div>
              `;
            })
            .join("");
        }
      }

      this.setResetButtonState(false);
    }

    buildBestCard(label, best) {
      if (!best) {
        return `
          <div class="best-card">
            <h4>${U.escapeHtml(label)}</h4>
            <div class="best-time is-empty">--:--</div>
            <p class="best-date">Sin récord registrado</p>
          </div>
        `;
      }
      return `
        <div class="best-card is-set">
          <h4>${U.escapeHtml(label)}</h4>
          <div class="best-time">${U.formatPrecise(best.timeMs)}</div>
          <p class="best-date">${U.formatDate(best.date)} · ${best.actions} acciones</p>
        </div>
      `;
    }

    handleResetStats() {
      if (!this.resetArmed) {
        this.setResetButtonState(true);
        this.sound.play("click");
        return;
      }
      this.store.resetHistory();
      this.renderRecords();
      this.toast("Historial y mejores marcas borrados.", "info");
      this.sound.play("unflag");
    }

    setResetButtonState(armed) {
      this.resetArmed = Boolean(armed);
      if (this.resetTimer) window.clearTimeout(this.resetTimer);
      this.resetTimer = null;
      if (!this.resetRecordsBtn) return;
      if (this.resetArmed) {
        this.resetRecordsBtn.textContent = "¿Seguro? Haz clic para confirmar";
        this.resetRecordsBtn.classList.add("is-armed");
        this.resetTimer = window.setTimeout(() => this.setResetButtonState(false), 4200);
      } else {
        this.resetRecordsBtn.textContent = "Borrar historial y marcas";
        this.resetRecordsBtn.classList.remove("is-armed");
      }
    }

    showResult(data) {
      if (!this.resultModal) return;
      const isWin = data.result === "win";

      if (this.resultCard) {
        this.resultCard.classList.toggle("modal-card--win", isWin);
        this.resultCard.classList.toggle("modal-card--lose", !isWin);
      }

      if (this.resultBadge) {
        this.resultBadge.textContent = isWin ? "¡SECTOR LIMPIO!" : "DETONACIÓN";
        this.resultBadge.className = `result-badge ${isWin ? "is-win" : "is-lose"}`;
      }

      if (this.resultTitle) {
        this.resultTitle.textContent = isWin ? "¡Misión cumplida!" : "Fin de la patrulla";
      }

      if (this.resultSub) {
        this.resultSub.textContent = isWin
          ? "Todas las celdas seguras descubiertas."
          : (data.reason === "giveup" ? "Misión reiniciada por el usuario." : "Una mina se activó bajo tus pies.");
      }

      if (this.resultMeta) {
        this.resultMeta.textContent = `${data.modeLabel || "Partida"} · ${data.width}×${data.height} · ${data.mines} minas`;
      }

      if (this.resultTime) this.resultTime.textContent = U.formatPrecise(data.timeMs);
      if (this.resultKicker) this.resultKicker.textContent = isWin ? "MISIÓN COMPLETADA" : "MISIÓN FALLIDA";
      if (this.resultEmblemIcon) this.resultEmblemIcon.setAttribute("href", isWin ? "#i-trophy" : "#i-bomb");
      if (this.newRecordBadge) this.newRecordBadge.hidden = !data.isRecord;
      if (this.resultDetails) {
        const details = data.rewardDetails;
        this.resultDetails.innerHTML = `
          <div class="result-detail result-detail--coins"><strong>+${BP.Progression.formatCoins(data.reward)}</strong><span>Monedas</span></div>
          ${details ? `<div class="result-detail"><strong>+${details.speedBonus}</strong><span>Velocidad</span></div>
          <div class="result-detail"><strong>+${details.flagBonus}</strong><span>${details.unflagged} sin bandera</span></div>
          ${details.salvageBonus ? `<div class="result-detail"><strong>+${details.salvageBonus}</strong><span>Refinería</span></div>` : ""}
          ${details.streakBonus ? `<div class="result-detail"><strong>+${details.streakBonus}</strong><span>Racha experta</span></div>` : ""}
          ${details.contractBonus ? `<div class="result-detail"><strong>+${details.contractBonus}</strong><span>Contratos y rango</span></div>` : ""}` : ""}
        `;
      }
      if (this.resultActions) this.resultActions.textContent = `${data.actions || 0} acciones`;

      const coins = Number(data.coins) || 0;
      if (this.resultCoinsRow) {
        this.resultCoinsRow.hidden = coins <= 0;
        if (this.resultCoinsValue) this.resultCoinsValue.textContent = `+${BP.Progression.formatCoins(coins)}`;
      }
      if (this.resultCoinsReason) {
        this.resultCoinsReason.textContent = isWin
          ? (data.speedBonus ? `Incluye +${data.speedBonus} bonus de velocidad` : "Recompensa base de sector")
          : "Compensación por celdas descubiertas";
      }

      this.openModal(this.resultModal);
      if (this.resultAgainBtn) this.resultAgainBtn.focus();
    }

    toast(message, type = "info", duration = 3200) {
      if (!this.toasts) return;
      const el = document.createElement("div");
      el.className = `toast toast--${type}`;
      el.setAttribute("role", "status");
      el.innerHTML = `<span>${U.escapeHtml(message)}</span>`;
      this.toasts.appendChild(el);

      void el.offsetWidth;
      el.classList.add("is-visible");

      const remove = () => {
        el.classList.remove("is-visible");
        window.setTimeout(() => {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, 160);
      };

      const timer = window.setTimeout(remove, duration);
      el.addEventListener("click", () => {
        window.clearTimeout(timer);
        remove();
      });
    }
  }

  BP.ModalsComponent = ModalsComponent;
})();

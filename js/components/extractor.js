/* Clics activos para adelantar la recarga gratuita del turbo. */
(function () {
  "use strict";
  const BP = (window.BP = window.BP || {});
  const COMBO_WINDOW_MS = 1500;
  const formatSeconds = (value) => (Math.round(value * 100) / 100).toLocaleString("es-ES", { maximumFractionDigits: 2 });

  class ExtractorComponent {
    constructor({ ui, store, sound, fx }) {
      this.ui = ui;
      this.store = store;
      this.sound = sound;
      this.fx = fx;
      this.comboClicks = 0;
      this.lastClickAt = null;
      this.lastEffectAt = 0;
      this.button = document.getElementById("extractBtn");
      this.activate = document.getElementById("extractActivate");
      this.upgrade = document.getElementById("extractUpgrade");
      this.info = document.getElementById("extractInfo");
      this.chargeLabel = document.getElementById("extractCharge");
      this.bar = document.getElementById("extractBar");
      if (this.button) this.button.addEventListener("click", () => this.extract());
      if (this.activate) this.activate.addEventListener("click", () => this.activateFreeTurbo());
      if (this.upgrade) this.upgrade.addEventListener("click", () => this.buyUpgrade());
    }

    comboAt(now) {
      if (this.lastClickAt === null || now - this.lastClickAt > COMBO_WINDOW_MS) return 1;
      return Math.min(5, 1 + Math.floor(this.comboClicks / 5));
    }

    extract(now = performance.now()) {
      const manager = this.ui.bots;
      if (!manager || manager.turboFreeRechargeAt <= now) return { reducedMs: 0, combo: 1 };
      if (this.lastClickAt === null || now - this.lastClickAt > COMBO_WINDOW_MS) this.comboClicks = 0;
      this.comboClicks += 1;
      this.lastClickAt = now;
      const combo = this.comboAt(now);
      const extractor = this.store.progression.extractor;
      const reducedMs = manager.accelerateTurboRecharge(BP.Progression.turboClickSeconds(extractor.level) * combo * 1000, now);
      extractor.clicks = Math.min(999999999, extractor.clicks + 1);
      if (extractor.clicks % 10 === 0) this.store.save();
      if (manager.turboFreeRechargeAt <= now) {
        this.sound.play("sparkle");
        this.fx.energyArcs(this.button, "#45edff", 3);
        this.fx.shakeLight();
        this.ui.toast(manager.isTurboActive ? "Turbo gratuito listo para la próxima activación." : "Turbo gratuito listo. Pulsa Activar turbo.", "success", 2500);
      } else if (now - this.lastEffectAt >= 300) {
        this.fx.floatingText(this.button, `−${formatSeconds(reducedMs / 1000)} s`, "#45edff", 14);
        this.lastEffectAt = now;
      }
      this.ui.refreshProgression();
      return { reducedMs, combo };
    }

    activateFreeTurbo() {
      const manager = this.ui.bots;
      if (!manager || !manager.turboFreeRechargeReady || manager.isTurboActive) return false;
      const result = manager.activateTurbo();
      if (!result.ok) return false;
      this.sound.play("sparkle");
      this.ui.toast("Turbo gratis: bots a 4,5× durante 25 s.", "success", 2500);
      this.ui.refreshProgression();
      return true;
    }

    buyUpgrade() {
      const extractor = this.store.progression.extractor;
      const cost = BP.Progression.extractorCost(extractor.level);
      if (cost === null || !this.store.spendCoins(cost)) return false;
      extractor.level += 1;
      this.store.save();
      this.sound.play("coin");
      this.ui.toast(`Recarga nivel ${extractor.level} · −${formatSeconds(BP.Progression.turboClickSeconds(extractor.level))} s por clic.`, "success", 2000);
      this.ui.refreshProgression();
      return true;
    }

    render(now = performance.now()) {
      const manager = this.ui.bots;
      const state = this.store.progression;
      const level = state.extractor.level;
      const combo = this.comboAt(now);
      const cost = BP.Progression.extractorCost(level);
      const remaining = manager ? Math.max(0, manager.turboFreeRechargeAt - now) : BP.Progression.TURBO_RECHARGE_MS;
      const ready = Boolean(manager && remaining <= 0);
      const active = Boolean(manager && manager.isTurboActive);
      if (this.button) {
        this.button.disabled = !manager || ready;
        this.button.textContent = ready ? "Recarga lista" : `Cargar −${formatSeconds(BP.Progression.turboClickSeconds(level) * combo)} s`;
      }
      if (this.activate) {
        this.activate.disabled = !ready || active;
        this.activate.textContent = active ? `Turbo activo · ${Math.ceil(manager.turboRemainingMs / 1000)} s` : "Activar turbo gratis";
      }
      if (this.upgrade) {
        this.upgrade.disabled = cost === null || state.coins < cost;
        const next = cost === null ? 0 : BP.Progression.turboClickSeconds(level + 1);
        this.upgrade.textContent = cost === null ? "Nivel máximo" : `Mejorar · ${BP.Progression.formatCoins(cost)}`;
        this.upgrade.setAttribute("aria-label", cost === null ? "Recarga al máximo" : `Mejorar por ${BP.Progression.formatCoins(cost)} monedas. Siguiente nivel: ${formatSeconds(next)} segundos por clic.`);
      }
      if (this.info) this.info.textContent = `Nivel ${level} · combo ×${combo}`;
      if (this.chargeLabel) this.chargeLabel.textContent = ready ? "LISTO" : `${Math.ceil(remaining / 1000)} s`;
      if (this.bar) this.bar.style.width = `${Math.max(0, Math.min(100, (1 - remaining / BP.Progression.TURBO_RECHARGE_MS) * 100))}%`;
    }
  }

  BP.ExtractorComponent = ExtractorComponent;
})();

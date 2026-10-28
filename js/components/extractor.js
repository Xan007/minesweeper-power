/* Ciclo activo: clics, combo, descargas y mejora permanente. */
(function () {
  "use strict";
  const BP = (window.BP = window.BP || {});
  const CHARGE_MAX = 25;
  const COMBO_WINDOW_MS = 1500;

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
      this.upgrade = document.getElementById("extractUpgrade");
      this.info = document.getElementById("extractInfo");
      this.chargeLabel = document.getElementById("extractCharge");
      this.bar = document.getElementById("extractBar");
      if (this.button) this.button.addEventListener("click", () => this.extract());
      if (this.upgrade) this.upgrade.addEventListener("click", () => this.buyUpgrade());
    }

    comboAt(now) {
      if (this.lastClickAt === null || now - this.lastClickAt > COMBO_WINDOW_MS) return 1;
      return Math.min(5, 1 + Math.floor(this.comboClicks / 5));
    }

    extract(now = performance.now()) {
      const state = this.store.progression;
      const extractor = state.extractor;
      if (this.lastClickAt === null || now - this.lastClickAt > COMBO_WINDOW_MS) this.comboClicks = 0;
      this.comboClicks += 1;
      this.lastClickAt = now;
      const combo = this.comboAt(now);
      const power = BP.Progression.extractorPower(extractor.level);
      const clickReward = power * combo;
      extractor.clicks = Math.min(999999999, extractor.clicks + 1);
      extractor.charge += 1;
      let burstReward = 0;
      if (extractor.charge >= CHARGE_MAX) {
        extractor.charge = 0;
        const activeBots = this.ui.bots ? this.ui.bots.activeCount() : 0;
        burstReward = Math.round(power * 10 * (1 + activeBots * 0.1));
        if (this.ui.bots) this.ui.bots.activateExtractionBoost();
      }
      this.store.addCoins(clickReward + burstReward);
      if (burstReward) {
        this.sound.play("coin");
        this.fx.coinBurst(this.button, 16);
        this.fx.energyArcs(this.button, "#ffc75a", 4);
        this.fx.shakeMedium();
        this.fx.floatingText(this.button, `+${BP.Progression.formatCoins(burstReward)} · DESCARGA`, "#ffc75a", 17);
        this.ui.toast(`Descarga: +${BP.Progression.formatCoins(burstReward)} · bots hasta 1,5× durante 8 s.`, "success", 2200);
      } else if (now - this.lastEffectAt >= 250) {
        this.fx.floatingText(this.button, `+${BP.Progression.formatCoins(clickReward)}`, "#ffc75a", 14);
        this.lastEffectAt = now;
      }
      this.ui.refreshProgression();
      return { clickReward, burstReward, combo };
    }

    buyUpgrade() {
      const extractor = this.store.progression.extractor;
      const cost = BP.Progression.extractorCost(extractor.level);
      if (cost === null || !this.store.spendCoins(cost)) return false;
      extractor.level += 1;
      this.store.save();
      this.sound.play("coin");
      this.ui.toast(`Extractor nivel ${extractor.level} · +${BP.Progression.formatCoins(BP.Progression.extractorPower(extractor.level))} por clic.`, "success", 2000);
      this.ui.refreshProgression();
      return true;
    }

    render(now = performance.now()) {
      const state = this.store.progression;
      const extractor = state.extractor;
      const power = BP.Progression.extractorPower(extractor.level);
      const combo = this.comboAt(now);
      const cost = BP.Progression.extractorCost(extractor.level);
      if (this.button) this.button.textContent = `Extraer +${BP.Progression.formatCoins(power * combo)}`;
      if (this.upgrade) {
        this.upgrade.disabled = cost === null || state.coins < cost;
        const nextPower = cost === null ? 0 : BP.Progression.extractorPower(extractor.level + 1);
        this.upgrade.textContent = cost === null ? "Nivel máximo" : `Mejorar · ${BP.Progression.formatCoins(cost)} → +${BP.Progression.formatCoins(nextPower)}/clic`;
        this.upgrade.title = cost === null ? "Extractor al máximo" : `Siguiente nivel: ${BP.Progression.formatCoins(BP.Progression.extractorPower(extractor.level + 1))} monedas por clic; cada 10 niveles se duplica.`;
      }
      if (this.info) this.info.textContent = `Nivel ${extractor.level} · combo ×${combo}${this.ui.bots && now < this.ui.bots.extractionBoostUntil ? " · bots 1,5×" : ""}`;
      if (this.chargeLabel) this.chargeLabel.textContent = `${extractor.charge}/${CHARGE_MAX}`;
      if (this.bar) this.bar.style.width = `${100 * extractor.charge / CHARGE_MAX}%`;
    }
  }

  BP.ExtractorComponent = ExtractorComponent;
})();

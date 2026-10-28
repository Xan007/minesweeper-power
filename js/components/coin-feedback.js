/* Retroalimentacion de ingresos: agrupa ganancias cercanas sin interrumpir el tablero. */
(function () {
  "use strict";
  const BP = (window.BP = window.BP || {});

  class CoinFeedback {
    constructor({ store, sound, fx, counter, chip }) {
      this.store = store;
      this.sound = sound;
      this.fx = fx;
      this.counter = counter;
      this.chip = chip;
      this.pending = 0;
      this.timer = null;
      this.popup = null;
      this.popupTimer = null;
    }

    add(amount) {
      if (!(amount > 0)) return;
      if (this.counter) this.counter.textContent = BP.Progression.formatCoins(this.store.progression.coins);
      this.pending += amount;
      if (!this.timer) this.timer = window.setTimeout(() => this.flush(), 250);
    }

    flush() {
      this.timer = null;
      const amount = this.pending;
      this.pending = 0;
      if (!(amount > 0)) return;
      const hq = document.getElementById("hqModal");
      const hqCounter = document.getElementById("hqCoins");
      const target = hq && hq.classList.contains("is-open") && hqCounter ? hqCounter : this.counter;
      if (target) {
        target.textContent = BP.Progression.formatCoins(this.store.progression.coins);
        target.classList.remove("coin-reward-pulse");
        void target.offsetWidth;
        target.classList.add("coin-reward-pulse");
        const rect = target.getBoundingClientRect();
        if (this.popup) this.popup.remove();
        if (this.popupTimer) window.clearTimeout(this.popupTimer);
        const popup = document.createElement("span");
        popup.className = "coin-reward-popup";
        popup.setAttribute("aria-hidden", "true");
        popup.textContent = `+${BP.Progression.formatCoins(amount)}`;
        popup.style.left = `${Math.max(28, Math.min(window.innerWidth - 28, rect.left + rect.width / 2))}px`;
        popup.style.top = `${Math.min(window.innerHeight - 30, rect.bottom + 4)}px`;
        document.body.appendChild(popup);
        this.popup = popup;
        this.popupTimer = window.setTimeout(() => {
          popup.remove();
          if (this.popup === popup) this.popup = null;
          this.popupTimer = null;
        }, 900);
        if (this.fx && this.fx.coinBurst) this.fx.coinBurst(target, amount >= 100 ? 12 : 7);
      }
      if (this.sound) this.sound.play("coin");
    }
  }

  BP.CoinFeedback = CoinFeedback;
})();

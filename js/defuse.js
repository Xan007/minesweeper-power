/* ============================================================
   BUSCAMINAS POWER · minijuego de desarme (aguja + zona blanca)
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});

  function polar(cx, cy, radius, angleDegrees) {
    const radians = ((angleDegrees - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(radians),
      y: cy + radius * Math.sin(radians),
    };
  }

  function arcPath(cx, cy, radius, center, width) {
    const start = center - width / 2;
    const end = center + width / 2;
    const from = polar(cx, cy, radius, start);
    const to = polar(cx, cy, radius, end);
    const largeArc = width > 180 ? 1 : 0;
    return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
  }

  class DefuseMinigame {
    constructor() {
      this.overlay = document.getElementById("defuseOverlay");
      this.card = document.getElementById("defuseCard");
      this.needle = document.getElementById("defuseNeedle");
      this.targetArc = document.getElementById("defuseTargetArc");
      this.ticks = document.getElementById("defuseTicks");
      this.cutButton = document.getElementById("defuseCutBtn");
      this.resultEl = document.getElementById("defuseResult");
      this.precisionEl = document.getElementById("defusePrecision");
      this.angleEl = document.getElementById("defuseAngle");

      this.active = false;
      this.resolved = false;
      this.angle = 0;
      this.targetCenter = 0;
      this.targetWidth = 36;
      this.speed = 240;
      this.direction = 1;
      this.raf = null;
      this.lastTime = 0;
      this.readyAt = 0;
      this.preparing = false;
      this.callbacks = {};
      this.hideTimer = null;
      this.focusTimer = null;

      this.buildTicks();
      this.overlay.addEventListener("pointerdown", (event) => {
        if (!this.active) return;
        event.preventDefault();
        this.cut();
      });
    }

    buildTicks() {
      if (!this.ticks) return;
      this.ticks.textContent = "";
      for (let angle = 0; angle < 360; angle += 5) {
        const major = angle % 30 === 0;
        const outer = polar(160, 160, 136, angle);
        const inner = polar(160, 160, major ? 126 : 130.5, angle);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", outer.x.toFixed(2));
        line.setAttribute("y1", outer.y.toFixed(2));
        line.setAttribute("x2", inner.x.toFixed(2));
        line.setAttribute("y2", inner.y.toFixed(2));
        if (major) line.classList.add("is-major");
        this.ticks.appendChild(line);
      }
    }

    resetVisuals() {
      this.card.classList.remove("is-success", "is-fail", "is-resolved");
      this.resultEl.className = "defuse-result";
      this.resultEl.textContent = "";
      this.precisionEl.className = "defuse-precision";
      this.precisionEl.textContent = "EN ESPERA DE CORTE";
      this.needle.style.opacity = "1";
      this.cutButton.disabled = false;
    }

    pickStartAngle() {
      let angle = 0;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        angle = Math.random() * 360;
        if (BP.Utils.angularDistance(angle, this.targetCenter) > 85) return angle;
      }
      return (this.targetCenter + 140) % 360;
    }

    start(options = {}) {
      this.stop(false);
      this.counter = Date.now();
      this.active = true;
      this.resolved = false;
      this.callbacks = {
        onCut: options.onCut || null,
        onResult: options.onResult || null,
      };

      this.targetWidth = BP.Utils.clamp(options.targetWidth || 44, 32, 64);
      this.speed = BP.Utils.clamp(options.speed || 180, 120, 280);
      this.targetCenter = Math.random() * 360;
      this.direction = Math.random() < 0.5 ? -1 : 1;
      this.angle = this.pickStartAngle();

      this.targetArc.setAttribute("d", arcPath(160, 160, 118, this.targetCenter, this.targetWidth));
      this.resetVisuals();
      this.applyNeedle();

      this.overlay.hidden = false;
      this.overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("is-defusing");

      const delay = Math.max(0, Number(options.reactionDelayMs) || 0);
      this.lastTime = performance.now();
      this.readyAt = this.lastTime + delay;
      this.preparing = delay > 0;
      if (this.preparing) {
        this.cutButton.disabled = true;
        this.precisionEl.textContent = "PREPÁRATE · 1.0 s";
      }
      this.raf = requestAnimationFrame((time) => this.loop(time));
      this.focusTimer = window.setTimeout(() => {
        if (this.active && this.cutButton && !this.cutButton.disabled) this.cutButton.focus({ preventScroll: true });
      }, delay + 80);
    }

    loop(time) {
      if (!this.active || this.resolved) return;
      if (time < this.readyAt) {
        this.lastTime = time;
        this.precisionEl.textContent = `PREPÁRATE · ${((this.readyAt - time) / 1000).toFixed(1)} s`;
        this.raf = requestAnimationFrame((next) => this.loop(next));
        return;
      }
      if (this.preparing) {
        this.preparing = false;
        this.cutButton.disabled = false;
        this.precisionEl.textContent = "LISTO · DETÉN LA AGUJA EN BLANCO";
      }
      const dt = Math.min(0.05, Math.max(0.001, (time - this.lastTime) / 1000));
      this.lastTime = time;
      this.angle = (this.angle + this.direction * this.speed * dt + 360) % 360;
      this.applyNeedle();
      this.raf = requestAnimationFrame((next) => this.loop(next));
    }

    applyNeedle() {
      this.needle.setAttribute("transform", `rotate(${this.angle.toFixed(2)} 160 160)`);
      if (this.angleEl) this.angleEl.textContent = `${this.angle.toFixed(1)}°`;
    }

    cut() {
      if (!this.active || this.resolved || performance.now() < this.readyAt) return null;
      this.resolved = true;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;

      const diff = BP.Utils.angularDistance(this.angle, this.targetCenter);
      const half = this.targetWidth / 2;
      const success = diff <= half;

      this.card.classList.add(success ? "is-success" : "is-fail", "is-resolved");
      this.cutButton.disabled = true;
      this.needle.style.opacity = success ? "0.95" : "0.7";

      this.resultEl.className = `defuse-result is-visible ${success ? "is-success" : "is-fail"}`;
      this.resultEl.innerHTML = success
        ? "<strong>CORTE LIMPIO</strong><span>Mina neutralizada (+10 monedas)</span>"
        : "<strong>CORTE FALLIDO</strong><span>La aguja estaba fuera de la zona</span>";
      this.precisionEl.className = `defuse-precision ${success ? "is-success" : "is-fail"}`;
      this.precisionEl.textContent = success
        ? `DESVIACIÓN ${diff.toFixed(1)}° · DENTRO DE LA ZONA`
        : `DESVIACIÓN ${diff.toFixed(1)}° · FUERA DE LA ZONA`;

      const cutCallback = this.callbacks.onCut;
      if (cutCallback) {
        cutCallback({
          success,
          difference: diff,
          angle: this.angle,
          targetCenter: this.targetCenter,
          targetWidth: this.targetWidth,
        });
      }

      const resultCallback = this.callbacks.onResult;
      this.hideTimer = window.setTimeout(() => {
        this.hide();
        if (resultCallback) {
          resultCallback(success, { difference: diff });
        }
      }, success ? 1050 : 1250);

      return { success, difference: diff };
    }

    hide() {
      this.active = false;
      this.overlay.hidden = true;
      this.overlay.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-defusing");
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      if (this.hideTimer) window.clearTimeout(this.hideTimer);
      if (this.focusTimer) window.clearTimeout(this.focusTimer);
      this.hideTimer = null;
      this.focusTimer = null;
      this.callbacks = {};
      this.resetVisuals();
    }

    stop(hide = true) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      if (this.hideTimer) window.clearTimeout(this.hideTimer);
      if (this.focusTimer) window.clearTimeout(this.focusTimer);
      this.hideTimer = null;
      this.focusTimer = null;
      this.active = false;
      this.resolved = false;
      this.preparing = false;
      this.readyAt = 0;
      this.callbacks = {};
      if (hide && this.overlay) {
        this.overlay.hidden = true;
        this.overlay.setAttribute("aria-hidden", "true");
        document.body.classList.remove("is-defusing");
        this.resetVisuals();
      }
    }
  }

  BP.DefuseMinigame = DefuseMinigame;
})();

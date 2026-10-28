/* ============================================================
   BUSCAMINAS POWER · sistema de partículas, rayos y efectos visuales
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});

  function generateLightningSegments(x1, y1, x2, y2, iterations = 4, displacement = 22) {
    let points = [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ];
    let disp = displacement;

    for (let iter = 0; iter < iterations; iter += 1) {
      const next = [];
      for (let i = 0; i < points.length - 1; i += 1) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;

        const offset = (Math.random() - 0.5) * disp * 2;
        const mid = {
          x: midX + nx * offset,
          y: midY + ny * offset,
        };

        next.push(p1, mid);
      }
      next.push(points[points.length - 1]);
      points = next;
      disp *= 0.55;
    }
    return points;
  }

  function createLightningBranches(points, count = 2) {
    const branches = [];
    if (points.length < 6 || count <= 0) return branches;
    const step = Math.floor(points.length / (count + 1));
    for (let b = 1; b <= count; b += 1) {
      const idx = b * step;
      const start = points[idx];
      if (!start) continue;
      const prev = points[Math.max(0, idx - 1)];
      const dirX = start.x - prev.x;
      const dirY = start.y - prev.y;
      const angle = Math.atan2(dirY, dirX) + (Math.random() < 0.5 ? 0.65 : -0.65);
      const branchLen = 25 + Math.random() * 45;
      const endX = start.x + Math.cos(angle) * branchLen;
      const endY = start.y + Math.sin(angle) * branchLen;
      branches.push(generateLightningSegments(start.x, start.y, endX, endY, 3, 10));
    }
    return branches;
  }

  class FX {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.particles = [];
      this.running = false;
      this.lastTime = 0;
      this.raf = null;
      this.trauma = 0;
      this.shakeTime = 0;
      this.shaking = false;
      this.flashEl = document.getElementById("screenFlash");
      this.appEl = document.querySelector(".app") || document.body;
      this.baseShakeTargets = [this.appEl, this.canvas, this.flashEl, document.getElementById("toasts")].filter(Boolean);
      this.overlayShakeTargets = Array.from(document.querySelectorAll(".modal, .defuse-overlay"));
      this.shakeTargets = this.baseShakeTargets.slice();
      this.reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.resize();
      window.addEventListener("resize", () => this.resize());
    }

    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.dpr = dpr;
      this.canvas.width = Math.floor(this.width * dpr);
      this.canvas.height = Math.floor(this.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    centerOf(element) {
      if (!element) return { x: this.width / 2, y: this.height / 2 };
      if (typeof element.x === "number" && typeof element.y === "number") {
        return { x: element.x, y: element.y };
      }
      if (!element.getBoundingClientRect) {
        return { x: this.width / 2, y: this.height / 2 };
      }
      const rect = element.getBoundingClientRect();
      if (!rect.width && !rect.height) return { x: this.width / 2, y: this.height / 2 };
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    add(particle) {
      if (this.particles.length >= 200) return;
      particle.maxLife = particle.life;
      particle.age = 0;
      this.particles.push(particle);
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.lastTime = performance.now();
      this.raf = requestAnimationFrame((time) => this.loop(time));
    }

    addTrauma(amount) {
      if (this.reduced) return;
      const visibleOverlays = this.overlayShakeTargets.filter((element) =>
        element.classList.contains("modal") ? element.classList.contains("is-open") : !element.hidden
      );
      const targets = this.baseShakeTargets.concat(visibleOverlays);
      this.shakeTargets.forEach((element) => {
        if (!targets.includes(element)) element.style.transform = "";
      });
      this.shakeTargets = targets;
      this.trauma = Math.min(1.0, this.trauma + amount);
      this.start();
    }

    shake(amount = 0.5) {
      this.addTrauma(amount);
    }

    shakeLight() {
      this.addTrauma(0.28);
    }

    shakeMedium() {
      this.addTrauma(0.55);
    }

    shakeHeavy() {
      this.addTrauma(0.9);
    }

    loop(time) {
      if (!this.running) return;
      const ctx = this.ctx;
      const dt = Math.min(0.034, Math.max(0.001, (time - this.lastTime) / 1000));
      this.lastTime = time;
      ctx.clearRect(0, 0, this.width, this.height);

      if (this.trauma > 0) {
        this.trauma = Math.max(0, this.trauma - dt * 1.7);
        const shake = this.trauma * this.trauma;
        this.shakeTime += dt * 32.0;
        if (!this.reduced) {
          this.shaking = true;
          const offsetX = Math.sin(this.shakeTime * 1.8) * 17 * shake;
          const offsetY = Math.cos(this.shakeTime * 2.3) * 13 * shake;
          const transform =
            shake > 0.001
              ? `translate3d(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px, 0)`
              : "";
          this.shakeTargets.forEach((element) => { element.style.transform = transform; });
        }
      } else if (this.shaking) {
        this.shakeTargets.forEach((element) => { element.style.transform = ""; });
        this.shaking = false;
      }

      for (let index = this.particles.length - 1; index >= 0; index -= 1) {
        const particle = this.particles[index];
        particle.age += dt;
        particle.life -= dt;
        if (particle.life <= 0) {
          this.particles.splice(index, 1);
          continue;
        }
        particle.vy += (particle.gravity || 0) * dt;
        particle.vx *= particle.drag == null ? 0.995 : particle.drag;
        particle.vy *= particle.drag == null ? 0.995 : particle.drag;
        particle.x += (particle.vx || 0) * dt;
        particle.y += (particle.vy || 0) * dt;
        if (particle.rotation != null) {
          particle.rotation += (particle.vr || 0) * dt;
        }
        this.drawParticle(ctx, particle);
      }

      if (this.particles.length > 0 || this.trauma > 0) {
        this.raf = requestAnimationFrame((next) => this.loop(next));
      } else {
        this.running = false;
        if (this.shaking) this.shakeTargets.forEach((element) => { element.style.transform = ""; });
        this.shaking = false;
        ctx.clearRect(0, 0, this.width, this.height);
      }
    }

    drawParticle(ctx, particle) {
      const alpha = Math.max(0, Math.min(1, particle.life / particle.maxLife));
      const fade = particle.fadeIn ? Math.min(1, particle.age / 0.08) : 1;
      ctx.globalAlpha = alpha * fade;
      ctx.fillStyle = particle.color;
      ctx.strokeStyle = particle.color;

      if (particle.shape === "ring") {
        const progress = 1 - alpha;
        ctx.globalAlpha = alpha * 0.9;
        ctx.lineWidth = Math.max(0.5, particle.size * (0.35 + alpha * 0.65));
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius + progress * particle.grow, 0, Math.PI * 2);
        ctx.stroke();
      } else if (particle.shape === "spark") {
        ctx.lineWidth = particle.size;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.x - particle.vx * 0.028, particle.y - particle.vy * 0.028);
        ctx.stroke();
      } else if (particle.shape === "shard") {
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation || 0);
        ctx.beginPath();
        ctx.moveTo(0, -particle.size);
        ctx.lineTo(particle.size * 0.62, particle.size * 0.72);
        ctx.lineTo(-particle.size * 0.55, particle.size * 0.48);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (particle.shape === "lightning") {
        const segs = particle.segments;
        if (!segs || segs.length < 2) return;
        ctx.save();
        ctx.globalAlpha = alpha * 0.95;
        ctx.strokeStyle = particle.glowColor || particle.color;
        ctx.lineWidth = Math.max(1, particle.size * 2.5);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(segs[0].x, segs[0].y);
        for (let i = 1; i < segs.length; i += 1) {
          ctx.lineTo(segs[i].x, segs[i].y);
        }
        ctx.stroke();

        if (particle.branches) {
          particle.branches.forEach((branch) => {
            if (branch.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(branch[0].x, branch[0].y);
            for (let i = 1; i < branch.length; i += 1) {
              ctx.lineTo(branch[i].x, branch[i].y);
            }
            ctx.stroke();
          });
        }

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(0.8, particle.size * 0.85);
        ctx.beginPath();
        ctx.moveTo(segs[0].x, segs[0].y);
        for (let i = 1; i < segs.length; i += 1) {
          ctx.lineTo(segs[i].x, segs[i].y);
        }
        ctx.stroke();
        ctx.restore();
      } else if (particle.shape === "text") {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${Math.round(particle.size)}px "Segoe UI", Tahoma, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = particle.color;
        ctx.fillText(particle.text, particle.x, particle.y);
        ctx.restore();
      } else if (particle.shape === "confetti") {
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation || 0);
        ctx.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);
        ctx.restore();
      } else if (particle.shape === "coin") {
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation || 0);
        const spin = Math.cos((particle.age || 0) * 11);
        ctx.scale(spin, 1);
        ctx.beginPath();
        ctx.arc(0, 0, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color || "#ffc75a";
        ctx.fill();
        ctx.strokeStyle = "#fff0a0";
        ctx.lineWidth = 1.3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.5, particle.size * 0.65), 0, Math.PI * 2);
        ctx.strokeStyle = "#c89418";
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      } else if (particle.shape === "mist") {
        ctx.save();
        ctx.globalAlpha = alpha * 0.48;
        const grad = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.size);
        grad.addColorStop(0, particle.color || "rgba(220, 250, 255, 0.8)");
        grad.addColorStop(1, "rgba(220, 250, 255, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (particle.shape === "sparkle") {
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation || 0);
        ctx.globalAlpha = alpha;
        const s = particle.size;
        ctx.fillStyle = particle.color || "#ffffff";
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.quadraticCurveTo(0, 0, s, 0);
        ctx.quadraticCurveTo(0, 0, 0, s);
        ctx.quadraticCurveTo(0, 0, -s, 0);
        ctx.quadraticCurveTo(0, 0, 0, -s);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    burst(x, y, options = {}) {
      const {
        count = 24,
        colors = ["#45edff", "#9df8ff"],
        speedMin = 40,
        speedMax = 240,
        angleMin = 0,
        angleMax = Math.PI * 2,
        gravity = 220,
        drag = 0.985,
        lifeMin = 0.35,
        lifeMax = 0.9,
        sizeMin = 1,
        sizeMax = 3,
        shape = "dot",
        rotation = false,
      } = options;
      const amount = Math.max(1, Math.round(count * (this.reduced ? 0.6 : 1)));
      for (let index = 0; index < amount; index += 1) {
        const angle = angleMin + Math.random() * (angleMax - angleMin);
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        this.add({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          gravity,
          drag,
          life: lifeMin + Math.random() * (lifeMax - lifeMin),
          size: sizeMin + Math.random() * (sizeMax - sizeMin),
          color: colors[Math.floor(Math.random() * colors.length)],
          shape,
          rotation: rotation ? Math.random() * Math.PI * 2 : null,
          vr: rotation ? (Math.random() - 0.5) * 12 : 0,
          fadeIn: true,
        });
      }
      this.start();
    }

    ring(x, y, options = {}) {
      const {
        color = "#45edff",
        size = 2,
        grow = 70,
        life = 0.6,
        radius = 4,
      } = options;
      this.add({
        x,
        y,
        vx: 0,
        vy: 0,
        gravity: 0,
        drag: 1,
        life,
        size,
        color,
        shape: "ring",
        radius,
        grow,
      });
      this.start();
    }

    lightning(x1, y1, x2, y2, options = {}) {
      const segments = generateLightningSegments(
        x1,
        y1,
        x2,
        y2,
        options.iterations || 4,
        options.displacement || 24
      );
      const branches = createLightningBranches(segments, options.branches || 2);
      this.add({
        shape: "lightning",
        segments,
        branches,
        color: options.color || "#5ff0c0",
        glowColor: options.glowColor || "#ffffff",
        size: options.size || 2.5,
        life: options.life || 0.22,
      });
      this.start();
    }

    lightningStrike(element, options = {}) {
      const { x, y } = this.centerOf(element);
      const startX = x + (Math.random() - 0.5) * 60;
      const startY = 0;
      this.lightning(startX, startY, x, y, {
        color: options.color || "#5ff0c0",
        glowColor: options.glowColor || "#ffffff",
        size: options.size || 3,
        life: 0.28,
        displacement: 32,
      });
      this.burst(x, y, {
        count: 28,
        colors: ["#5ff0c0", "#c9ffe9", "#ffffff", "#ffc75a"],
        speedMin: 60,
        speedMax: 260,
        gravity: 180,
        drag: 0.96,
        lifeMin: 0.35,
        lifeMax: 0.85,
        sizeMin: 1.5,
        sizeMax: 3.5,
        shape: "spark",
      });
      this.ring(x, y, { color: "#5ff0c0", grow: 110, life: 0.5, size: 3 });
      this.flash("rgba(95, 240, 192, 0.45)", 280);
      this.shakeHeavy();
    }

    floatingText(target, text, color = "#ffc75a", size = 18) {
      const { x, y } = this.centerOf(target);
      this.add({
        shape: "text",
        x,
        y: y - 6,
        vx: (Math.random() - 0.5) * 16,
        vy: -75,
        drag: 0.96,
        gravity: 20,
        life: 0.95,
        text,
        color,
        size,
      });
      this.start();
    }

    flash(color, duration = 320) {
      if (!this.flashEl || this.reduced) return;
      const el = this.flashEl;
      el.style.transition = "none";
      el.style.background = color;
      el.style.opacity = "0.55";
      void el.offsetWidth;
      el.style.transition = `opacity ${duration}ms ease-out`;
      el.style.opacity = "0";
    }

    explosion(element) {
      const { x, y } = this.centerOf(element);
      this.flash("rgba(255, 120, 60, 0.65)", 380);
      this.shakeHeavy();
      this.burst(x, y, {
        count: 54,
        colors: ["#fff4b0", "#ffc75a", "#ff8a3d", "#ff4d5e", "#ffffff"],
        speedMin: 90,
        speedMax: 470,
        gravity: 520,
        drag: 0.982,
        lifeMin: 0.3,
        lifeMax: 1.05,
        sizeMin: 1.2,
        sizeMax: 3.4,
        shape: "spark",
      });
      this.burst(x, y, {
        count: 22,
        colors: ["#ffb45a", "#ff5a4d", "#ffd98a"],
        speedMin: 30,
        speedMax: 260,
        gravity: 300,
        drag: 0.97,
        lifeMin: 0.5,
        lifeMax: 1.4,
        sizeMin: 2,
        sizeMax: 6,
        shape: "dot",
      });
      this.ring(x, y, { color: "#ffcf7a", grow: 150, life: 0.5, size: 4 });
      this.ring(x, y, { color: "#ff556d", grow: 210, life: 0.7, size: 2 });
    }

    ice(elements) {
      const list = Array.isArray(elements) ? elements : [elements];
      const valid = list.filter(Boolean);
      let center = { x: this.width / 2, y: this.height / 2 };
      if (valid.length > 0) {
        let sumX = 0;
        let sumY = 0;
        valid.forEach((element) => {
          const point = this.centerOf(element);
          sumX += point.x;
          sumY += point.y;
        });
        center = { x: sumX / valid.length, y: sumY / valid.length };
      }
      this.flash("rgba(140, 235, 255, 0.65)", 480);
      this.shakeMedium();
      document.body.classList.remove("freeze-flash");
      void document.body.offsetWidth;
      document.body.classList.add("freeze-flash");
      window.setTimeout(() => document.body.classList.remove("freeze-flash"), 620);

      valid.slice(0, 9).forEach((element) => {
        const point = this.centerOf(element);
        this.burst(point.x, point.y, {
          count: 14,
          colors: ["#e4fdff", "#9df8ff", "#58b8ff", "#dff7ff"],
          speedMin: 40,
          speedMax: 180,
          gravity: 260,
          drag: 0.97,
          lifeMin: 0.45,
          lifeMax: 0.95,
          sizeMin: 2,
          sizeMax: 6,
          shape: "shard",
          rotation: true,
        });
      });
      this.ring(center.x, center.y, { color: "#9df8ff", grow: 180, life: 0.65, size: 4 });
      this.ring(center.x, center.y, { color: "#58b8ff", grow: 110, life: 0.5, size: 2 });
    }

    coinBurst(target, count = 10) {
      const { x, y } = this.centerOf(target);
      const amount = Math.max(4, Math.round(count * (this.reduced ? 0.6 : 1)));
      for (let i = 0; i < amount; i += 1) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
        const speed = 120 + Math.random() * 260;
        this.add({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          gravity: 460,
          drag: 0.985,
          life: 0.75 + Math.random() * 0.45,
          size: 4 + Math.random() * 3,
          color: Math.random() < 0.25 ? "#ffffff" : "#ffc75a",
          shape: "coin",
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 14,
          fadeIn: false,
        });
      }
      this.start();
    }

    radarWave(element) {
      const { x, y } = this.centerOf(element);
      this.flash("rgba(0, 180, 255, 0.25)", 300);
      this.ring(x, y, { color: "#45edff", grow: 220, life: 0.75, size: 3.5 });
      this.ring(x, y, { color: "#9df8ff", grow: 130, life: 0.5, size: 2 });
      this.burst(x, y, {
        count: 22,
        colors: ["#45edff", "#9df8ff", "#ffffff", "#00ffff"],
        speedMin: 40,
        speedMax: 180,
        gravity: 0,
        drag: 0.96,
        lifeMin: 0.3,
        lifeMax: 0.65,
        sizeMin: 1.5,
        sizeMax: 3.5,
        shape: "sparkle",
      });
      this.shakeLight();
      this.energyArcs(element, "#45edff", 3);
    }

    energyArcs(element, color, count = 4) {
      if (this.reduced) return;
      const { x, y } = this.centerOf(element);
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
        const distance = 45 + Math.random() * 45;
        this.lightning(x, y, x + Math.cos(angle) * distance, y + Math.sin(angle) * distance,
          { color, size: 2, life: 0.24, displacement: 12, branches: 1 });
      }
    }

    frostBurst(element) {
      const { x, y } = this.centerOf(element);
      this.flash("rgba(140, 235, 255, 0.4)", 320);
      this.shakeLight();

      // Cold vapor mist rising
      for (let i = 0; i < 7; i += 1) {
        this.add({
          x: x + (Math.random() - 0.5) * 20,
          y: y + (Math.random() - 0.5) * 16,
          vx: (Math.random() - 0.5) * 35,
          vy: -35 - Math.random() * 55,
          gravity: -20,
          drag: 0.96,
          life: 0.6 + Math.random() * 0.4,
          size: 14 + Math.random() * 16,
          color: "rgba(180, 240, 255, 0.8)",
          shape: "mist",
        });
      }

      this.burst(x, y, {
        count: 18,
        colors: ["#ffffff", "#e4fdff", "#9df8ff", "#58b8ff"],
        speedMin: 50,
        speedMax: 200,
        gravity: 240,
        drag: 0.97,
        lifeMin: 0.4,
        lifeMax: 0.85,
        sizeMin: 2,
        sizeMax: 5,
        shape: "shard",
        rotation: true,
      });

      this.ring(x, y, { color: "#9df8ff", grow: 95, life: 0.5, size: 3 });
      this.energyArcs(element, "#9df8ff", 3);
      this.start();
    }

    shieldActivate(element) {
      const { x, y } = this.centerOf(element);
      this.flash("rgba(95, 240, 192, 0.35)", 340);
      this.shakeMedium();
      this.ring(x, y, { color: "#5ff0c0", grow: 180, life: 0.65, size: 4 });
      this.ring(x, y, { color: "#ffffff", grow: 100, life: 0.45, size: 2.5 });
      this.burst(x, y, {
        count: 32,
        colors: ["#5ff0c0", "#c9ffe9", "#ffffff", "#45edff"],
        speedMin: 60,
        speedMax: 260,
        gravity: 60,
        drag: 0.96,
        lifeMin: 0.4,
        lifeMax: 0.85,
        sizeMin: 1.5,
        sizeMax: 3.5,
        shape: "spark",
      });
      this.floatingText({ x, y: y - 10 }, "ESCUDO ACTIVADO", "#5ff0c0", 20);
      this.energyArcs(element, "#5ff0c0", 5);
    }

    shieldPulse(element) {
      const { x, y } = this.centerOf(element);
      this.ring(x, y, { color: "#5ff0c0", grow: 45, life: 0.35, size: 2 });
      this.burst(x, y, {
        count: 6,
        colors: ["#5ff0c0", "#ffffff"],
        speedMin: 20,
        speedMax: 70,
        gravity: 0,
        drag: 0.95,
        lifeMin: 0.2,
        lifeMax: 0.4,
        sizeMin: 1,
        sizeMax: 2,
        shape: "spark",
      });
    }

    defuseCut(element, success) {
      const { x, y } = this.centerOf(element);
      if (success) {
        this.energyArcs(element, "#ffc75a", 4);
        this.flash("rgba(95, 240, 192, 0.4)", 260);
        this.shakeLight();
        this.ring(x, y, { color: "#5ff0c0", grow: 110, life: 0.55, size: 3.5 });
        this.burst(x, y, {
          count: 32,
          colors: ["#5ff0c0", "#c9ffe9", "#ffc75a", "#ffffff"],
          speedMin: 80,
          speedMax: 300,
          gravity: 200,
          drag: 0.965,
          lifeMin: 0.35,
          lifeMax: 0.9,
          sizeMin: 1.5,
          sizeMax: 3.5,
          shape: "spark",
        });
        this.coinBurst({ x, y }, 10);
        this.floatingText({ x, y }, "+10 MONEDAS (DESARME)", "#ffc75a", 19);
      } else {
        this.explosion(element);
      }
    }

    cascadeSparkle(elements) {
      if (!elements || elements.length === 0) return;
      const count = Math.min(elements.length, 18);
      const step = Math.floor(elements.length / count);
      for (let i = 0; i < count; i += 1) {
        const el = elements[i * step];
        if (!el) continue;
        const { x, y } = this.centerOf(el);
        window.setTimeout(() => {
          this.burst(x, y, {
            count: 3,
            colors: ["#ffffff", "#9df8ff", "#5ff0c0"],
            speedMin: 15,
            speedMax: 60,
            gravity: 10,
            drag: 0.95,
            lifeMin: 0.3,
            lifeMax: 0.55,
            sizeMin: 1.2,
            sizeMax: 2.8,
            shape: "sparkle",
          });
        }, i * 22);
      }
    }

    iceShatter(element, isMine = false) {
      const { x, y } = this.centerOf(element);
      this.shakeMedium();

      // Cold vapor mist rising from smashed ice
      for (let i = 0; i < 6; i += 1) {
        this.add({
          x: x + (Math.random() - 0.5) * 16,
          y: y + (Math.random() - 0.5) * 12,
          vx: (Math.random() - 0.5) * 45,
          vy: -40 - Math.random() * 60,
          gravity: -15,
          drag: 0.96,
          life: 0.55 + Math.random() * 0.45,
          size: 16 + Math.random() * 18,
          color: "rgba(200, 245, 255, 0.75)",
          shape: "mist",
        });
      }

      this.burst(x, y, {
        count: 42,
        colors: ["#ffffff", "#e4fdff", "#9df8ff", "#58b8ff", "#388eff"],
        speedMin: 90,
        speedMax: 380,
        gravity: 440,
        drag: 0.975,
        lifeMin: 0.45,
        lifeMax: 1.15,
        sizeMin: 2.5,
        sizeMax: 6.5,
        shape: "shard",
        rotation: true,
      });

      this.ring(x, y, { color: "#9df8ff", grow: 140, life: 0.55, size: 3.5 });

      for (let i = 0; i < 4; i += 1) {
        const angle = (i * Math.PI) / 2 + (Math.random() - 0.5) * 0.4;
        const len = 35 + Math.random() * 30;
        this.lightning(x, y, x + Math.cos(angle) * len, y + Math.sin(angle) * len, {
          color: "#9df8ff",
          glowColor: "#ffffff",
          size: 1.8,
          life: 0.18,
          branches: 1,
          displacement: 12,
        });
      }

      if (isMine) {
        this.flash("rgba(255, 210, 100, 0.45)", 280);
        this.burst(x, y, {
          count: 28,
          colors: ["#ffc75a", "#ffd98a", "#ff9b45", "#ffffff"],
          speedMin: 70,
          speedMax: 300,
          gravity: 280,
          drag: 0.97,
          lifeMin: 0.35,
          lifeMax: 0.85,
          sizeMin: 1.5,
          sizeMax: 3.5,
          shape: "spark",
        });
        this.ring(x, y, { color: "#ffc75a", grow: 110, life: 0.5, size: 3 });
        this.coinBurst({ x, y }, 12);
        this.floatingText({ x, y }, "+10 MONEDAS (MINA ROTA)", "#ffc75a", 20);
      } else {
        this.floatingText({ x, y }, "HIELO ROTO", "#9df8ff", 17);
      }
    }

    shieldZap(element) {
      const { x, y } = this.centerOf(element);
      this.lightningStrike(element, { color: "#5ff0c0", glowColor: "#ffffff", size: 3.6 });
      this.coinBurst(element, 15);
      this.floatingText(element, "+15 MONEDAS (RAYO DIVINO)", "#5ff0c0", 21);
    }

    shield(element) {
      const { x, y } = this.centerOf(element);
      this.shakeLight();
      this.ring(x, y, { color: "#5ff0c0", grow: 80, life: 0.55, size: 3 });
      this.burst(x, y, {
        count: 22,
        colors: ["#5ff0c0", "#c9ffe9", "#45edff", "#ffffff"],
        speedMin: 50,
        speedMax: 220,
        gravity: 30,
        drag: 0.95,
        lifeMin: 0.35,
        lifeMax: 0.8,
        sizeMin: 1,
        sizeMax: 3,
        shape: "spark",
      });
    }

    defuse(element) {
      const { x, y } = this.centerOf(element);
      this.shakeMedium();
      this.burst(x, y, {
        count: 28,
        colors: ["#5ff0c0", "#c9ffe9", "#ffc75a", "#ffffff"],
        speedMin: 50,
        speedMax: 260,
        gravity: 240,
        drag: 0.97,
        lifeMin: 0.35,
        lifeMax: 0.9,
        sizeMin: 1,
        sizeMax: 3,
        shape: "spark",
      });
      this.ring(x, y, { color: "#5ff0c0", grow: 100, life: 0.55, size: 3 });
      this.floatingText({ x, y }, "+10 MONEDAS", "#ffc75a", 19);
    }

    radarPing(element) {
      const { x, y } = this.centerOf(element);
      this.shakeLight();
      this.ring(x, y, { color: "#45edff", grow: 85, life: 0.45, size: 2.5 });
      this.burst(x, y, {
        count: 10,
        colors: ["#45edff", "#9df8ff", "#ffffff"],
        speedMin: 20,
        speedMax: 90,
        gravity: 0,
        drag: 0.96,
        lifeMin: 0.25,
        lifeMax: 0.5,
        sizeMin: 1,
        sizeMax: 2.2,
        shape: "dot",
      });
    }

    win() {
      const colors = ["#45edff", "#5ff0c0", "#ffc75a", "#ff4d8d", "#a879ff", "#ffffff"];
      const total = this.reduced ? 70 : 170;
      this.shakeMedium();

      for (let index = 0; index < total; index += 1) {
        this.add({
          x: Math.random() * this.width,
          y: -16 - Math.random() * 220,
          vx: (Math.random() - 0.5) * 90,
          vy: 110 + Math.random() * 240,
          gravity: 90,
          drag: 0.998,
          life: 2.8 + Math.random() * 2.2,
          size: 4 + Math.random() * 7,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape: "confetti",
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 9,
          fadeIn: false,
        });
      }

      this.burst(this.width / 2, this.height * 0.36, {
        count: 40,
        colors,
        speedMin: 120,
        speedMax: 420,
        gravity: 260,
        drag: 0.985,
        lifeMin: 0.7,
        lifeMax: 1.6,
        sizeMin: 1.5,
        sizeMax: 4,
        shape: "spark",
      });
      this.ring(this.width / 2, this.height * 0.36, { color: "#5ff0c0", grow: 220, life: 0.8, size: 4 });
      this.start();
    }

    zoneBurst(element) {
      const { x, y } = this.centerOf(element);
      this.burst(x, y, {
        count: 14,
        colors: ["#45edff", "#9df8ff"],
        speedMin: 20,
        speedMax: 90,
        gravity: 0,
        drag: 0.96,
        lifeMin: 0.25,
        lifeMax: 0.55,
        sizeMin: 1,
        sizeMax: 2.2,
        shape: "dot",
      });
    }
  }

  BP.FX = FX;
})();

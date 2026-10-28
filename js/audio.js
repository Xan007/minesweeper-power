/* ============================================================
   BUSCAMINAS POWER · audio sintetizado (sin assets externos)
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});

  class Sound {
    constructor(store) {
      this.store = store;
      this.enabled = Boolean(store && store.settings ? store.settings.sound : true);
      this.ctx = null;
      this.master = null;
      this.noiseBuffer = null;
    }

    ensure() {
      if (!this.enabled) return null;
      if (this.ctx) {
        if (this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
        return this.ctx;
      }
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      try {
        this.ctx = new AudioContextClass();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.52;
        this.master.connect(this.ctx.destination);
        return this.ctx;
      } catch (_error) {
        this.ctx = null;
        return null;
      }
    }

    unlock() {
      const ctx = this.ensure();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      if (this.store) this.store.updateSettings({ sound: this.enabled });
      if (this.enabled) {
        this.unlock();
        this.play("click");
      }
    }

    toggle() {
      this.setEnabled(!this.enabled);
      return this.enabled;
    }

    getNoiseBuffer(ctx) {
      if (this.noiseBuffer) return this.noiseBuffer;
      const duration = 1.2;
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) {
        data[index] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buffer;
      return buffer;
    }

    tone(freq, duration, options = {}) {
      const ctx = this.ensure();
      if (!ctx) return;
      const {
        type = "sine",
        volume = 0.05,
        when = 0,
        slideTo = null,
        attack = 0.006,
      } = options;
      const start = ctx.currentTime + when;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(20, freq), start);
      if (slideTo) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    }

    noise(duration, options = {}) {
      const ctx = this.ensure();
      if (!ctx) return;
      const {
        volume = 0.08,
        when = 0,
        type = "lowpass",
        frequency = 1000,
        frequencyEnd = null,
        q = 0.8,
      } = options;
      const start = ctx.currentTime + when;
      const source = ctx.createBufferSource();
      source.buffer = this.getNoiseBuffer(ctx);
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.setValueAtTime(frequency, start);
      filter.Q.value = q;
      if (frequencyEnd) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(40, frequencyEnd), start + duration);
      }
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start(start);
      source.stop(start + duration + 0.03);
    }

    play(name) {
      if (!this.enabled) return;
      if (!this.ensure()) return;
      switch (name) {
        case "click":
          this.tone(190, 0.035, { type: "square", volume: 0.022 });
          break;
        case "hover":
          this.tone(900, 0.018, { type: "sine", volume: 0.009 });
          break;
        case "reveal":
          this.tone(520, 0.055, { type: "sine", volume: 0.03 });
          this.tone(760, 0.045, { type: "sine", volume: 0.018, when: 0.025 });
          break;
        case "revealBig":
          this.tone(420, 0.07, { type: "sine", volume: 0.035 });
          this.tone(640, 0.06, { type: "sine", volume: 0.024, when: 0.04 });
          this.tone(860, 0.05, { type: "sine", volume: 0.016, when: 0.08 });
          break;
        case "flag":
          this.tone(700, 0.04, { type: "triangle", volume: 0.04 });
          this.tone(1050, 0.035, { type: "sine", volume: 0.02, when: 0.03 });
          break;
        case "unflag":
          this.tone(420, 0.04, { type: "triangle", volume: 0.025 });
          break;
        case "power":
          this.tone(280, 0.22, { type: "sine", volume: 0.035, slideTo: 820 });
          this.noise(0.18, { type: "highpass", frequency: 900, volume: 0.014 });
          break;
        case "coin":
          this.tone(987.77, 0.09, { type: "sine", volume: 0.045 });
          this.tone(1318.51, 0.14, { type: "sine", volume: 0.04, when: 0.055 });
          break;
        case "sparkle":
          this.tone(1480, 0.06, { type: "sine", volume: 0.02 });
          this.tone(1975, 0.07, { type: "sine", volume: 0.018, when: 0.035 });
          break;
        case "xrayStart":
          this.tone(600, 0.12, { type: "sine", volume: 0.03, slideTo: 1400 });
          this.tone(1800, 0.08, { type: "sine", volume: 0.016, when: 0.08 });
          this.noise(0.25, { type: "highpass", frequency: 2000, volume: 0.012 });
          break;
        case "radarWave":
          this.tone(550, 0.16, { type: "sine", volume: 0.03, slideTo: 1100 });
          this.noise(0.18, { type: "bandpass", frequency: 1600, volume: 0.02 });
          break;
        case "shieldActivate":
          this.tone(330, 0.32, { type: "triangle", volume: 0.04, slideTo: 660 });
          this.tone(495, 0.35, { type: "sine", volume: 0.03, when: 0.03 });
          this.tone(660, 0.38, { type: "sine", volume: 0.025, when: 0.06 });
          this.noise(0.2, { type: "highpass", frequency: 1200, volume: 0.015 });
          break;
        case "freezeNova":
          this.noise(0.35, { type: "highpass", frequency: 2800, volume: 0.045 });
          this.tone(1400, 0.28, { type: "sine", volume: 0.028, slideTo: 450 });
          this.tone(2100, 0.18, { type: "triangle", volume: 0.018, slideTo: 800, when: 0.03 });
          break;
        case "xrayEnd":
          this.tone(900, 0.12, { type: "sine", volume: 0.02, slideTo: 320 });
          break;
        case "xrayPing":
          this.tone(1320, 0.045, { type: "sine", volume: 0.022 });
          this.tone(1760, 0.04, { type: "sine", volume: 0.012, when: 0.03 });
          break;
        case "shield":
          this.tone(430, 0.28, { type: "sine", volume: 0.035 });
          this.tone(645, 0.28, { type: "sine", volume: 0.026, when: 0.04 });
          this.tone(860, 0.3, { type: "sine", volume: 0.018, when: 0.08 });
          this.noise(0.22, { type: "highpass", frequency: 1400, volume: 0.012, when: 0.02 });
          break;
        case "absorb":
          this.tone(760, 0.22, { type: "sawtooth", volume: 0.03, slideTo: 150 });
          this.noise(0.25, { type: "lowpass", frequency: 1800, frequencyEnd: 200, volume: 0.028 });
          break;
        case "shieldEnd":
          this.tone(520, 0.16, { type: "triangle", volume: 0.022, slideTo: 260 });
          break;
        case "freeze":
          this.noise(0.45, { type: "highpass", frequency: 2400, volume: 0.04 });
          this.tone(1650, 0.38, { type: "sine", volume: 0.031, slideTo: 520 });
          this.tone(2200, 0.24, { type: "sine", volume: 0.016, slideTo: 900, when: 0.05 });
          this.tone(120, 0.32, { type: "sine", volume: 0.028, slideTo: 60, when: 0.02 });
          break;
        case "iceShatter":
          this.noise(0.16, { type: "highpass", frequency: 2600, volume: 0.03 });
          this.tone(2400, 0.1, { type: "triangle", volume: 0.015, slideTo: 1200 });
          break;
        case "hammer":
          this.tone(150, 0.22, { type: "triangle", volume: 0.07, slideTo: 55 });
          this.noise(0.12, { type: "lowpass", frequency: 900, frequencyEnd: 180, volume: 0.06 });
          this.tone(1900, 0.08, { type: "square", volume: 0.012, when: 0.01 });
          break;
        case "thaw":
          this.tone(820, 0.35, { type: "sine", volume: 0.02, slideTo: 240 });
          this.tone(520, 0.24, { type: "sine", volume: 0.012, slideTo: 180, when: 0.08 });
          this.noise(0.2, { type: "highpass", frequency: 1600, frequencyEnd: 500, volume: 0.008 });
          break;
        case "thunder":
          this.noise(0.48, { type: "lowpass", frequency: 1900, frequencyEnd: 70, volume: 0.13 });
          this.tone(115, 0.42, { type: "sawtooth", volume: 0.08, slideTo: 30 });
          this.tone(70, 0.55, { type: "sine", volume: 0.09, slideTo: 24, when: 0.04 });
          break;
        case "explode":
          this.noise(0.68, { type: "lowpass", frequency: 2200, frequencyEnd: 90, volume: 0.14 });
          this.noise(0.24, { type: "highpass", frequency: 1200, volume: 0.06 });
          this.tone(95, 0.62, { type: "sine", volume: 0.12, slideTo: 26 });
          this.tone(180, 0.18, { type: "sawtooth", volume: 0.05, slideTo: 50 });
          break;
        case "cut":
          this.tone(1500, 0.045, { type: "square", volume: 0.028 });
          this.noise(0.035, { type: "highpass", frequency: 2500, volume: 0.02 });
          break;
        case "defuseSuccess":
          [660, 880, 1100, 1320].forEach((freq, index) => {
            this.tone(freq, 0.16, { type: "sine", volume: 0.032, when: index * 0.075 });
          });
          this.noise(0.18, { type: "highpass", frequency: 3000, volume: 0.01 });
          break;
        case "defuseFail":
          this.tone(240, 0.42, { type: "sawtooth", volume: 0.055, slideTo: 70 });
          this.noise(0.4, { type: "lowpass", frequency: 900, frequencyEnd: 100, volume: 0.06 });
          break;
        case "win":
          [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) => {
            this.tone(freq, 0.36, { type: "triangle", volume: 0.04, when: index * 0.13 });
          });
          this.tone(523.25, 0.8, { type: "sine", volume: 0.02, when: 0.5 });
          this.tone(659.25, 0.8, { type: "sine", volume: 0.016, when: 0.5 });
          this.tone(783.99, 0.8, { type: "sine", volume: 0.014, when: 0.5 });
          break;
        case "record":
          [1046, 1318, 1568, 2093].forEach((freq, index) => {
            this.tone(freq, 0.22, { type: "sine", volume: 0.025, when: 0.15 + index * 0.08 });
          });
          break;
        case "lose":
          [220, 185, 146].forEach((freq, index) => {
            this.tone(freq, 0.3, { type: "triangle", volume: 0.035, when: index * 0.14 });
          });
          break;
        default:
          break;
      }
    }
  }

  BP.Sound = Sound;
})();

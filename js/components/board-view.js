/* ============================================================
   BUSCAMINAS POWER · Componente de tablero, HUD y poderes
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});
  const U = BP.Utils;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const NUMBER_COLORS = {
    1: "#0000ff",
    2: "#008000",
    3: "#ff0000",
    4: "#000080",
    5: "#800000",
    6: "#008080",
    7: "#000000",
    8: "#808080",
  };

  class BoardViewComponent {
    constructor({ ui, store, sound, fx }) {
      this.ui = ui;
      this.store = store;
      this.sound = sound;
      this.fx = fx;

      this.cellElements = new Map();
      this.touchTimer = null;
      this.touchStart = null;
      this.suppressClick = false;
      this.lastTouchFlagAt = 0;
      this.chordCenter = null;
      this.powerFlashTimers = {};
      this.lastPing = 0;
      this.peekKey = null;
      this.peekEl = null;

      this.xrayActive = false;
      this.xrayRaf = null;
      this.xrayEndsAt = 0;
      this.xrayDuration = 5000;
      this.xrayLastLabel = "";

      // DOM Elements
      this.boardViewport = $("#boardViewport");
      this.boardFrame = $("#boardFrame");
      this.boardEl = $("#board");
      this.boardWrap = $("#boardWrap");
      this.boardStartHint = $("#boardStartHint");

      this.resetBtn = $("#resetBtn");
      this.faceIcon = $("#faceIcon");
      this.mineHundreds = $("#mineHundreds");
      this.mineTens = $("#mineTens");
      this.mineOnes = $("#mineOnes");
      this.timerMinutes = $("#timerMinutes");
      this.timerSeconds = $("#timerSeconds");
      this.timerMillis = $("#timerMillis");
      this.statusDot = $("#statusDot");
      this.statusText = $("#statusText");
      this.shieldHud = $("#shieldHud");
      this.shieldPips = $("#shieldPips");
      this.xrayCursor = $("#xrayCursor");
      this.xrayCursorLabel = $("#xrayCursorLabel");

      this.cachePowers();
      this.bindEvents();
    }

    get game() {
      return this.ui.game;
    }

    cachePowers() {
      this.powerCards = {};
      this.powerStates = {};
      this.powerPips = {};
      this.powerProgress = {};
      $$(".power-card").forEach((card) => {
        const id = card.dataset.power;
        this.powerCards[id] = card;
        this.powerStates[id] = card.querySelector(`[data-state="${id}"]`);
        this.powerPips[id] = card.querySelector(`[data-pips="${id}"]`);
        this.powerProgress[id] = card.querySelector(`[data-progress="${id}"]`);
      });
    }

    bindEvents() {
      if (this.resetBtn) {
        this.resetBtn.addEventListener("click", () => {
          this.sound.play("click");
          if (this.game) this.game.newGame();
        });
      }

      $$(".power-card").forEach((card) => {
        card.addEventListener("click", () => {
          const id = card.dataset.power;
          if (this.game) this.game.usePower(id);
        });
      });

      this.bindBoardEvents();
      this.bindKeyboard();
    }

    bindBoardEvents() {
      if (!this.boardEl) return;

      this.boardEl.addEventListener("contextmenu", (event) => {
        event.preventDefault();
      });

      this.boardEl.addEventListener("pointerdown", (event) => {
        const cellEl = event.target.closest(".cell");
        if (!cellEl || !this.game) return;
        const x = Number(cellEl.dataset.x);
        const y = Number(cellEl.dataset.y);

        this.setFace("focus");

        if (event.pointerType === "touch") {
          this.touchStart = { x: event.clientX, y: event.clientY, cellX: x, cellY: y };
          this.cancelTouchTimer();
          this.touchTimer = window.setTimeout(() => {
            this.suppressClick = true;
            this.lastTouchFlagAt = performance.now();
            this.game.flag(x, y);
            if (navigator.vibrate) navigator.vibrate(35);
          }, 450);
          return;
        }

        if (event.button === 2) {
          event.preventDefault();
          this.game.flag(x, y);
        } else if (event.button === 1) {
          event.preventDefault();
          this.game.chord(x, y);
        } else if (event.button === 0) {
          this.startChordPreview(x, y);
        }
      });

      this.boardEl.addEventListener("pointerup", (event) => {
        this.cancelTouchTimer();
        this.clearChordPreview();

        if (this.game && this.game.status === "playing") {
          this.setFace("smile");
        }

        const cellEl = event.target.closest(".cell");
        if (!cellEl || !this.game) return;
        const x = Number(cellEl.dataset.x);
        const y = Number(cellEl.dataset.y);

        if (event.pointerType === "touch") {
          if (this.suppressClick || performance.now() - this.lastTouchFlagAt < 300) {
            this.suppressClick = false;
            return;
          }
        }

        if (event.button === 0) {
          const power = this.game.powers.freeze;
          if (power && power.hammerMode) {
            this.game.hammerCell(x, y);
          } else if (power && power.targeting) {
            this.game.freezeCell(x, y);
          } else {
            this.game.reveal(x, y);
          }
        }
      });

      this.boardEl.addEventListener("pointermove", (event) => {
        if (this.touchStart && event.pointerType === "touch") {
          const dx = event.clientX - this.touchStart.x;
          const dy = event.clientY - this.touchStart.y;
          if (Math.hypot(dx, dy) > 10) this.cancelTouchTimer();
        }

        if (this.xrayActive) this.handleXrayPointerMove(event);

        if (this.game && this.game.powers.freeze) {
          const cellEl = event.target.closest(".cell");
          if (cellEl) {
            const x = Number(cellEl.dataset.x);
            const y = Number(cellEl.dataset.y);
            if (this.game.powers.freeze.hammerMode) {
              this.setHammerHover(x, y);
            } else if (this.game.powers.freeze.targeting) {
              this.setFreezeArea(x, y, 0);
            }
          }
        }
      });

      this.boardEl.addEventListener("pointerleave", () => {
        this.cancelTouchTimer();
        this.clearChordPreview();
        this.clearFreezeArea();
        this.clearHammerHover();
        this.clearPeek();
        if (this.xrayActive && this.xrayCursor) this.xrayCursor.hidden = true;
      });

      this.boardEl.addEventListener("pointerenter", () => {
        if (this.xrayActive && this.xrayCursor) this.xrayCursor.hidden = false;
      });

      this.boardEl.addEventListener("dblclick", (event) => {
        const cellEl = event.target.closest(".cell");
        if (!cellEl || !this.game) return;
        this.game.chord(Number(cellEl.dataset.x), Number(cellEl.dataset.y));
      });
    }

    cancelTouchTimer() {
      if (this.touchTimer) window.clearTimeout(this.touchTimer);
      this.touchTimer = null;
    }

    startChordPreview(x, y) {
      if (!this.game || !this.game.board) return;
      const cell = this.game.board.getCell(x, y);
      if (!cell || !cell.revealed || cell.adjacent <= 0) return;
      this.chordCenter = { x, y };
      this.game.board.neighbors(x, y).forEach((n) => {
        if (!n.revealed && !n.flagged) {
          const el = this.getCellElement(n.x, n.y);
          if (el) el.classList.add("is-chord-preview");
        }
      });
    }

    clearChordPreview() {
      if (!this.chordCenter) return;
      $$(".is-chord-preview", this.boardEl).forEach((el) => el.classList.remove("is-chord-preview"));
      this.chordCenter = null;
    }

    bindKeyboard() {
      document.addEventListener("keydown", (event) => {
        if (event.target.matches("input, textarea, select")) return;
        if (this.ui.activeModal) return;

        const key = event.key.toUpperCase();
        if (key === "1") this.game.usePower("xray");
        else if (key === "2") this.game.usePower("defuse");
        else if (key === "3") this.game.usePower("immortal");
        else if (key === "4" || key === "H") this.game.usePower("freeze");
        else if (key === "F2") {
          event.preventDefault();
          this.game.newGame();
        }
      });
    }

    buildBoard(board) {
      if (!this.boardEl) return;
      this.cellElements.clear();
      this.clearChordPreview();
      this.clearFreezeArea();
      this.clearHammerHover();
      this.clearPeek();

      this.boardEl.style.setProperty("--cols", String(board.width));
      this.boardEl.style.setProperty("--rows", String(board.height));
      this.boardEl.innerHTML = "";

      const frag = document.createDocumentFragment();
      for (let y = 0; y < board.height; y += 1) {
        for (let x = 0; x < board.width; x += 1) {
          const el = document.createElement("button");
          el.type = "button";
          el.className = "cell";
          el.dataset.x = String(x);
          el.dataset.y = String(y);
          el.setAttribute("role", "gridcell");
          el.setAttribute("aria-label", `Fila ${y + 1}, columna ${x + 1}, oculta`);
          this.cellElements.set(`${x},${y}`, el);
          frag.appendChild(el);
        }
      }
      this.boardEl.appendChild(frag);
      this.fitCellSize();
    }

    fitCellSize() {
      if (!this.boardEl || !this.boardViewport) return;
      const cols = Number(this.boardEl.style.getPropertyValue("--cols")) || 9;
      const rows = Number(this.boardEl.style.getPropertyValue("--rows")) || 9;
      const viewW = Math.max(260, this.boardViewport.clientWidth - 20);
      const viewH = Math.max(220, this.boardViewport.clientHeight - 20);

      const maxCell = cols > 20 ? 28 : (cols > 12 ? 32 : 36);
      const minCell = 18;
      const fitCell = Math.floor(Math.min(viewW / cols, viewH / rows));
      const finalCell = U.clamp(fitCell, minCell, maxCell);

      this.boardEl.style.setProperty("--cell", `${finalCell}px`);
    }

    getCellElement(x, y) {
      return this.cellElements.get(`${x},${y}`) || null;
    }

    updateCell(cell) {
      const el = this.getCellElement(cell.x, cell.y);
      if (!el) return;

      let cls = "cell";
      let inner = "";

      if (cell.revealed) {
        cls += " is-revealed";
        if (cell.mine) {
          cls += " is-mine-revealed";
          if (cell.exploded) cls += " is-exploded";
          if (cell.defused) cls += " is-defused";
          inner = U.icon("i-bomb") + (cell.defused ? '<span class="cell-defused-tag">OK</span>' : "");
        } else if (cell.adjacent > 0) {
          cls += " is-number";
          el.dataset.n = String(cell.adjacent);
          inner = `<span class="num">${cell.adjacent}</span>`;
        }
      } else if (cell.flagged) {
        cls += " is-flagged";
        if (cell.wrongFlag) cls += " is-wrong-flag";
        inner = U.icon("i-flag");
      }

      if (cell.frozen) {
        cls += " is-frozen";
        inner += `<span class="frozen-glyph">${U.icon("i-snow")}</span><span class="freeze-meter"><i style="transform: scaleX(1)"></i></span>`;
      }

      el.className = cls;
      el.innerHTML = inner;
    }

    revealCells(cells) {
      if (!cells) return;
      cells.forEach((cell) => this.updateCell(cell));
    }

    updateAllCells() {
      if (!this.game || !this.game.board) return;
      this.game.board.forEach((cell) => this.updateCell(cell));
    }

    animateFreezeCell(cell) {
      const el = this.getCellElement(cell.x, cell.y);
      if (!el) return;
      el.classList.add("is-icing");
      window.setTimeout(() => {
        el.classList.remove("is-icing");
        this.updateCell(cell);
      }, 120);
    }

    updateFrozenThaw(cell, ratio) {
      const el = this.getCellElement(cell.x, cell.y);
      if (!el || !cell.frozen) return;
      const meter = el.querySelector(".freeze-meter i");
      if (meter) meter.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
      el.classList.toggle("is-thawing", ratio < 0.35);
    }

    completeFreeze(cells) {
      if (!cells) return;
      cells.forEach((cell) => {
        const el = this.getCellElement(cell.x, cell.y);
        if (el) {
          el.classList.remove("is-frozen", "is-thawing");
          const meter = el.querySelector(".freeze-meter");
          if (meter) meter.remove();
          const glyph = el.querySelector(".frozen-glyph");
          if (glyph) glyph.remove();
          this.updateCell(cell);
        }
      });
    }

    updateHud(game) {
      if (!game || !game.board) return;
      const minesLeft = game.board.mineCount - game.board.flagsPlaced - game.board.minesDefused;
      const safe = Math.max(-99, Math.min(999, minesLeft));
      const str = safe < 0 ? `-${String(Math.abs(safe)).padStart(2, "0")}` : String(safe).padStart(3, "0");

      if (this.mineHundreds) this.mineHundreds.textContent = str[0];
      if (this.mineTens) this.mineTens.textContent = str[1];
      if (this.mineOnes) this.mineOnes.textContent = str[2];

      if (game.powers.immortal.active && game.powers.immortal.clicks > 0) {
        this.setShield(game.powers.immortal.clicks);
      } else {
        this.hideShield();
      }
    }

    updateTimer(ms) {
      const totalSec = Math.min(999, Math.floor(ms / 1000));
      const str = String(totalSec).padStart(3, "0");
      if (this.timerMinutes) this.timerMinutes.textContent = str[0];
      if (this.timerSeconds) this.timerSeconds.textContent = str[1];
      if (this.timerMillis) this.timerMillis.textContent = str[2];
    }

    setStatus(text, tone = "normal") {
      if (!this.statusText) return;
      this.statusText.textContent = text;
      if (this.statusDot) {
        this.statusDot.className = `status-dot ${tone === "danger" ? "status-dot--danger" : (tone === "warn" ? "status-dot--warn" : "")}`;
      }
    }

    setFace(state) {
      if (!this.faceIcon) return;
      const map = { smile: "#face-smile", dead: "#face-dead", win: "#face-win", focus: "#face-focus" };
      this.faceIcon.querySelector("use").setAttribute("href", map[state] || map.smile);
    }

    showStartHint(show) {
      if (this.boardStartHint) this.boardStartHint.classList.toggle("is-hidden", !show);
    }

    setShield(clicks) {
      if (!clicks || clicks <= 0) {
        this.hideShield();
        return;
      }
      if (this.shieldHud) this.shieldHud.hidden = false;
      if (this.boardFrame) this.boardFrame.classList.add("has-shield-active");
      if (this.shieldPips) {
        let pips = "";
        for (let i = 0; i < 5; i += 1) {
          pips += `<i class="${i >= clicks ? "is-spent" : ""}"></i>`;
        }
        this.shieldPips.innerHTML = pips;
      }
    }

    hideShield() {
      if (this.shieldHud) this.shieldHud.hidden = true;
      if (this.shieldPips) this.shieldPips.innerHTML = "";
      if (this.boardFrame) this.boardFrame.classList.remove("has-shield-active");
    }

    updatePowers(game) {
      if (!game) return;
      Object.keys(BP.POWER_DEFS).forEach((id) => {
        const power = game.powers[id];
        const card = this.powerCards[id];
        if (!power || !card) return;

        const frozenCount = id === "freeze" && power.frozen ? power.frozen.size : 0;
        const active = (id === "xray" && power.active) || (id === "immortal" && power.active) || (id === "freeze" && (power.targeting || power.hammerMode || frozenCount > 0));

        card.classList.toggle("is-active", Boolean(active));
        card.classList.toggle("is-targeting", id === "freeze" && power.targeting);
        card.classList.toggle("is-hammer", id === "freeze" && power.hammerMode);
        card.classList.toggle("is-empty", power.charges <= 0 && !active);

        const stateEl = this.powerStates[id];
        if (stateEl) {
          if (id === "xray" && power.active) {
            stateEl.textContent = "ESCANEANDO";
          } else if (id === "immortal" && power.active) {
            stateEl.textContent = `${power.clicks} CLICS`;
          } else if (id === "freeze") {
            if (power.hammerMode) stateEl.textContent = "MARTILLO";
            else if (power.targeting) stateEl.textContent = "APUNTANDO";
            else if (frozenCount > 0) stateEl.textContent = `${frozenCount} CONGELADAS`;
            else stateEl.textContent = `${power.charges} CARGAS`;
          } else {
            stateEl.textContent = `${power.charges} CARGAS`;
          }
        }

        const pipsEl = this.powerPips[id];
        if (pipsEl) {
          let pips = "";
          const total = BP.POWER_DEFS[id].charges || 3;
          for (let i = 0; i < total; i += 1) {
            pips += `<i class="${i < power.charges ? "is-filled" : ""}"></i>`;
          }
          pipsEl.innerHTML = pips;
        }
      });
    }

    flashPowerCard(id) {
      const card = this.powerCards[id];
      if (!card) return;
      card.classList.remove("is-flash");
      void card.offsetWidth;
      card.classList.add("is-flash");
      if (this.powerFlashTimers[id]) window.clearTimeout(this.powerFlashTimers[id]);
      this.powerFlashTimers[id] = window.setTimeout(() => card.classList.remove("is-flash"), 520);
    }

    setFreezeTargeting(on) {
      const active = Boolean(on);
      if (this.boardFrame) {
        this.boardFrame.classList.toggle("is-freeze-targeting", active);
        if (active) {
          this.boardFrame.classList.remove("is-hammer-targeting");
          this.clearHammerHover();
        }
      }
      if (!active) this.clearFreezeArea();
    }

    setHammerMode(on) {
      const active = Boolean(on);
      if (this.boardFrame) {
        this.boardFrame.classList.toggle("is-hammer-targeting", active);
        if (active) {
          this.boardFrame.classList.remove("is-freeze-targeting");
          this.clearFreezeArea();
        }
      }
      if (!active) this.clearHammerHover();
    }

    updateFreezeStatus(power) {
      if (this.boardFrame) {
        this.boardFrame.classList.toggle("is-freeze-targeting", Boolean(power.targeting));
        this.boardFrame.classList.toggle("is-hammer-targeting", Boolean(power.hammerMode));
      }
    }

    setFreezeArea(x, y, radius = 0) {
      this.clearFreezeArea();
      const el = this.getCellElement(x, y);
      if (el) el.classList.add("is-freeze-hover");
    }

    clearFreezeArea() {
      $$(".is-freeze-hover", this.boardEl).forEach((el) => el.classList.remove("is-freeze-hover"));
    }

    setHammerHover(x, y) {
      this.clearHammerHover();
      const el = this.getCellElement(x, y);
      if (el && el.classList.contains("is-frozen")) {
        el.classList.add("is-hammer-hover");
      }
    }

    clearHammerHover() {
      $$(".is-hammer-hover", this.boardEl).forEach((el) => el.classList.remove("is-hammer-hover"));
    }

    startXray(endsAt, duration) {
      this.xrayActive = true;
      this.xrayEndsAt = endsAt;
      this.xrayDuration = duration || 5000;
      this.xrayLastLabel = "";
      document.body.classList.add("is-xray");
      if (this.boardFrame) {
        this.boardFrame.classList.add("is-xray", "has-xray-active");
      }
      if (this.xrayCursor) this.xrayCursor.hidden = false;

      const rect = this.boardViewport.getBoundingClientRect();
      if (this.xrayCursor) {
        this.xrayCursor.style.left = `${rect.left + rect.width / 2}px`;
        this.xrayCursor.style.top = `${rect.top + rect.height / 2}px`;
        this.xrayCursor.style.setProperty("--xray-progress", "100");
      }
      if (this.xrayCursorLabel) this.xrayCursorLabel.textContent = `${(this.xrayDuration / 1000).toFixed(1)}s`;
      if (this.powerProgress.xray) this.powerProgress.xray.style.transform = "scaleX(1)";

      this.startXrayLoop();
    }

    startXrayLoop() {
      if (this.xrayRaf) cancelAnimationFrame(this.xrayRaf);
      const tick = () => {
        if (!this.xrayActive) return;
        const remaining = Math.max(0, this.xrayEndsAt - performance.now());
        const ratio = this.xrayDuration > 0 ? remaining / this.xrayDuration : 0;
        if (this.xrayCursor) this.xrayCursor.style.setProperty("--xray-progress", (ratio * 100).toFixed(1));
        const label = `${(remaining / 1000).toFixed(1)}s`;
        if (label !== this.xrayLastLabel) {
          this.xrayLastLabel = label;
          if (this.xrayCursorLabel) this.xrayCursorLabel.textContent = label;
          if (this.powerStates.xray) this.powerStates.xray.textContent = `ESCANEANDO ${label}`;
        }
        if (this.powerProgress.xray) this.powerProgress.xray.style.transform = `scaleX(${ratio})`;
        if (remaining > 0) {
          this.xrayRaf = requestAnimationFrame(tick);
        } else {
          this.xrayRaf = null;
        }
      };
      this.xrayRaf = requestAnimationFrame(tick);
    }

    endXray() {
      this.xrayActive = false;
      if (this.xrayRaf) cancelAnimationFrame(this.xrayRaf);
      this.xrayRaf = null;
      document.body.classList.remove("is-xray");
      if (this.boardFrame) this.boardFrame.classList.remove("is-xray", "has-xray-active");
      if (this.xrayCursor) {
        this.xrayCursor.hidden = true;
        this.xrayCursor.style.setProperty("--xray-progress", "100");
      }
      if (this.powerProgress.xray) this.powerProgress.xray.style.transform = "scaleX(0)";
      this.clearPeek();
    }

    handleXrayPointerMove(event) {
      if (!this.xrayActive || !this.xrayCursor) return;
      this.xrayCursor.hidden = false;
      this.xrayCursor.style.left = `${event.clientX}px`;
      this.xrayCursor.style.top = `${event.clientY}px`;

      const cellEl = event.target.closest(".cell");
      if (!cellEl || !this.game || !this.game.board) {
        this.clearPeek();
        return;
      }
      const cell = this.game.board.getCell(Number(cellEl.dataset.x), Number(cellEl.dataset.y));
      if (!cell || cell.revealed) {
        this.clearPeek();
        return;
      }
      this.showPeek(cell);
    }

    showPeek(cell) {
      const key = `${cell.x},${cell.y}`;
      if (this.peekKey === key) return;
      this.clearPeek();
      const el = this.getCellElement(cell.x, cell.y);
      if (!el) return;
      this.peekKey = key;
      this.peekEl = el;

      let peek = el.querySelector(".peek");
      if (!peek) {
        peek = document.createElement("span");
        peek.className = "peek";
        el.appendChild(peek);
      }

      if (cell.mine) {
        peek.dataset.kind = "mine";
        peek.innerHTML = U.icon("i-bomb");
      } else if (cell.adjacent > 0) {
        peek.dataset.kind = "number";
        peek.textContent = String(cell.adjacent);
        peek.style.color = NUMBER_COLORS[cell.adjacent] || "";
      } else {
        peek.dataset.kind = "empty";
        peek.textContent = "VACÍO";
      }

      el.classList.add("is-peek");
      if (cell.mine && performance.now() - this.lastPing > 110) {
        this.lastPing = performance.now();
        this.sound.play("xrayPing");
      }
    }

    cancelPeek() {
      this.clearPeek();
    }

    clearPeek() {
      if (this.peekEl) {
        this.peekEl.classList.remove("is-peek");
        const peek = this.peekEl.querySelector(".peek");
        if (peek) peek.remove();
      }
      this.peekEl = null;
      this.peekKey = null;
    }
  }

  BP.BoardViewComponent = BoardViewComponent;
})();

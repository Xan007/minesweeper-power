/* ============================================================
   BUSCAMINAS POWER · persistencia local y estadísticas
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});
  const STORAGE_KEY = "buscaminas-power.v1";

  const DEFAULT_SETTINGS = {
    sound: true,
    difficulty: "beginner",
    custom: { width: 16, height: 16, mines: 40 },
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createDefaultData() {
    return {
      version: 2,
      history: [],
      bests: {},
      stats: {
        all: { played: 0, won: 0, totalTimeMs: 0, bestMs: null },
      },
      settings: clone(DEFAULT_SETTINGS),
      progression: BP.Progression.createState(),
    };
  }

  class Store {
    constructor() {
      this.available = true;
      this.memory = null;
      this.data = this.load();
    }

    load() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return createDefaultData();
        const parsed = JSON.parse(raw);
        return this.sanitize(parsed);
      } catch (error) {
        this.available = false;
        return this.memory || createDefaultData();
      }
    }

    sanitize(raw) {
      const defaultData = createDefaultData();
      if (!raw || typeof raw !== "object") return defaultData;

      const data = {
        version: 2,
        history: Array.isArray(raw.history) ? raw.history.slice(0, 80) : [],
        bests: raw.bests && typeof raw.bests === "object" ? raw.bests : {},
        stats: raw.stats && typeof raw.stats === "object" ? raw.stats : {},
        settings: Object.assign(clone(DEFAULT_SETTINGS), raw.settings || {}),
        progression: BP.Progression.sanitizeState(raw.progression),
      };

      if (!data.settings.custom || typeof data.settings.custom !== "object") {
        data.settings.custom = clone(DEFAULT_SETTINGS.custom);
      }
      data.settings.custom = Object.assign(clone(DEFAULT_SETTINGS.custom), data.settings.custom);

      if (!data.stats.all) {
        data.stats.all = { played: 0, won: 0, totalTimeMs: 0, bestMs: null };
      }

      data.history = data.history
        .filter((entry) => entry && typeof entry === "object" && entry.modeKey)
        .map((entry) => ({
          id: entry.id || Date.now() + Math.random(),
          date: entry.date || new Date().toISOString(),
          mode: entry.mode || "custom",
          modeKey: String(entry.modeKey),
          modeLabel: entry.modeLabel || "Partida",
          width: Number(entry.width) || 0,
          height: Number(entry.height) || 0,
          mines: Number(entry.mines) || 0,
          result: entry.result === "win" ? "win" : "lose",
          timeMs: Math.max(0, Number(entry.timeMs) || 0),
          powers: entry.powers && typeof entry.powers === "object" ? entry.powers : {},
        }));

      return data;
    }

    save() {
      this.memory = this.data;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        this.available = true;
      } catch (error) {
        this.available = false;
      }
    }

    get settings() {
      return this.data.settings;
    }

    get progression() {
      return this.data.progression;
    }

    addCoins(amount) {
      const value = Math.max(0, Math.round(Number(amount) || 0));
      if (!value) return this.data.progression.coins;
      this.data.progression.coins = Math.min(Number.MAX_SAFE_INTEGER, this.data.progression.coins + value);
      this.data.progression.totalEarned = Math.min(Number.MAX_SAFE_INTEGER, this.data.progression.totalEarned + value);
      this.save();
      return this.data.progression.coins;
    }

    spendCoins(amount) {
      const value = Math.max(0, Math.round(Number(amount) || 0));
      if (value <= 0) return true;
      if (this.data.progression.coins < value) return false;
      this.data.progression.coins -= value;
      this.data.progression.totalSpent = Math.min(Number.MAX_SAFE_INTEGER, this.data.progression.totalSpent + value);
      this.save();
      return true;
    }

    addProgressionLog(message, type = "info") {
      const text = String(message || "").trim();
      if (!text) return null;
      const entry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        date: new Date().toISOString(),
        message: text.slice(0, 180),
        type: ["info", "success", "warn", "danger"].includes(type) ? type : "info",
      };
      this.data.progression.log.unshift(entry);
      this.data.progression.log = this.data.progression.log.slice(0, 20);
      this.save();
      return entry;
    }

    updateSettings(patch) {
      this.data.settings = Object.assign({}, this.data.settings, patch || {});
      this.save();
      return this.data.settings;
    }

    getBest(modeKey) {
      const best = this.data.bests[modeKey];
      if (!best || !Number.isFinite(best.timeMs)) return null;
      return best;
    }

    getBestCustom() {
      let best = null;
      Object.keys(this.data.bests).forEach((key) => {
        if (!key.startsWith("custom:")) return;
        const candidate = this.data.bests[key];
        if (!candidate || !Number.isFinite(candidate.timeMs)) return;
        if (!best || candidate.timeMs < best.timeMs) {
          best = Object.assign({ modeKey: key }, candidate);
        }
      });
      return best;
    }

    getStats(modeKey) {
      return this.data.stats[modeKey] || { played: 0, won: 0, totalTimeMs: 0, bestMs: null };
    }

    getAggregate() {
      return this.getStats("all");
    }

    getHistory() {
      return this.data.history.slice();
    }

    record(entry, isWin) {
      const safeEntry = {
        id: entry.id || Date.now() + Math.random(),
        date: entry.date || new Date().toISOString(),
        mode: entry.mode || "custom",
        modeKey: entry.modeKey,
        modeLabel: entry.modeLabel || "Partida",
        width: entry.width || 0,
        height: entry.height || 0,
        mines: entry.mines || 0,
        result: isWin ? "win" : "lose",
        timeMs: Math.max(0, Math.round(entry.timeMs || 0)),
        powers: entry.powers || {},
      };

      this.data.history.unshift(safeEntry);
      this.data.history = this.data.history.slice(0, 80);

      const previousBest = this.getBest(safeEntry.modeKey);
      const isRecord = Boolean(isWin && (!previousBest || safeEntry.timeMs < previousBest.timeMs));

      if (isRecord) {
        this.data.bests[safeEntry.modeKey] = {
          timeMs: safeEntry.timeMs,
          date: safeEntry.date,
          modeLabel: safeEntry.modeLabel,
        };
      }

      ["all", safeEntry.modeKey].forEach((key) => {
        const stats = this.data.stats[key] || {
          played: 0,
          won: 0,
          totalTimeMs: 0,
          bestMs: null,
        };
        stats.played += 1;
        if (isWin) {
          stats.won += 1;
          stats.totalTimeMs += safeEntry.timeMs;
          if (stats.bestMs == null || safeEntry.timeMs < stats.bestMs) {
            stats.bestMs = safeEntry.timeMs;
          }
        }
        this.data.stats[key] = stats;
      });

      this.save();
      return {
        isRecord,
        best: this.getBest(safeEntry.modeKey),
        previousBest,
        entry: safeEntry,
      };
    }

    resetHistory() {
      this.data.history = [];
      this.data.bests = {};
      this.data.stats = {
        all: { played: 0, won: 0, totalTimeMs: 0, bestMs: null },
      };
      this.save();
    }

    resetAll() {
      const previous = this.data;
      this.data = createDefaultData();
      this.save();
      if (!this.available) {
        this.data = previous;
        this.memory = previous;
        return false;
      }
      return true;
    }
  }

  BP.Store = Store;
  BP.STORAGE_KEY = STORAGE_KEY;
})();

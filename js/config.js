/* ============================================================
   BUSCAMINAS POWER · configuración y presets
   ============================================================ */
(function () {
  "use strict";

  const BP = (window.BP = window.BP || {});

  const PRESETS = {
    beginner: {
      id: "beginner",
      label: "Principiante",
      short: "Principiante",
      width: 9,
      height: 9,
      mines: 10,
      accent: "#5ff0c0",
    },
    intermediate: {
      id: "intermediate",
      label: "Intermedio",
      short: "Intermedio",
      width: 16,
      height: 16,
      mines: 40,
      accent: "#45edff",
    },
    expert: {
      id: "expert",
      label: "Experto",
      short: "Experto",
      width: 30,
      height: 16,
      mines: 99,
      accent: "#ffc75a",
    },
  };

  const POWER_DEFS = {
    hint: {
      id: "hint",
      name: "Consejero",
      key: "5",
      charges: 3,
    },
    xray: {
      id: "xray",
      name: "Visión X",
      key: "1",
      charges: 3,
      duration: 6000,
    },
    defuse: {
      id: "defuse",
      name: "Kit de desarme",
      key: "2",
      charges: 3,
    },
    immortal: {
      id: "immortal",
      name: "Inmortalidad",
      key: "3",
      charges: 2,
      clicks: 6,
    },
    freeze: {
      id: "freeze",
      name: "Cañón criogénico",
      key: "4",
      charges: 3,
      radius: 0,
      maxFrozen: 3,
      thawDuration: 10000,
    },
  };

  const TIPS = [
    "El primer clic siempre es seguro. El reloj arranca al descubrir la primera celda.",
    "La Visión X mejora su nitidez y alcanza 3x3 en el nivel máximo.",
    "El escudo fulmina la mina con un rayo celestial que absorbe el impacto y te da +15 monedas.",
    "Congela una celda y haz clic en ella para reventarla con el martillo 🔨. Si hay mina, te da +10 monedas.",
    "En el kit de desarme, corta el cable en la zona blanca para obtener +10 monedas extra.",
    "Marca las minas con clic derecho y usa doble clic sobre un número para despejar sus vecinas.",
    "Puedes ajustar el tablero a tu medida con el modo Personalizado.",
    "Los récords y el historial se guardan en este navegador, incluso si cierras la página.",
  ];

  const DEFAULT_CUSTOM = {
    width: 16,
    height: 16,
    mines: 40,
  };

  function getPreset(id) {
    const preset = PRESETS[id];
    if (!preset) return null;
    return {
      width: preset.width,
      height: preset.height,
      mines: preset.mines,
    };
  }

  function computeMaxMines(width, height) {
    const area = Math.max(1, width * height);
    const safeZone = area >= 16 ? 9 : 1;
    const densityCap = Math.floor(area * 0.55);
    return Math.max(1, Math.min(area - safeZone, densityCap));
  }

  function normalizeConfig(width, height, mines) {
    const safeWidth = BP.Utils.clamp(Math.round(Number(width) || 0), 5, 40);
    const safeHeight = BP.Utils.clamp(Math.round(Number(height) || 0), 5, 24);
    const maxMines = computeMaxMines(safeWidth, safeHeight);
    const safeMines = BP.Utils.clamp(Math.round(Number(mines) || 1), 1, maxMines);
    return {
      width: safeWidth,
      height: safeHeight,
      mines: safeMines,
      maxMines,
      clampedMines: safeMines !== Math.round(Number(mines) || 0),
    };
  }

  function modeKeyFor(mode, config) {
    if (mode === "custom" || !PRESETS[mode]) {
      return `custom:${config.width}x${config.height}x${config.mines}`;
    }
    return mode;
  }

  function modeLabelFor(mode, config) {
    if (mode !== "custom" && PRESETS[mode]) return PRESETS[mode].label;
    return "Personalizado";
  }

  BP.PRESETS = PRESETS;
  BP.POWER_DEFS = POWER_DEFS;
  BP.TIPS = TIPS;
  BP.DEFAULT_CUSTOM = DEFAULT_CUSTOM;
  BP.getPreset = getPreset;
  BP.computeMaxMines = computeMaxMines;
  BP.normalizeConfig = normalizeConfig;
  BP.modeKeyFor = modeKeyFor;
  BP.modeLabelFor = modeLabelFor;
})();

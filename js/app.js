/* ============================================================
   BUSCAMINAS POWER · arranque de la aplicación
   ============================================================ */
(function () {
  "use strict";

  const BP = window.BP;
  const U = BP.Utils;

  function boot() {
    const store = new BP.Store();
    const sound = new BP.Sound(store);
    const fx = new BP.FX(document.getElementById("fxCanvas"));
    const ui = new BP.UI({ store, sound, fx });
    const game = new BP.Game({ ui, store, sound, fx });
    const bots = new BP.BotManager({ store });

    ui.attach(game, bots);
    window.BP.app = { game, ui, store, sound, fx, bots };

    const settings = store.settings;
    let mode = settings.difficulty;
    if (mode !== "custom" && !BP.PRESETS[mode]) mode = "beginner";

    let config;
    let meta;
    if (mode === "custom") {
      const custom = BP.normalizeConfig(
        settings.custom.width,
        settings.custom.height,
        settings.custom.mines
      );
      config = { width: custom.width, height: custom.height, mines: custom.mines };
      meta = {
        mode: "custom",
        modeKey: BP.modeKeyFor("custom", config),
        label: "Personalizado",
      };
      ui.syncCustomInputs(config);
    } else {
      const preset = BP.PRESETS[mode];
      config = { width: preset.width, height: preset.height, mines: preset.mines };
      meta = { mode, modeKey: mode, label: preset.label };
    }

    game.newGame(config, meta);
    ui.refreshProgression();
    bots.start();

    if (!store.available) {
      ui.toast("El almacenamiento local no está disponible. Los récords no se guardarán.", "warn", 5200);
    }

    // Inicializa el tamaño del tablero después del primer layout completo.
    window.setTimeout(() => ui.fitCellSize(), 120);

    // El primer clic en cualquier parte desbloquea el audio.
    document.addEventListener(
      "pointerdown",
      () => sound.unlock(),
      { once: true, passive: true }
    );

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        // Mantiene el canvas de FX sincronizado al volver a la pestaña.
        fx.resize();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

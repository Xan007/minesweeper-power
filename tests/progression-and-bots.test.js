const test = require("node:test");
const assert = require("node:assert/strict");

global.window = global;
require("../js/utils.js");
require("../js/config.js");
require("../js/progression.js");
require("../js/board.js");
require("../js/components/bot-brain.js");
require("../js/components/bot-runner.js");
require("../js/bots.js");
require("../js/components/contracts.js");
require("../js/components/extractor.js");
require("../js/components/board-view.js");
require("../js/components/spectator.js");
require("../js/storage.js");
require("../js/ui.js");
require("../js/game.js");
require("../js/effects.js");

test("recompensas: velocidad y minas sin bandera dan bonos independientes", () => {
  const p = BP.Progression;
  const config = { width: 9, height: 9, mines: 10 };
  const fast = p.manualRewardDetails("beginner", config, 10000, 0);
  const slow = p.manualRewardDetails("beginner", config, 240000, 0);
  const flagged = p.manualRewardDetails("beginner", config, 10000, 10);
  assert.ok(fast.total > slow.total);
  assert.ok(fast.total > flagged.total);
  assert.equal(flagged.flagBonus, 0);
  assert.equal(p.manualRewardDetails("beginner", config, 10000, 5, 5).flagBonus, 0);
  const bot = (flags) => p.botBoardReward({ difficulty: "beginner", win: true, elapsedMs: 10000, revealedSafe: 71, totalSafe: 71, mines: 10, flags });
  assert.ok(bot(0).total > bot(10).total);
});

test("el inicio de la economía mantiene acotadas las recompensas automáticas", () => {
  const p = BP.Progression;
  const win = p.botBoardReward({ difficulty: "beginner", win: true, elapsedMs: 14000, revealedSafe: 71, totalSafe: 71, mines: 10, flags: 0 });
  const loss = p.botBoardReward({ difficulty: "beginner", win: false, elapsedMs: 14000, revealedSafe: 35, totalSafe: 71 });
  assert.ok(win.total <= 15);
  assert.ok(loss.total < win.total);
  assert.equal(p.networkReward(1), 50);
  assert.equal(p.networkReward(100), 500);
});

test("el análisis no depende del contenido oculto", () => {
  const board = new BP.Board(3, 2, 1);
  board.generated = true;
  const clue = board.getCell(0, 0);
  clue.revealed = true;
  clue.adjacent = 1;
  const read = () => BP.BotBrain.analyze(board).risks.map(({ cell, risk }) => [cell.x, cell.y, risk]);
  board.getCell(1, 0).mine = true;
  const before = read();
  board.getCell(1, 0).mine = false;
  board.getCell(2, 1).mine = true;
  assert.deepEqual(read(), before);
});

test("deduce celdas seguras y minas a partir de pistas", () => {
  const board = new BP.Board(3, 2, 1);
  board.generated = true;
  board.getCell(0, 0).revealed = true;
  board.getCell(0, 0).adjacent = 1;
  board.getCell(1, 0).flagged = true;
  const analysis = BP.BotBrain.analyze(board);
  assert.ok(analysis.safe.some((cell) => cell.x === 0 && cell.y === 1));
  assert.ok(analysis.safe.some((cell) => cell.x === 1 && cell.y === 1));
});

test("los datos guardados conservan niveles y monedas", () => {
  const state = BP.Progression.createState();
  state.coins = 123;
  state.upgrades.intelligence = 3;
  const restored = BP.Progression.sanitizeState(state);
  assert.equal(restored.coins, 123);
  assert.equal(restored.upgrades.intelligence, 3);
  assert.equal(restored.upgrades.advisor, 0);
  state.upgrades.advisor = 4;
  assert.equal(BP.Progression.sanitizeState(state).upgrades.advisor, 4);
});

test("los bots terminan tableros generados sin quedarse bloqueados", () => {
  const state = BP.Progression.createState();
  const outcomes = [];
  const manager = { store: { progression: state }, speedMultiplier: 1,
    completeBoard: (_runner, win, reward) => outcomes.push({ win, reward }) };
  for (let game = 0; game < 30; game += 1) {
    const runner = new BP.BotRunner(manager, state.bots[0]);
    for (let step = 0; step < 300 && !runner.done; step += 1) runner.step(runner.startedAt + step * 480);
    assert.ok(runner.done, "el bot debe terminar la partida");
  }
  assert.equal(outcomes.length, 30);
  assert.ok(outcomes.every(({ reward }) => Number.isFinite(reward) && reward > 0));
});

test("el HUD actualiza el reloj y las minas restantes", () => {
  const view = Object.create(BP.BoardViewComponent.prototype);
  view.timer = { textContent: "" };
  view.mineCount = { textContent: "" };
  view.hideShield = () => {};
  view.updateTimer(65000);
  view.updateHud({ board: { mineCount: 10, flagsPlaced: 2, minesDefused: 1 }, powers: { immortal: { active: false } } });
  assert.equal(view.timer.textContent, "01:05");
  assert.equal(view.mineCount.textContent, "007");
});

test("el cronómetro arranca al descubrir y se detiene al terminar", () => {
  const old = { performance: global.performance, request: global.requestAnimationFrame, cancel: global.cancelAnimationFrame, board: BP.Board, defuse: BP.DefuseMinigame };
  let now = 1000;
  let tick;
  let shown = 0;
  try {
    global.performance = { now: () => now };
    global.requestAnimationFrame = (callback) => { tick = callback; return 1; };
    global.cancelAnimationFrame = () => {};
    BP.DefuseMinigame = class { stop() {} };
    BP.Board = class {
      constructor() { this.cell = { x: 0, y: 0 }; this.minesDefused = 0; }
      getCell() { return this.cell; }
      reveal() { return { kind: "safe", changed: [this.cell] }; }
      allSafeRevealed() { return false; }
    };
    const ui = new Proxy({ updateTimer: (value) => { shown = value; }, getCellElement: () => null }, { get: (object, key) => object[key] || (() => {}) });
    const game = new BP.Game({ ui, store: { progression: BP.Progression.createState() }, sound: { play() {} }, fx: {} });
    game.newGame({ width: 9, height: 9, mines: 10 }, { mode: "beginner" });
    game.reveal(0, 0);
    assert.equal(game.status, "playing");
    now = 3500;
    tick();
    assert.equal(shown, 2500);
    now = 4000;
    game.stopTimer();
    assert.equal(shown, 3000);
  } finally {
    global.performance = old.performance;
    global.requestAnimationFrame = old.request;
    global.cancelAnimationFrame = old.cancel;
    BP.Board = old.board;
    BP.DefuseMinigame = old.defuse;
  }
});

test("Nueva partida conserva la dificultad y configuración", () => {
  let args;
  const ui = Object.create(BP.UI.prototype);
  ui.game = { config: { width: 16, height: 16, mines: 40 }, mode: "intermediate", modeKey: "intermediate", modeLabel: "Intermedio", newGame: (...value) => { args = value; } };
  ui.startSameGame();
  assert.deepEqual(args, [ui.game.config, { mode: "intermediate", modeKey: "intermediate", label: "Intermedio" }]);
});

test("Nueva sesión exige confirmación y conserva datos si el guardado falla", () => {
  const previous = { confirm: global.confirm, location: global.location, localStorage: global.localStorage };
  let saved = null;
  let reloads = 0;
  try {
    global.localStorage = { getItem: () => null, setItem: (_key, value) => { saved = value; } };
    const store = new BP.Store();
    store.progression.coins = 999;
    const ui = Object.create(BP.UI.prototype);
    ui.store = store;
    ui.toast = () => {};
    global.location = { reload: () => { reloads += 1; } };
    global.confirm = () => false;
    assert.equal(ui.startNewSession(), false);
    assert.equal(store.progression.coins, 999);
    global.confirm = () => true;
    assert.equal(ui.startNewSession(), true);
    assert.equal(store.progression.coins, 25);
    assert.equal(JSON.parse(saved).progression.coins, 25);
    assert.equal(reloads, 1);
    store.progression.coins = 500;
    global.localStorage.setItem = () => { throw new Error("sin almacenamiento"); };
    assert.equal(ui.startNewSession(), false);
    assert.equal(store.progression.coins, 500);
    assert.equal(reloads, 1);
  } finally {
    global.confirm = previous.confirm;
    global.location = previous.location;
    global.localStorage = previous.localStorage;
  }
});

test("en modo táctil Bandera se marca y con Visión X se inspecciona sin abrir", () => {
  const handlers = {};
  const view = Object.create(BP.BoardViewComponent.prototype);
  let flags = 0, reveals = 0, scans = 0;
  const cell = { dataset: { x: "2", y: "3" } };
  const game = { status: "playing", powers: { freeze: { targeting: false, hammerMode: false } },
    flag() { flags += 1; }, reveal() { reveals += 1; } };
  Object.assign(view, { ui: { game }, boardEl: { addEventListener: (name, callback) => { handlers[name] = callback; } },
    touchMode: "flag", xrayActive: false, lastTouchFlagAt: -Infinity, suppressClick: false,
    cancelTouchTimer() {}, clearChordPreview() {}, setFace() {}, handleXrayPointerMove() { scans += 1; } });
  view.bindBoardEvents();
  const event = { target: { closest: () => cell }, pointerType: "touch", button: 0, clientX: 10, clientY: 10 };
  handlers.pointerdown(event);
  handlers.pointerup(event);
  assert.equal(flags, 1);
  view.xrayActive = true;
  handlers.pointerdown(event);
  handlers.pointerup(event);
  assert.equal(scans, 1);
  assert.equal(flags, 1);
  assert.equal(reveals, 0);
});

test("contratos diarios se cobran una sola vez y se renuevan al día siguiente", () => {
  const state = BP.Progression.createState();
  state.manualWins = 1;
  const result = { mode: "beginner", elapsedMs: 40000, usedPowers: 0 };
  const first = BP.Contracts.completeWin(state, result, "2026-10-28");
  assert.equal(first.total, 100);
  assert.equal(BP.Contracts.completeWin(state, result, "2026-10-28").total, 0);
  const nextDay = BP.Contracts.completeWin(state, result, "2026-10-29");
  assert.equal(nextDay.awarded.reduce((sum, item) => sum + item.reward, 0), 100);
  assert.equal(BP.Contracts.current(state, "2026-10-30").filter((item) => item.completed).length, 0);
});

test("los contratos y rangos excluyen tableros personalizados", () => {
  const state = BP.Progression.createState();
  state.fieldWins = 2;
  const result = BP.Contracts.completeWin(state, { mode: "custom", elapsedMs: 1000, usedPowers: 0 }, "2026-10-28");
  assert.equal(result.awarded.length, 0);
  assert.equal(result.rankReward, 0);
  const classic = BP.Contracts.completeWin(state, { mode: "beginner", elapsedMs: 300000, usedPowers: 1 }, "2026-10-28");
  assert.equal(classic.rankReward, 35);
  assert.equal(state.rank, 1);
  assert.equal(BP.Contracts.completeWin(state, { mode: "custom" }, "2026-10-28").rankReward, 0);
  const restored = BP.Progression.sanitizeState({ ...state, contracts: state.contracts });
  assert.equal(restored.rank, 1);
  assert.equal(restored.upgrades.salvage, 0);
});

test("el Consejero señala una jugada segura y no gasta pistas ante banderas erróneas o hielo", () => {
  const board = new BP.Board(3, 2, 1);
  board.generated = true;
  board.getCell(0, 0).revealed = true;
  board.getCell(0, 0).adjacent = 1;
  board.getCell(1, 0).mine = true;
  board.getCell(1, 0).flagged = true;
  let hint;
  let notice = "";
  const ui = new Proxy({ showHint: (cell, isMine) => { hint = { cell, isMine }; }, toast: (message) => { notice = message; } },
    { get: (object, key) => object[key] || (() => {}) });
  const game = Object.create(BP.Game.prototype);
  Object.assign(game, { board, config: { width: 3, height: 2, mines: 1 }, modeLabel: "Prueba", status: "playing", defuseActive: false, ui, sound: { play() {} },
    powers: { hint: { charges: 3, used: 0 }, freeze: { targeting: false, hammerMode: false, frozen: new Map() } } });
  assert.equal(game.requestHint(), true);
  assert.equal(hint.isMine, false);
  assert.equal(hint.cell.mine, false);
  assert.equal(game.powers.hint.charges, 2);
  board.getCell(2, 1).flagged = true;
  assert.equal(game.requestHint(), false);
  assert.match(notice, /incorrecta/);
  assert.equal(game.powers.hint.charges, 2);
  board.getCell(2, 1).flagged = false;
  game.powers.freeze.frozen.set("2,1", {});
  assert.equal(game.requestHint(), false);
  assert.match(notice, /hielo/);
  assert.equal(game.powers.hint.charges, 2);
});

test("el Consejero no presenta una conjetura como segura ni consume carga", () => {
  const board = new BP.Board(3, 2, 1);
  board.generated = true;
  board.getCell(0, 0).revealed = true;
  board.getCell(0, 0).adjacent = 1;
  let message = "";
  const game = Object.create(BP.Game.prototype);
  Object.assign(game, { board, status: "playing", defuseActive: false,
    ui: { toast: (value) => { message = value; } },
    powers: { hint: { charges: 3, used: 0 }, freeze: { frozen: new Map() } } });
  assert.equal(game.requestHint(), false);
  assert.match(message, /No hay una jugada segura/);
  assert.equal(game.powers.hint.charges, 3);
});

test("el Consejero diferencia una mina deducida de una celda segura", () => {
  const board = new BP.Board(3, 2, 1);
  board.generated = true;
  board.getCell(0, 0).revealed = true;
  board.getCell(0, 0).adjacent = 1;
  board.getCell(0, 1).revealed = true;
  board.getCell(1, 1).revealed = true;
  board.getCell(1, 0).mine = true;
  let result;
  const ui = new Proxy({ showHint: (cell, isMine) => { result = { cell, isMine }; } },
    { get: (object, key) => object[key] || (() => {}) });
  const game = Object.create(BP.Game.prototype);
  Object.assign(game, { board, config: { width: 3, height: 2, mines: 1 }, status: "playing", defuseActive: false,
    ui, sound: { play() {} }, powers: { hint: { charges: 3, used: 0 }, freeze: { frozen: new Map() } } });
  assert.equal(game.requestHint(), true);
  assert.equal(result.isMine, true);
  assert.equal(result.cell, board.getCell(1, 0));
});

test("los bots comparten escaneos con otros y completan operaciones persistentes", () => {
  const state = BP.Progression.createState();
  state.upgrades.capacity = 1;
  state.bots.push({ ...state.bots[0], id: "bot-2", number: 2, name: "Scout-02", skills: {} });
  const store = { progression: state, save() {}, addCoins(value) { state.coins += value; }, addProgressionLog() {} };
  const manager = new BP.BotManager({ store });
  const first = state.bots[0];
  assert.equal(manager.recordNetworkWin(first), null);
  assert.equal(manager.takeSharedScan(first.id), null);
  assert.equal(manager.takeSharedScan("bot-2"), "Scout-01");
  assert.equal(state.network.assists, 1);
  manager.recordNetworkWin(first);
  const reward = manager.recordNetworkWin(state.bots[1]);
  assert.deepEqual(reward, { level: 1, reward: 50 });
  assert.equal(state.network.level, 2);
  assert.equal(state.network.progress, 0);
  assert.equal(state.coins, 75);
  const restored = BP.Progression.sanitizeState(state);
  assert.equal(restored.network.level, 2);
  assert.equal(restored.network.assists, 1);
  assert.deepEqual(restored.network.scans, [first.id, "bot-2"]);
});

test("un bot atascado usa el escaneo compartido en su propio tablero", () => {
  let marked = false;
  const cell = { x: 2, y: 3, mine: true };
  const runner = Object.create(BP.BotRunner.prototype);
  Object.assign(runner, {
    bot: { id: "recipient" }, manager: { takeSharedScan: () => "Scout-01" },
    board: { toggleFlag: () => { marked = true; }, allSafeRevealed: () => false },
    hiddenCells: () => [cell], analyze: () => ({ safe: [], mines: [], risks: [] }),
    setThought: (message) => { runner.currentThought = message; }, updateProgress() {}, steps: 0,
  });
  runner.step(1000);
  assert.equal(marked, true);
  assert.equal(runner.status, "scan");
  assert.match(runner.currentThought, /Scout-01/);
});

test("el panel de operaciones muestra cómo desbloquear y completar la red", () => {
  const state = BP.Progression.createState();
  const view = Object.create(BP.SpectatorComponent.prototype);
  view.store = { progression: state };
  view.ui = { bots: { isTurboActive: false, turboFreeRechargeReady: false, turboFreeRechargeRemainingMs: 120000 } };
  view.networkTitle = {};
  view.networkGoal = {};
  view.networkProgress = { style: {} };
  view.networkHint = {};
  view.networkScans = {};
  view.updateTurboUI();
  assert.equal(view.networkGoal.textContent, "Bloqueada");
  state.bots.push({ id: "bot-2" });
  state.network.progress = 1;
  view.updateTurboUI();
  assert.match(view.networkGoal.textContent, /1 \/ 3/);
  assert.match(view.networkHint.textContent, /otro bot/);
});

test("la racha experta multiplica la recompensa y tiene un límite", () => {
  assert.equal(BP.Progression.expertStreakBonus(100, 1), 10);
  assert.equal(BP.Progression.expertStreakBonus(100, 4), 40);
  assert.equal(BP.Progression.expertStreakBonus(100, 100), 150);
  const state = BP.Progression.createState();
  state.expertStreak = 4;
  state.bestExpertStreak = 7;
  const restored = BP.Progression.sanitizeState(state);
  assert.equal(restored.expertStreak, 4);
  assert.equal(restored.bestExpertStreak, 7);
});

test("la sacudida mueve todos los elementos y termina en reposo", () => {
  const original = global.requestAnimationFrame;
  global.requestAnimationFrame = () => 1;
  try {
    const elements = Array.from({ length: 4 }, () => ({ style: {} }));
    const fx = Object.create(BP.FX.prototype);
    Object.assign(fx, { running: true, lastTime: 0, trauma: 1, shakeTime: 0, reduced: false,
      ctx: { clearRect() {} }, width: 100, height: 100, particles: [], shakeTargets: elements });
    fx.loop(16);
    assert.ok(elements[0].style.transform.includes("translate3d"));
    assert.ok(elements.every((element) => element.style.transform === elements[0].style.transform));
    for (let time = 32; time <= 1600; time += 16) fx.loop(time);
    assert.ok(elements.every((element) => element.style.transform === ""));
    assert.equal(fx.running, false);
  } finally { global.requestAnimationFrame = original; }
});

test("los efectos limitan partículas y solo sacuden las capas visibles", () => {
  const fx = Object.create(BP.FX.prototype);
  const base = { style: {} };
  const modal = (open) => ({ style: {}, classList: { contains: (name) => name === "modal" || (name === "is-open" && open) } });
  const visible = modal(true), hidden = modal(false);
  Object.assign(fx, { particles: [], reduced: false, trauma: 0, baseShakeTargets: [base],
    overlayShakeTargets: [visible, hidden], shakeTargets: [base], start() {} });
  for (let i = 0; i < 250; i += 1) fx.add({ life: 1 });
  assert.equal(fx.particles.length, 200);
  fx.addTrauma(0.5);
  assert.deepEqual(fx.shakeTargets, [base, visible]);
  fx.reduced = true;
  fx.trauma = 0;
  fx.addTrauma(0.8);
  assert.equal(fx.trauma, 0);
});

test("los clics adelantan el turbo gratis sin crear monedas ni acumular cargas extra", () => {
  const original = global.performance;
  let now = 10000;
  try {
    global.performance = { now: () => now };
    const state = BP.Progression.createState();
    const store = { progression: state, save() {}, addProgressionLog() {},
      spendCoins(value) { if (state.coins < value) return false; state.coins -= value; return true; } };
    const manager = new BP.BotManager({ store });
    const component = Object.create(BP.ExtractorComponent.prototype);
    Object.assign(component, { store, comboClicks: 0, lastClickAt: null, lastEffectAt: 0, button: {},
      sound: { play() {} }, fx: { floatingText() {}, energyArcs() {}, shakeLight() {} },
      ui: { bots: manager, refreshProgression() {}, toast() {} } });
    const first = component.extract(now);
    assert.equal(first.reducedMs, 500);
    assert.equal(state.coins, 25);
    for (let i = 1; i < 25; i += 1) { now += 100; component.extract(now); }
    assert.equal(component.comboAt(now), 5);
    assert.equal(state.coins, 25);
    manager.turboFreeRechargeAt = now + 200;
    assert.equal(component.extract(now).reducedMs, 200);
    assert.equal(manager.turboFreeRechargeAt, now);
    assert.equal(component.extract(now).reducedMs, 0);
    assert.equal(component.activateFreeTurbo(), true);
    assert.equal(manager.isTurboActive, true);
    assert.equal(state.coins, 25);
    assert.equal(component.activateFreeTurbo(), false);
    assert.equal(manager.turboFreeRechargeRemainingMs, BP.Progression.TURBO_RECHARGE_MS);
    now += 100;
    assert.ok(component.extract(now).reducedMs > 0);
    assert.ok(manager.turboFreeRechargeRemainingMs < BP.Progression.TURBO_RECHARGE_MS);
  } finally { global.performance = original; }
});

test("mejorar la recarga exige monedas y conserva los niveles anteriores", () => {
  const p = BP.Progression;
  assert.ok(p.turboClickSeconds(10) > p.turboClickSeconds(9));
  assert.ok(p.extractorCost(50) > p.extractorCost(49));
  assert.equal(p.extractorCost(100), null);
  const state = p.createState();
  state.extractor.level = 25;
  assert.equal(p.sanitizeState(state).extractor.level, 25);
  state.extractor.level = 0;
  const component = Object.create(BP.ExtractorComponent.prototype);
  component.store = { progression: state, spendCoins: () => false };
  assert.equal(component.buyUpgrade(), false);
  assert.equal(state.extractor.level, 0);
  state.coins = 5000000000;
  state.totalEarned = 5000000000;
  assert.equal(p.sanitizeState(state).coins, 5000000000);
});

test("la recarga muestra el tiempo y habilita el turbo solo cuando está listo", () => {
  const original = global.performance;
  let now = 1000;
  try {
    global.performance = { now: () => now };
    const state = BP.Progression.createState();
    const manager = new BP.BotManager({ store: { progression: state } });
    const component = Object.create(BP.ExtractorComponent.prototype);
    const upgrade = { setAttribute(name, value) { this[name] = value; } };
    Object.assign(component, { store: { progression: state }, ui: { bots: manager },
      lastClickAt: null, comboClicks: 0, button: {}, activate: {}, upgrade, info: {}, chargeLabel: {}, bar: { style: {} } });
    component.render(now);
    assert.equal(component.button.textContent, "Cargar −0,5 s");
    assert.equal(component.chargeLabel.textContent, "120 s");
    assert.equal(component.activate.disabled, true);
    manager.accelerateTurboRecharge(120000, now);
    component.render(now);
    assert.equal(component.button.disabled, true);
    assert.equal(component.activate.disabled, false);
    assert.equal(component.chargeLabel.textContent, "LISTO");
    assert.equal(component.bar.style.width, "100%");
  } finally { global.performance = original; }
});

test("la recarga no avanza por debajo de cero y el turbo termina a tiempo", () => {
  const original = global.performance;
  let now = 1000;
  try {
    global.performance = { now: () => now };
    const manager = new BP.BotManager({ store: { progression: BP.Progression.createState() } });
    assert.equal(manager.accelerateTurboRecharge(200000), 120000);
    assert.equal(manager.turboFreeRechargeRemainingMs, 0);
    assert.equal(manager.accelerateTurboRecharge(1000), 0);
    assert.equal(manager.speedMultiplier, 1);
    manager.turboUntil = 5000;
    assert.equal(manager.speedMultiplier, 4.5);
    now = 9001;
    assert.equal(manager.speedMultiplier, 1);
  } finally { global.performance = original; }
});

test("velocidad e inteligencia de bots progresan dentro de los limites previstos", () => {
  const p = BP.Progression;
  const state = p.createState();
  assert.equal(p.botStepMs(state), 1500);
  state.upgrades.speed = 6;
  assert.equal(p.botStepMs(state), 200);
  assert.ok(p.botAccuracy(state) < 1);
  const saved = p.sanitizeState({ ...state, bots: [{ ...state.bots[0], useFlags: false }] });
  assert.equal(saved.bots[0].useFlags, false);
});

test("las minas recordadas permiten deducir sin colocar banderas", () => {
  const board = new BP.Board(3, 2, 1);
  board.generated = true;
  const clue = board.getCell(0, 0);
  clue.revealed = true;
  clue.adjacent = 1;
  const known = board.getCell(1, 0);
  const result = BP.BotBrain.analyze(board, new Set([`${known.x},${known.y}`]));
  assert.ok(result.safe.some((cell) => cell.x === 0 && cell.y === 1));
  assert.equal(board.flagsPlaced, 0);
});

test("mejorar habilidades amplia el hielo y la vision", () => {
  const p = BP.Progression;
  const base = p.manualPowerStats({ freeze: 0, xray: 0 });
  const medium = p.manualPowerStats({ freeze: 1, xray: 1 });
  const max = p.manualPowerStats({ freeze: 4, xray: 4 });
  assert.deepEqual([base.freeze.areaSize, medium.freeze.areaSize, max.freeze.areaSize], [1, 2, 3]);
  assert.ok(max.xray.duration > base.xray.duration);
  assert.ok(max.xray.radius > base.xray.radius);
});

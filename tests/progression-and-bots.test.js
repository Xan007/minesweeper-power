const test = require("node:test");
const assert = require("node:assert/strict");

global.window = global;
require("../js/utils.js");
require("../js/config.js");
require("../js/progression.js");
require("../js/board.js");
require("../js/components/bot-brain.js");
require("../js/components/bot-runner.js");
require("../js/components/contracts.js");
require("../js/components/board-view.js");
require("../js/game.js");

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

test("contratos diarios se cobran una sola vez y se renuevan al día siguiente", () => {
  const state = BP.Progression.createState();
  state.manualWins = 1;
  const result = { mode: "beginner", elapsedMs: 40000, usedPowers: 0 };
  const first = BP.Contracts.completeWin(state, result, "2026-10-28");
  assert.equal(first.total, 350);
  assert.equal(BP.Contracts.completeWin(state, result, "2026-10-28").total, 0);
  const nextDay = BP.Contracts.completeWin(state, result, "2026-10-29");
  assert.equal(nextDay.awarded.reduce((sum, item) => sum + item.reward, 0), 350);
  assert.equal(BP.Contracts.current(state, "2026-10-30").filter((item) => item.completed).length, 0);
});

test("los contratos y rangos excluyen tableros personalizados", () => {
  const state = BP.Progression.createState();
  state.fieldWins = 2;
  const result = BP.Contracts.completeWin(state, { mode: "custom", elapsedMs: 1000, usedPowers: 0 }, "2026-10-28");
  assert.equal(result.awarded.length, 0);
  assert.equal(result.rankReward, 0);
  const classic = BP.Contracts.completeWin(state, { mode: "beginner", elapsedMs: 300000, usedPowers: 1 }, "2026-10-28");
  assert.equal(classic.rankReward, 60);
  assert.equal(state.rank, 1);
  assert.equal(BP.Contracts.completeWin(state, { mode: "custom" }, "2026-10-28").rankReward, 0);
  const restored = BP.Progression.sanitizeState({ ...state, contracts: state.contracts });
  assert.equal(restored.rank, 1);
  assert.equal(restored.upgrades.salvage, 0);
});

const test = require("node:test");
const assert = require("node:assert/strict");

global.window = global;
require("../js/utils.js");
require("../js/config.js");
require("../js/progression.js");
require("../js/board.js");
require("../js/components/bot-brain.js");
require("../js/components/bot-runner.js");

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

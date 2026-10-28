const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global;
require('../js/utils.js');
require('../js/config.js');
require('../js/progression.js');
require('../js/board.js');
require('../js/storage.js');
require('../js/game.js');
require('../js/defuse.js');
require('../js/components/coin-feedback.js');

test('una cascada rompe hielo seguro sin descubrir minas ni banderas', () => {
  const board = new BP.Board(4, 3, 1);
  board.generated = true;
  const mine = board.getCell(3, 2);
  mine.mine = true;
  mine.frozen = true;
  const frozen = board.getCell(1, 0);
  frozen.frozen = true;
  const flagged = board.getCell(0, 1);
  flagged.frozen = true;
  flagged.flagged = true;
  board.computeAdjacency();
  const result = board.reveal(0, 0);
  assert.equal(result.kind, 'safe');
  assert.ok(result.brokenFrozen.includes(frozen));
  assert.equal(frozen.frozen, false);
  assert.equal(frozen.revealed, true);
  assert.equal(mine.frozen, true);
  assert.equal(mine.revealed, false);
  assert.equal(flagged.frozen, true);
  assert.equal(flagged.revealed, false);
});

test('las monedas acreditadas notifican exactamente una vez y gastar no notifica', () => {
  const store = Object.create(BP.Store.prototype);
  store.data = { progression: { coins: 25, totalEarned: 25, totalSpent: 0 } };
  store.save = () => {};
  const gains = [];
  store.onCoinsAdded = amount => gains.push(amount);
  store.addCoins(10);
  store.addCoins(0);
  store.spendCoins(5);
  store.data.progression.coins = Number.MAX_SAFE_INTEGER - 2;
  store.addCoins(20);
  assert.deepEqual(gains, [10, 2]);
  assert.equal(store.progression.coins, Number.MAX_SAFE_INTEGER);
});

test('los ingresos cercanos comparten un sonido y una ráfaga', () => {
  const oldDocument = global.document;
  const oldTimeout = global.setTimeout;
  const oldWidth = global.innerWidth;
  const oldHeight = global.innerHeight;
  const timers = [];
  const popups = [];
  global.setTimeout = fn => { timers.push(fn); return timers.length; };
  global.innerWidth = 320;
  global.innerHeight = 640;
  global.document = {
    getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, remove() {} }),
    body: { appendChild: popup => popups.push(popup) },
  };
  try {
    const counter = { textContent: '', offsetWidth: 1, classList: { add() {}, remove() {} }, getBoundingClientRect: () => ({ left: 20, width: 30, bottom: 30 }) };
    let sounds = 0;
    let bursts = 0;
    const feedback = new BP.CoinFeedback({ store: { progression: { coins: 100 } }, counter, sound: { play: () => sounds++ }, fx: { coinBurst: () => bursts++ } });
    feedback.add(10);
    feedback.add(20);
    assert.equal(timers.length, 1);
    timers[0]();
    assert.equal(popups[0].textContent, '+30');
    assert.equal(sounds, 1);
    assert.equal(bursts, 1);
  } finally {
    global.document = oldDocument;
    global.setTimeout = oldTimeout;
    global.innerWidth = oldWidth;
    global.innerHeight = oldHeight;
  }
});

test('el kit ignora cortes durante el segundo de reacción', () => {
  const originalPerformance = global.performance;
  const originalTimeout = global.setTimeout;
  let now = 1999;
  global.performance = { now: () => now };
  global.setTimeout = () => 1;
  try {
    const kit = Object.create(BP.DefuseMinigame.prototype);
    Object.assign(kit, { active: true, resolved: false, readyAt: 2000, raf: null, angle: 0, targetCenter: 0, targetWidth: 40, card: { classList: { add() {} } }, cutButton: {}, needle: { style: {} }, resultEl: {}, precisionEl: {}, callbacks: {} });
    assert.equal(kit.cut(), null);
    assert.equal(kit.resolved, false);
    now = 2000;
    assert.equal(kit.cut().success, true);
    assert.equal(kit.resolved, true);
  } finally {
    global.performance = originalPerformance;
    global.setTimeout = originalTimeout;
  }
});

test('la pausa del kit solo se activa con clics rápidos', () => {
  const game = Object.create(BP.Game.prototype);
  const originalPerformance = global.performance;
  let now = 1000;
  global.performance = { now: () => now };
  try {
    game.lastRevealAt = null;
    game.trackBoardInput();
    assert.equal(game.recentRapidInput, false);
    now += 100;
    game.trackBoardInput();
    assert.equal(game.recentRapidInput, true);
    let options;
    game.powers = { defuse: { charges: 2, used: 0 } };
    game.board = { mineCount: 10, area: 81 };
    game.ui = { updatePowers() {}, setFace() {}, setStatus() {}, toast() {} };
    game.defuse = { start: value => { options = value; } };
    game.beginDefuse({ x: 0, y: 0 });
    assert.equal(options.reactionDelayMs, 1000);
    now += 1000;
    game.trackBoardInput();
    game.beginDefuse({ x: 0, y: 0 });
    assert.equal(options.reactionDelayMs, 0);
  } finally { global.performance = originalPerformance; }
});

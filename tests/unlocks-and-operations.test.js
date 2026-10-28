const test = require('node:test');
const assert = require('node:assert/strict');
global.window = global;
require('../js/utils.js'); require('../js/config.js'); require('../js/progression.js'); require('../js/board.js'); require('../js/components/bot-brain.js'); require('../js/components/bot-runner.js'); require('../js/bots.js');
test('sesion nueva: vision y kit iniciales; escudo y hielo se compran', () => {
 const p = BP.Progression; const state = p.createState(); const stats = p.manualPowerStats(state.skills);
 assert.ok(stats.xray.charges > 0 && stats.defuse.charges > 0);
 assert.equal(stats.immortal.charges, 0); assert.equal(stats.freeze.charges, 0);
 assert.deepEqual(state.bots[0].skills, {xray:true,defuse:true,immortal:false,freeze:false});
 assert.equal(p.botSkillCharges('xray', 0), 1);
 assert.deepEqual(p.sanitizeState(state).bots[0].skills, state.bots[0].skills);
});
test('operaciones: principiante nunca progresa y desde nivel 3 exige experto', () => {
 const state = BP.Progression.createState(); state.bots.push({...state.bots[0],id:'second'});
 const manager = new BP.BotManager({store:{progression:state,save(){},addCoins(){},addProgressionLog(){}}}); const bot = state.bots[0];
 manager.recordNetworkWin(bot); assert.equal(state.network.progress, 0);
 bot.difficulty = 'intermediate'; manager.recordNetworkWin(bot); assert.equal(state.network.progress,1);
 state.network.level = 3; state.network.progress=0; manager.recordNetworkWin(bot); assert.equal(state.network.progress,0);
 bot.difficulty='expert'; manager.recordNetworkWin(bot); assert.equal(state.network.progress,1);
});
test('comprar un poder bloqueado lo desbloquea y equipa en los bots', () => {
 const state=BP.Progression.createState(); state.coins=1000;
 const store={progression:state,save(){},addProgressionLog(){},spendCoins(n){state.coins-=n;return true;}};
 const manager=new BP.BotManager({store}); assert.ok(manager.buySkill('freeze').ok);
 assert.ok(BP.Progression.manualPowerStats(state.skills).freeze.charges>0); assert.equal(state.bots[0].skills.freeze,true);
});

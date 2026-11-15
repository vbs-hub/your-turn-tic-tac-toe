const assert = require('node:assert/strict');
const {computerMove,outcome} = require('./game.js');

// All human continuations against the impossible bot must end in a draw or O win.
let endings = 0;
function explore(board) {
  const result = outcome(board);
  if (result) { assert.notEqual(result.winner,'X'); endings++; return; }
  for (let i=0;i<9;i++) if (!board[i]) {
    const next = [...board]; next[i]='X';
    if (!outcome(next)) {
      const before = [...next];
      const move = computerMove(next,'impossible',()=>{throw Error('Impossible must not use randomness');});
      assert.deepEqual(next,before);
      assert.equal(next[move],null);
      next[move]='O';
    }
    explore(next);
  }
}
explore(Array(9).fill(null));

const threat = ['X','X',null,'O',null,null,null,null,null];
for (const level of ['easy','normal','hard','impossible']) {
  for (const r of [0,0.54,0.55,0.89,0.9,0.999]) {
    const before = [...threat];
    const move = computerMove(threat,level,()=>r);
    assert.equal(threat[move],null);
    assert.deepEqual(threat,before);
  }
  assert.equal(computerMove(['X','X','X','O','O',null,null,null,null],level),-1);
}
// On the same board and random sample normal may miss a threat; hard blocks it.
assert.notEqual(computerMove(threat,'normal',()=>0.6),2);
assert.equal(computerMove(threat,'hard',()=>0.6),2);
assert.notEqual(computerMove(threat,'hard',()=>0.95),2);
assert.equal(computerMove(threat,'impossible',()=>0.95),2);
assert.notEqual(computerMove(threat,'easy',()=>0.6),2);
console.log(`PASS: ${endings} impossible games; four difficulty levels, legal moves, terminal boards, no board mutation.`);

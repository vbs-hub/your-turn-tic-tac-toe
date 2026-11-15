const assert = require('node:assert/strict');
const {computerMove,bestMove,outcome} = require('./game.js');
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
// Aggressive play must take an actual win instead of manufacturing drama.
assert.equal(computerMove(['O','O',null,'X','X',null,'X',null,null],'impossible',()=>0),2);

let seed;
function random() { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }
const cache=new Map();
function humanValue(board,player) {
  const result=outcome(board);
  if(result)return result.winner==='X'?1:result.winner==='O'?-1:0;
  const key=board.map(v=>v||'-').join('')+player;
  if(cache.has(key))return cache.get(key);
  const scores=[];
  for(let i=0;i<9;i++)if(!board[i]) {
    board[i]=player;scores.push(humanValue(board,player==='X'?'O':'X'));board[i]=null;
  }
  const score=player==='X'?Math.max(...scores):Math.min(...scores);
  cache.set(key,score);return score;
}
function humanMove(board,skill) {
  let options=[],all=[],best=-2;
  for(let i=0;i<9;i++)if(!board[i]) {
    all.push(i);board[i]='X';const score=humanValue(board,'O');board[i]=null;
    if(score>best){best=score;options=[i];}else if(score===best)options.push(i);
  }
  if(random()>skill)options=all;
  return options[Math.floor(random()*options.length)];
}
function simulate(strategy,skill) {
  seed=73;
  const results={X:0,O:0,draw:0};
  for(let n=0;n<100;n++) {
    const board=Array(9).fill(null);
    while(!outcome(board)) {
      board[humanMove(board,skill)]='X';
      if(outcome(board))break;
      const before=[...board];
      const move=strategy==='defensive'?bestMove(board):computerMove(board,'impossible',random);
      assert.deepEqual(board,before);assert.equal(board[move],null);
      board[move]='O';
    }
    results[outcome(board).winner]++;
  }
  return results;
}
for(const skill of [0,0.7,1]) {
  const old=simulate('defensive',skill), aggressive=simulate('aggressive',skill);
  assert.ok(aggressive.draw<old.draw, 'Aggression should reduce draws for this seeded opponent');
  assert.ok(aggressive.X>0, 'Human must be able to punish risks');
  if(skill<1)assert.ok(aggressive.O>0, 'Computer must still win games');
  console.log(JSON.stringify({humanSkill:skill,old,aggressive}));
}
console.log('PASS: legal moves, no mutation, terminal boards, immediate wins, fewer draws in 600 seeded games.');

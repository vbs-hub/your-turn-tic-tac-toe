'use strict';
const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function outcome(board) {
  for (const line of lines) if (board[line[0]] && line.every(i => board[i] === board[line[0]])) return {winner:board[line[0]],line};
  return board.every(Boolean) ? {winner:'draw',line:[]} : null;
}
function minimax(board, player, depth = 0) {
  const result = outcome(board);
  if (result) return result.winner === 'O' ? 10-depth : result.winner === 'X' ? depth-10 : 0;
  const scores = [];
  board.forEach((value, i) => { if (!value) {board[i] = player; scores.push(minimax(board, player === 'O' ? 'X' : 'O', depth+1)); board[i] = null;} });
  return player === 'O' ? Math.max(...scores) : Math.min(...scores);
}
function bestMove(board) {
  let best = -Infinity, move = -1;
  for (const i of [4,0,2,6,8,1,3,5,7]) if (!board[i]) {board[i] = 'O'; const score = minimax(board,'X'); board[i] = null; if (score > best) {best=score; move=i;}}
  return move;
}
if (typeof module !== 'undefined') module.exports = {outcome,bestMove};
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  let board, turn, ended, timer, mode = 'computer';
  let scores = {computer:{X:0,O:0,draw:0},friend:{X:0,O:0,draw:0}};
  try {const saved=JSON.parse(localStorage.getItem('your-turn-scores')); if (saved && ['computer','friend'].every(m => ['X','O','draw'].every(k => Number.isSafeInteger(saved[m]?.[k]) && saved[m][k]>=0))) scores=saved;} catch {}
  const cells = Array.from({length:9},(_,i) => {const button=document.createElement('button'); button.className='cell';button.addEventListener('click',()=>play(i));document.querySelector('.board').append(button);return button;});
  function render() {
    const result=outcome(board);
    cells.forEach((cell,i) => {cell.textContent=board[i] === 'X' ? '×' : board[i] === 'O' ? '○' : '';cell.className='cell'+(board[i]==='O'?' o':'')+(result?.line.includes(i)?' win':'');cell.disabled=Boolean(board[i])||ended||(mode==='computer'&&turn==='O');cell.setAttribute('aria-label',`Ряд ${Math.floor(i/3)+1}, столбец ${i%3+1}: ${board[i] || 'пусто'}`);});
    $('status').textContent=result ? result.winner==='draw'?'Ничья. Ещё раунд?':mode==='computer'?(result.winner==='X'?'Ты победил!':'Компьютер победил'): `Победили ${result.winner==='X'?'крестики!':'нолики!'}` : mode==='computer'?(turn==='X'?'Твой ход':'Компьютер думает…'):`Ходят ${turn==='X'?'крестики':'нолики'}`;
    $('turn-badge').textContent=ended?'РАУНД ЗАВЕРШЁН':mode==='computer'?'ТЫ — ×':`ХОД — ${turn==='X'?'×':'○'}`;
    $('x-label').textContent=mode==='computer'?'Ты · ×':'Крестики · ×';$('o-label').textContent=mode==='computer'?'Компьютер · ○':'Нолики · ○';
    for (const [key,id] of [['X','score-x'],['O','score-o'],['draw','score-draw']]) $(id).textContent=scores[mode][key];
  }
  function place(i) {board[i]=turn;const result=outcome(board);if(result){ended=true;scores[mode][result.winner]++;try{localStorage.setItem('your-turn-scores',JSON.stringify(scores));}catch{}}else turn=turn==='X'?'O':'X';render();}
  function play(i) {if(ended||board[i]||(mode==='computer'&&turn==='O'))return;place(i);if(!ended&&mode==='computer')timer=setTimeout(()=>{place(bestMove(board));},400);}
  function restart(){clearTimeout(timer);board=Array(9).fill(null);turn='X';ended=false;render();}
  for(const name of ['computer','friend']) $(name).addEventListener('click',()=>{mode=name;for(const id of ['computer','friend']) $(id).setAttribute('aria-pressed',String(id===mode));restart();});
  $('restart').addEventListener('click',restart);
  $('reset').addEventListener('click',()=>{scores[mode]={X:0,O:0,draw:0};try{localStorage.setItem('your-turn-scores',JSON.stringify(scores));}catch{}restart();});
  restart();
}

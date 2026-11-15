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
const difficulties = {
  easy: {chance:0, description:'Играет случайно — удобно для первых побед.'},
  normal: {chance:0.55, description:'Чередует продуманные ходы и ошибки.'},
  hard: {chance:0.9, description:'Почти всегда выбирает лучший ход. Лови редкие ошибки!'},
  impossible: {chance:1, description:'Играет без ошибок. Лучший результат — ничья.'}
};
function computerMove(board, difficulty = 'normal', random = Math.random) {
  if (outcome(board)) return -1;
  const chance = (difficulties[difficulty] || difficulties.normal).chance;
  if (chance === 1 || (chance > 0 && random() < chance)) return bestMove(board);
  const empty = board.map((value,i) => value ? -1 : i).filter(i => i >= 0);
  return empty[Math.floor(random() * empty.length)];
}
if (typeof module !== 'undefined') module.exports = {outcome,bestMove,computerMove};
if (typeof document !== 'undefined') {
  const $ = id => document.getElementById(id);
  const modes = ['online', 'computer', 'friend'];
  let board, turn, ended, timer, room, mode = 'online', revision = 0, pending = false;
  let difficulty = 'normal';
  try {
    const saved = localStorage.getItem('your-turn-difficulty');
    if (Object.hasOwn(difficulties,saved)) difficulty = saved;
  } catch {}
  $('difficulty').value = difficulty;
  let scores = {computer:{X:0,O:0,draw:0},friend:{X:0,O:0,draw:0},online:{X:0,O:0,draw:0}};
  try {
    const saved = JSON.parse(localStorage.getItem('your-turn-scores'));
    for (const m of ['computer','friend']) if (['X','O','draw'].every(k => Number.isSafeInteger(saved?.[m]?.[k]) && saved[m][k]>=0)) scores[m]=saved[m];
  } catch {}
  const cells = Array.from({length:9},(_,i) => {
    const button=document.createElement('button'); button.className='cell';
    button.addEventListener('click',()=>play(i)); document.querySelector('.board').append(button); return button;
  });
  function connected() { return Boolean(room?.ready); }
  function mySymbol() { return room?.host ? 'X' : 'O'; }
  function render() {
    const result=outcome(board), online=mode==='online';
    cells.forEach((cell,i) => {
      cell.textContent=board[i]==='X'?'×':board[i]==='O'?'○':'';
      cell.className='cell'+(board[i]==='O'?' o':'')+(result?.line.includes(i)?' win':'');
      cell.disabled=Boolean(board[i])||ended||(mode==='computer'&&turn==='O')||(online&&(!connected()||turn!==mySymbol()||pending));
      cell.setAttribute('aria-label',`Ряд ${Math.floor(i/3)+1}, столбец ${i%3+1}: ${board[i] || 'пусто'}`);
    });
    $('status').textContent=online&&!connected()?'Ждём друга':result ? result.winner==='draw'?'Ничья. Ещё раунд?':mode==='computer'?(result.winner==='X'?'Ты победил!':'Компьютер победил'): `Победили ${result.winner==='X'?'крестики!':'нолики!'}` : online?(turn===mySymbol()?'Твой ход':'Ход друга'):mode==='computer'?(turn==='X'?'Твой ход':'Компьютер думает…'):`Ходят ${turn==='X'?'крестики':'нолики'}`;
    $('turn-badge').textContent=online?(room?`ТЫ — ${mySymbol()==='X'?'×':'○'}`:'ОНЛАЙН'):ended?'РАУНД ЗАВЕРШЁН':mode==='computer'?'ТЫ — ×':`ХОД — ${turn==='X'?'×':'○'}`;
    $('x-label').textContent=mode==='computer'?'Ты · ×':online&&room?(room.host?'Ты · ×':'Друг · ×'):'Крестики · ×';
    $('o-label').textContent=mode==='computer'?'Компьютер · ○':online&&room?(room.host?'Друг · ○':'Ты · ○'):'Нолики · ○';
    for (const [key,id] of [['X','score-x'],['O','score-o'],['draw','score-draw']]) $(id).textContent=scores[mode][key];
    $('restart').disabled=online&&(!connected()||!ended);
    $('reset').hidden=online;
    $('online-panel').hidden=!online;
    $('difficulty-panel').hidden=mode!=='computer';
    $('difficulty-description').textContent=difficulties[difficulty].description;
    $('leave-room').hidden=!room;
  }
  function persist() { try { localStorage.setItem('your-turn-scores',JSON.stringify(scores)); } catch {} }
  function publish() { room?.send({type:'state',board:[...board],turn,revision,scores:scores.online}); }
  function place(i) {
    board[i]=turn; revision++;
    const result=outcome(board);
    if(result){ended=true;scores[mode][result.winner]++;if(mode!=='online')persist();}
    else turn=turn==='X'?'O':'X';
    render();
    if(mode==='online')publish();
  }
  function legal(i) { return Number.isInteger(i)&&i>=0&&i<9&&!ended&&!board[i]; }
  function play(i) {
    if(!legal(i)||(mode==='computer'&&turn==='O'))return;
    if(mode==='online'){
      if(!connected()||turn!==mySymbol()||pending)return;
      if(!room.host){pending=true;room.send({type:'move',index:i,revision});render();return;}
    }
    place(i);
    if(!ended&&mode==='computer')timer=setTimeout(()=>place(computerMove(board,difficulty)),400);
  }
  function restart(){clearTimeout(timer);board=Array(9).fill(null);turn='X';ended=false;pending=false;revision++;render();}
  function leave() {
    room?.close();room=null;pending=false;$('invite').hidden=true;
    history.replaceState(null,'',location.pathname+location.search);
    $('network-status').textContent='Создай комнату или введи код друга.';
    restart();
  }
  function selectMode(name){leave();mode=name;for(const id of modes)$(id).setAttribute('aria-pressed',String(id===mode));restart();}
  for(const name of modes)$(name).addEventListener('click',()=>selectMode(name));
  $('difficulty').addEventListener('change',()=>{
    const selected = $('difficulty').value;
    if (!Object.hasOwn(difficulties,selected)) return;
    difficulty = selected;
    try { localStorage.setItem('your-turn-difficulty',difficulty); } catch {}
    restart();
  });
  function startRoom(code,host){
    leave();scores.online={X:0,O:0,draw:0};
    room=new OnlineRoom({
      onStatus:message=>{$('network-status').textContent=message;},
      onReady:ready=>{
        if(host){
          $('invite-code').value=room.code;
          $('invite').hidden=false;
          if(ready){restart();publish();}
        }
        render();
      },
      onClose:()=>{pending=false;render();},
      onMessage:data=>{
        if(room.host){
          if(data.type==='move'&&data.revision===revision&&turn==='O'&&legal(data.index))place(data.index);
          else if(data.type==='restart'&&data.revision===revision&&ended){restart();publish();}
          else publish();
        } else if(data.type==='state'&&validState(data)&&data.revision>=revision){
          board=[...data.board];turn=data.turn;revision=data.revision;scores.online={...data.scores};ended=Boolean(outcome(board));pending=false;render();
        }
      }
    });
    revision=0;
    room.start(code,host);render();
  }
  function validState(data){return Array.isArray(data.board)&&data.board.length===9&&data.board.every(v=>v===null||v==='X'||v==='O')&&['X','O'].includes(data.turn)&&Number.isSafeInteger(data.revision)&&['X','O','draw'].every(k=>Number.isSafeInteger(data.scores?.[k])&&data.scores[k]>=0);}
  $('create-room').addEventListener('click',()=>{
    startRoom(createRoomCode(),true);
  });
  $('join-form').addEventListener('submit',event=>{
    event.preventDefault();const code=parseRoomCode($('room-code').value);
    if(!code){$('network-status').textContent='Введи код комнаты: 6 английских букв, например KMPWQZ.';return;}
    startRoom(code,false);
  });
  $('copy-code').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText($('invite-code').value);$('network-status').textContent='Код скопирован! Друг должен ввести его на сайте.';}
    catch{$('invite-code').select();$('network-status').textContent='Скопируй выделенный код и отправь другу.';}
  });
  $('leave-room').addEventListener('click',leave);
  $('restart').addEventListener('click',()=>{
    if(mode==='online'){
      if(!connected()||!ended)return;
      if(room.host){restart();publish();}else room.send({type:'restart',revision});
    }else restart();
  });
  $('reset').addEventListener('click',()=>{scores[mode]={X:0,O:0,draw:0};persist();restart();});
  window.addEventListener('pagehide',()=>room?.close());
  restart();
}

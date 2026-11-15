'use strict';
function createRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  // Rejection sampling keeps all letters equally likely.
  while (result.length < 6) {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    for (const byte of bytes) if (byte < 256 - (256 % alphabet.length) && result.length < 6) result += alphabet[byte % alphabet.length];
  }
  return result;
}
function parseRoomCode(value) {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{6}$/.test(code) ? code : null;
}
// Only the room creator accepts moves and broadcasts the authoritative board.
class OnlineRoom {
  constructor({onStatus, onReady, onMessage, onClose}) {
    Object.assign(this, {onStatus, onReady, onMessage, onClose});
    this.closed = false;
    this.ready = false;
    this.attempt = 0;
  }
  start(code, host) {
    this.host = host;
    this.code = code;
    this.onStatus(host ? 'Создаём комнату…' : 'Подключаемся к другу…');
    if (typeof Peer === 'undefined') { this.fail('Не загрузился модуль связи. Обнови страницу.'); return; }
    this.connect();
  }
  connect() {
    const {host, code} = this;
    const peer = this.peer = new Peer(host ? 'your-turn-v2-' + code : undefined, {secure:true});
    const current = () => !this.closed && this.peer === peer;
    this.timeout = setTimeout(() => {
      if (current()) this.retry('Сервер комнат не отвечает. Код ошибки: server-timeout.');
    }, 15000);
    peer.on('open', () => {
      if (!current()) return;
      if (host) {
        clearTimeout(this.timeout);
        this.onStatus('Комната создана. Отправь код другу и оставь страницу открытой.');
        this.onReady(false);
      } else this.attach(peer.connect('your-turn-v2-' + code, {reliable:true, serialization:'json'}));
    });
    peer.on('connection', connection => {
      if (!current()) { connection.close(); return; }
      if (!host || this.connection) {
        connection.on('open', () => { connection.send({type:'full'}); setTimeout(() => connection.close(), 200); });
        return;
      }
      this.attach(connection);
    });
    peer.on('error', error => {
      if (!current()) return;
      if (this.ready) {
        // The active DataConnection has its own close/error handlers.
        // Errors from a rejected third connection must not end the game.
        return;
      }
      if (error.type === 'peer-unavailable') this.fail('Комната не найдена. Проверь код: создатель должен оставить страницу открытой.');
      else if (error.type === 'unavailable-id' && host) { this.code=createRoomCode(); this.retry('Не удалось выбрать свободный код.'); }
      else if (['network','server-error','socket-error','socket-closed'].includes(error.type)) this.retry('Нет связи с сервером комнат. Код ошибки: '+error.type+'.');
      else this.fail('Не удалось подключиться. Код ошибки: '+(error.type || 'unknown')+'.');
    });
    peer.on('disconnected', () => { if (current() && !this.ready) this.retry('Связь с сервером комнат потеряна. Код ошибки: disconnected.'); });
  }
  retry(message) {
    if (this.closed) return;
    // Once negotiating a data channel, failure is distinct from server access.
    if (this.connection) { this.fail('Сервер доступен, но соединение игроков не установлено. Код ошибки: peer-timeout.'); return; }
    if (++this.attempt >= 3) { this.fail(message+' Попробуй другую сеть. Если ошибка повторяется, передай её создателю сайта.'); return; }
    clearTimeout(this.timeout);
    const previous = this.peer;
    this.peer = null;
    previous?.destroy();
    this.onStatus('Повторяем подключение к серверу… Попытка '+(this.attempt+1)+' из 3.');
    this.retryTimer = setTimeout(() => { if (!this.closed) this.connect(); }, 1500);
  }
  attach(connection) {
    this.connection = connection;
    if (this.host) this.timeout = setTimeout(() => this.fail('Друг не смог подключиться. Создайте новую комнату и попробуйте другую сеть.'), 25000);
    connection.on('open', () => {
      if (this.closed) return;
      clearTimeout(this.timeout);
      this.ready = true;
      this.onStatus('Вы на связи! ' + (this.host ? 'Ты играешь крестиками.' : 'Ты играешь ноликами.'));
      this.onReady(true);
    });
    connection.on('data', data => {
      if (this.closed || !data || typeof data !== 'object') return;
      if (data.type === 'full') { this.fail('В комнате уже есть два игрока. Создай другую комнату.'); return; }
      this.onMessage(data);
    });
    connection.on('close', () => { if (!this.closed) this.fail('Друг отключился. Для новой игры создайте комнату или войдите заново.'); });
    connection.on('error', () => { if (!this.closed) this.fail('Соединение прервано. Попробуйте войти заново.'); });
  }
  send(data) { if (this.ready && this.connection?.open) this.connection.send(data); }
  fail(message) { if (this.closed) return; this.close(); this.onStatus(message); this.onClose(); }
  close() { this.closed = true; this.ready = false; clearTimeout(this.timeout); clearTimeout(this.retryTimer); this.connection?.close(); this.peer?.destroy(); }
}
if (typeof module !== 'undefined') module.exports = {createRoomCode, parseRoomCode, OnlineRoom};

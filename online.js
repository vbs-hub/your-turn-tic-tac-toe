'use strict';
// Only the room creator accepts moves and broadcasts the authoritative board.
class OnlineRoom {
  constructor({onStatus, onReady, onMessage, onClose}) {
    Object.assign(this, {onStatus, onReady, onMessage, onClose});
    this.closed = false;
    this.ready = false;
  }
  start(code, host) {
    this.host = host;
    this.code = code;
    this.onStatus(host ? 'Создаём комнату…' : 'Подключаемся к другу…');
    if (typeof Peer === 'undefined') { this.fail('Не загрузился модуль связи. Обнови страницу.'); return; }
    this.peer = new Peer(host ? 'your-turn-' + code : undefined);
    this.timeout = setTimeout(() => this.fail('Не удалось соединиться. Проверь интернет, попробуй другую сеть и войди ещё раз.'), 25000);
    this.peer.on('open', () => {
      if (this.closed) return;
      if (host) {
        clearTimeout(this.timeout);
        this.onStatus('Комната создана. Отправь ссылку другу и оставь страницу открытой.');
        this.onReady(false);
      } else this.attach(this.peer.connect('your-turn-' + code, {reliable:true, serialization:'json'}));
    });
    this.peer.on('connection', connection => {
      if (!host || this.connection || this.closed) {
        connection.on('open', () => { connection.send({type:'full'}); setTimeout(() => connection.close(), 200); });
        return;
      }
      this.attach(connection);
    });
    this.peer.on('error', error => {
      if (this.closed || this.ready) return;
      this.fail(error.type === 'peer-unavailable' ? 'Комната не найдена. Попроси друга открыть комнату и проверь ссылку.' : error.type === 'unavailable-id' ? 'Этот код уже занят. Создай новую комнату.' : 'Ошибка связи. Проверь интернет и попробуй подключиться снова.');
    });
    this.peer.on('disconnected', () => { if (!this.closed && !this.ready) this.fail('Связь с сервером потеряна. Создай комнату или войди заново.'); });
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
  close() { this.closed = true; this.ready = false; clearTimeout(this.timeout); this.connection?.close(); this.peer?.destroy(); }
}

import { MSG, makeEnvelope } from "./protocol.js";

export class WebSocketTransport {
  constructor() {
    this.ws = null;
    this.listeners = {
      connected: [],
      disconnected: [],
      message: [],
      error: [],
    };
    this._seq = 0;
    this._heartbeatTimer = null;
    this._url = "";
    this._ticket = null;
  }

  on(event, cb) {
    if (this.listeners[event]) this.listeners[event].push(cb);
    return this;
  }

  _emit(event, ...args) {
    (this.listeners[event] || []).forEach((cb) => cb(...args));
  }

  async connectToRoom(url, ticket = {}) {
    this._url = url;
    this._ticket = ticket;
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
        this.ws.binaryType = "arraybuffer";
        this.ws.onopen = () => {
          this._startHeartbeat();
          this._emit("connected");
          resolve();
        };
        this.ws.onclose = () => {
          this._stopHeartbeat();
          this._emit("disconnected");
        };
        this.ws.onerror = (e) => {
          this._emit("error", -1, "WebSocket error");
          reject(e);
        };
        this.ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === MSG.PONG) return;
            this._emit("message", msg);
          } catch (e) {
            console.warn("Invalid WS message", e);
          }
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  disconnect() {
    this._stopHeartbeat();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  sendMessage(msg) {
    if (!this.isConnected()) return false;
    this._seq += 1;
    msg.seq = this._seq;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  poll() {}

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.sendMessage(makeEnvelope(MSG.PING));
      }
    }, 5000);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }
}

export class LocalTransport {
  constructor() {
    this.peer = null;
    this._queue = [];
    this._connected = false;
    this.listeners = { connected: [], disconnected: [], message: [], error: [] };
  }

  static createPair() {
    const a = new LocalTransport();
    const b = new LocalTransport();
    a.peer = b;
    b.peer = a;
    return [a, b];
  }

  on(event, cb) {
    if (this.listeners[event]) this.listeners[event].push(cb);
    return this;
  }

  _emit(event, ...args) {
    (this.listeners[event] || []).forEach((cb) => cb(...args));
  }

  connectToRoom() {
    this._connected = true;
    setTimeout(() => this._emit("connected"), 0);
  }

  disconnect() {
    this._connected = false;
    if (this.peer && this.peer._connected) {
      this.peer._connected = false;
      setTimeout(() => this.peer._emit("disconnected"), 0);
    }
    setTimeout(() => this._emit("disconnected"), 0);
  }

  isConnected() {
    return this._connected;
  }

  sendMessage(msg) {
    if (!this._connected || !this.peer) return;
    this.peer._queue.push(JSON.parse(JSON.stringify(msg)));
  }

  poll() {
    while (this._queue.length > 0) {
      const msg = this._queue.shift();
      this._emit("message", msg);
    }
  }
}

import { MSG, decodeMessage, encodePing, encodePong } from "./protocol.js";

export class WebSocketTransport {
  constructor(url) {
    this._url = url;
    this._ws = null;
    this._connected = false;
    this._queue = [];
    this._listeners = new Map();
    this._heartbeatTimer = null;
    this._lastPongAt = Date.now();
    this.onmessage = null;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
  }

  connect() {
    if (this._ws && this._ws.readyState <= WebSocket.OPEN) return;
    this._ws = new WebSocket(this._url);
    this._ws.binaryType = "arraybuffer";
    this._ws.onopen = () => {
      this._connected = true;
      this._lastPongAt = Date.now();
      this._flushQueue();
      this._startHeartbeat();
      if (this.onopen) this.onopen();
      this._emit("connected");
    };
    this._ws.onmessage = (ev) => this._handleMessage(ev.data);
    this._ws.onclose = () => {
      this._connected = false;
      this._stopHeartbeat();
      if (this.onclose) this.onclose();
      this._emit("disconnected");
    };
    this._ws.onerror = (e) => {
      if (this.onerror) this.onerror(e.message || "ws error", -1);
      this._emit("error", -1, e.message || "ws error");
    };
  }

  _handleMessage(raw) {
    if (raw instanceof ArrayBuffer) {
      if (raw.byteLength < 1) return;
      const dv = new DataView(raw);
      const type = dv.getUint8(0);
      if (type === MSG.PONG) { this._lastPongAt = Date.now(); return; }
      if (type === MSG.PING) { this._sendRaw(encodePong()); return; }
      const decoded = decodeMessage(raw);
      if (!decoded) return;
      if (this.onmessage) this.onmessage(decoded);
      this._emit("message", decoded);
      return;
    }
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed === "pong") { this._lastPongAt = Date.now(); return; }
      if (trimmed === "ping") { this._sendRaw("pong"); return; }
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const obj = JSON.parse(trimmed);
          if (this.onmessage) this.onmessage(obj);
          this._emit("message", obj);
          return;
        } catch {}
      }
    }
  }

  sendBinary(ab) { this._sendRaw(ab); }

  sendMessage(msg) {
    if (msg instanceof ArrayBuffer) { this._sendRaw(msg); return; }
    if (msg && msg._binary instanceof ArrayBuffer) { this._sendRaw(msg._binary); return; }
    if (msg && msg.payload instanceof ArrayBuffer) { this._sendRaw(msg.payload); return; }
    if (msg && typeof msg === "object") {
      this._sendRaw(JSON.stringify(msg));
      return;
    }
    if (typeof msg === "string") this._sendRaw(msg);
  }

  _sendRaw(data) {
    if (!this._connected) { this._queue.push(data); return; }
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    try { this._ws.send(data); } catch {}
  }

  _flushQueue() {
    while (this._queue.length) {
      const d = this._queue.shift();
      this._sendRaw(d);
    }
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (!this._connected) return;
      const now = Date.now();
      if (now - this._lastPongAt > 20000) {
        try { this._ws.close(); } catch {}
        return;
      }
      this._sendRaw(encodePing());
    }, 8000);
  }

  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
  }

  off(event, fn) {
    const set = this._listeners.get(event);
    if (set) set.delete(fn);
  }

  _emit(event, ...args) {
    const set = this._listeners.get(event);
    if (set) for (const fn of set) fn(...args);
  }

  disconnect() {
    this._stopHeartbeat();
    if (this._ws) {
      try { this._ws.close(); } catch {}
      this._ws = null;
    }
    this._connected = false;
  }

  isConnected() { return this._connected; }

  poll() {}
}

import {
  MSG, PROTOCOL_VERSION, SIMULATION_VERSION,
  decodeMessage, validateLaunchCommand, validateInputFrame,
  encodeWelcome, encodeError, encodeLaunchWindow, encodeLaunchBoth,
  encodeInputBatch, encodePong, encodeResult, encodeRoomState,
  encodeReplayAck, encodeHashCheck,
} from "./protocol";

type Attachment = {
  slot: number;
  name: string;
  ready: boolean;
  launched: boolean;
};

type PersistedBattle = {
  roomId: string;
  arenaId: string;
  seed: number;
  created: number;
  started: boolean;
  finished: boolean;
  launchCmds: Record<number, any>;
  result: any;
  idleDeadline: number;
};

const STORAGE_KEY = "battle";
const IDLE_TIMEOUT_MS = 60_000;
const ALARM_BUFFER_MS = 5_000;
const DEFAULT_ARENA = "standard";

export class BattleRoom {
  state: DurableObjectState;
  env: any;
  battle: PersistedBattle;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.battle = this._defaultBattle("");
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage?.get<PersistedBattle>(STORAGE_KEY);
      if (stored) this.battle = stored;
    });
  }

  _defaultBattle(roomId: string): PersistedBattle {
    return {
      roomId,
      arenaId: DEFAULT_ARENA,
      seed: Math.floor(Math.random() * 0xffffffff),
      created: Date.now(),
      started: false,
      finished: false,
      launchCmds: {},
      result: null,
      idleDeadline: 0,
    };
  }

  async _persist(): Promise<void> {
    await this.state.storage?.put(STORAGE_KEY, this.battle);
  }

  async _scheduleIdleAlarm(): Promise<void> {
    const live = this.state.getWebSockets().length > 0;
    if (live) {
      this.battle.idleDeadline = 0;
      await this.state.storage?.deleteAlarm();
    } else {
      this.battle.idleDeadline = Date.now() + IDLE_TIMEOUT_MS;
      await this.state.storage?.setAlarm(this.battle.idleDeadline + ALARM_BUFFER_MS);
    }
    await this._persist();
  }

  async alarm(): Promise<void> {
    if (Date.now() >= this.battle.idleDeadline) {
      const all = this.state.getWebSockets();
      for (const ws of all) {
        try { ws.close(); } catch {}
      }
      await this.state.storage?.deleteAll();
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/init") {
      const body = await request.json().catch(() => null) as { roomId?: string } | null;
      if (body?.roomId) {
        this.battle = this._defaultBattle(body.roomId);
        await this._persist();
      }
      return new Response(null, { status: 204 });
    }

    if (url.pathname.endsWith("/ws")) {
      return this._handleWebSocket(request);
    }

    if (url.pathname.endsWith("/status")) {
      const players = this.state.getWebSockets().map((ws) => {
        const att = ws.deserializeAttachment() as Attachment | null;
        return att ? { slot: att.slot, name: att.name, ready: att.ready } : null;
      });
      return new Response(
        JSON.stringify({
          roomId: this.battle.roomId,
          started: this.battle.started,
          finished: this.battle.finished,
          players,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Not found", { status: 404 });
  }

  async _handleWebSocket(request: Request): Promise<Response> {
    const url = new URL(request.url);

    const existingAttachments = this.state.getWebSockets()
      .map((ws) => ws.deserializeAttachment() as Attachment | null)
      .filter((a): a is Attachment => a !== null);

    const occupied = new Set(existingAttachments.map((a) => a.slot));
    const slotParam = url.searchParams.get("slot");
    let requestedSlot: number;
    if (slotParam != null) {
      requestedSlot = parseInt(slotParam);
    } else {
      requestedSlot = occupied.has(0) ? (occupied.has(1) ? -1 : 1) : 0;
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.state.acceptWebSocket(server);

    if (requestedSlot < 0 || requestedSlot > 1 || occupied.has(requestedSlot)) {
      server.send(encodeError(400, "Slot unavailable"));
      server.close(1008, "Slot unavailable");
      return new Response(null, { status: 101, webSocket: client });
    }

    const name = url.searchParams.get("name") || `Player${requestedSlot + 1}`;
    const attachment: Attachment = {
      slot: requestedSlot,
      name,
      ready: false,
      launched: false,
    };
    server.serializeAttachment(attachment);

    server.send(encodeWelcome(requestedSlot, this.battle.seed, this.battle.arenaId, Date.now()));

    await this._broadcastSystem();
    await this._scheduleIdleAlarm();

    return new Response(null, { status: 101, webSocket: client });
  }

  _forEachSession(fn: (ws: WebSocket, att: Attachment) => void): void {
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att) fn(ws, att);
    }
  }

  _findWsBySlot(slot: number): WebSocket | null {
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att && att.slot === slot) return ws;
    }
    return null;
  }

  _sendBinary(ws: WebSocket, data: ArrayBuffer): void {
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    } catch (e) {
      console.error("Send error", e);
    }
  }

  async _broadcastSystem(): Promise<void> {
    const players: Array<{ name: string; ready: boolean } | null> = [null, null];
    this._forEachSession((_ws, att) => {
      players[att.slot] = { name: att.name, ready: att.ready };
    });
    const msg = encodeRoomState(this.battle.started, this.battle.finished, players);
    for (const ws of this.state.getWebSockets()) {
      this._sendBinary(ws, msg);
    }
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;

    let buf: ArrayBuffer;
    if (typeof message === "string") {
      buf = new TextEncoder().encode(message).buffer as ArrayBuffer;
    } else {
      buf = message;
    }

    const decoded = decodeMessage(buf);
    if (!decoded) return;
    const { type, data } = decoded;

    let stateChanged = false;

    switch (type) {
      case MSG.PING:
        this._sendBinary(ws, encodePong());
        break;

      case MSG.HELLO:
        break;

      case MSG.READY:
        att.ready = true;
        ws.serializeAttachment(att);
        stateChanged = true;
        await this._broadcastSystem();
        await this._tryStart();
        break;

      case MSG.LAUNCH:
        if (this.battle.started && !att.launched) {
          if (validateLaunchCommand(data)) {
            this.battle.launchCmds[att.slot] = data;
            att.launched = true;
            ws.serializeAttachment(att);
            stateChanged = true;
            const keys = Object.keys(this.battle.launchCmds);
            if (keys.length === 2) {
              const p0 = this.battle.launchCmds[0];
              const p1 = this.battle.launchCmds[1];
              this._forEachSession((w, a) => {
                const own = a.slot === 0 ? p0 : p1;
                const opp = a.slot === 0 ? p1 : p0;
                this._sendBinary(w, encodeLaunchBoth(
                  { p: own.p, h: own.h, d: own.d, a: own.a },
                  { p: opp.p, h: opp.h, d: opp.d, a: opp.a },
                ));
              });
            }
          } else {
            this._sendBinary(ws, encodeError(400, "Invalid launch command"));
          }
        }
        break;

      case MSG.INPUT:
        if (this.battle.started && !this.battle.finished) {
          const frames: any[] = Array.isArray(data?.frames) ? data.frames : [];
          const validFrames: any[] = [];
          for (const f of frames) {
            if (validateInputFrame(f)) validFrames.push(f);
          }
          if (validFrames.length > 0) {
            await this._relayInputs(att.slot, validFrames, ws);
          }
        }
        break;

      case MSG.HASH_CHECK:
        await this._relayHashCheck(att.slot, data);
        break;

      case MSG.REPLAY_SUBMIT:
        await this._handleReplaySubmit(ws, att.slot, data);
        break;
    }

    if (stateChanged) {
      await this._persist();
    }
  }

  async _tryStart(): Promise<void> {
    const slots: Attachment[] = [];
    this._forEachSession((_ws, att) => { slots[att.slot] = att; });
    if (slots[0]?.ready && slots[1]?.ready && !this.battle.started) {
      this.battle.started = true;
      await this._persist();
      const msg = encodeLaunchWindow(15000, this.battle.seed, this.battle.arenaId);
      for (const ws of this.state.getWebSockets()) this._sendBinary(ws, msg);
    }
  }

  async _relayInputs(senderSlot: number, frames: any[], senderWs: WebSocket): Promise<void> {
    const otherWs = this._findWsBySlot(1 - senderSlot);
    if (!otherWs) return;
    const msg = encodeInputBatch(senderSlot, frames);
    this._sendBinary(otherWs, msg);
  }

  async _relayHashCheck(senderSlot: number, data: any): Promise<void> {
    const other = this._findWsBySlot(1 - senderSlot);
    if (other) {
      const frame = data?.frame | 0;
      const hash = String(data?.hash || "");
      this._sendBinary(other, encodeHashCheck(frame, hash));
    }
  }

  async _handleReplaySubmit(ws: WebSocket, slot: number, data: any): Promise<void> {
    const replayId = `${this.battle.roomId}_${slot}_${Date.now()}`;
    try {
      const json = typeof data === "string" ? data : JSON.stringify(data || {});
      await this.env.REPLAYS?.put(`replays/${replayId}.json`, json);
      this._sendBinary(ws, encodeReplayAck(replayId, true));
    } catch (e) {
      this._sendBinary(ws, encodeReplayAck(replayId, false, String(e)));
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att && this.battle.started && !this.battle.finished) {
      this.battle.finished = true;
      const winnerSlot = 1 - att.slot;
      this.battle.result = { winner: winnerSlot, reason: "disconnect" };
      await this._persist();
      const msg = encodeResult(winnerSlot, "disconnect");
      for (const w of this.state.getWebSockets()) this._sendBinary(w, msg);
    }
    await this._broadcastSystem();
    await this._scheduleIdleAlarm();
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    try { ws.close(); } catch {}
  }
}

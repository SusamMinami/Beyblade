import { MSG, makeEnvelope, validateLaunchCommand, validateInputFrame, errorResponse, PROTOCOL_VERSION, SIMULATION_VERSION } from "./protocol";

type Attachment = {
  slot: number;
  name: string;
  ready: boolean;
  launched: boolean;
  seq: number;
};

type PersistedBattle = {
  roomId: string;
  mode: string;
  arenaId: string;
  seed: number;
  created: number;
  started: boolean;
  finished: boolean;
  launchCmds: Record<number, any>;
  lastFrame: number;
  result: any;
  idleDeadline: number;
};

const STORAGE_KEY = "battle";
const IDLE_TIMEOUT_MS = 60_000;
const ALARM_BUFFER_MS = 5_000;

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
      mode: "frame_sync",
      arenaId: "standard",
      seed: Math.floor(Math.random() * 0xffffffff),
      created: Date.now(),
      started: false,
      finished: false,
      launchCmds: {},
      lastFrame: 0,
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
    const slotParam = url.searchParams.get("slot");

    const existingAttachments = this.state.getWebSockets()
      .map((ws) => ws.deserializeAttachment() as Attachment | null)
      .filter((a): a is Attachment => a !== null);

    const occupied = new Set(existingAttachments.map((a) => a.slot));
    let requestedSlot: number;
    if (slotParam != null) {
      requestedSlot = parseInt(slotParam);
    } else {
      requestedSlot = occupied.has(0) ? (occupied.has(1) ? -1 : 1) : 0;
    }
    if (requestedSlot < 0 || requestedSlot > 1 || occupied.has(requestedSlot)) {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      this.state.acceptWebSocket(server);
      server.send(JSON.stringify(errorResponse(400, "Slot unavailable")));
      server.close(1008, "Slot unavailable");
      return new Response(null, { status: 101, webSocket: client });
    }

    const name = url.searchParams.get("name") || `Player${requestedSlot + 1}`;
    const attachment: Attachment = {
      slot: requestedSlot,
      name,
      ready: false,
      launched: false,
      seq: 0,
    };

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.state.acceptWebSocket(server);
    server.serializeAttachment(attachment);

    server.send(JSON.stringify(makeEnvelope(MSG.WELCOME, {
      slot: requestedSlot,
      protocol_version: PROTOCOL_VERSION,
      simulation_version: SIMULATION_VERSION,
      seed: this.battle.seed,
      arena_id: this.battle.arenaId,
      server_time: Date.now(),
    })));

    await this._broadcastSystem();
    await this._scheduleIdleAlarm();

    return new Response(null, { status: 101, webSocket: client });
  }

  _findWsBySlot(slot: number): WebSocket | null {
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att && att.slot === slot) return ws;
    }
    return null;
  }

  _forEachSession(fn: (ws: WebSocket, att: Attachment) => void): void {
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att) fn(ws, att);
    }
  }

  _send(ws: WebSocket, msg: unknown): void {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    } catch (e) {
      console.error("Send error", e);
    }
  }

  async _broadcast(msg: unknown): Promise<void> {
    const raw = JSON.stringify(msg);
    const all = this.state.getWebSockets();
    for (const ws of all) {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(raw);
      } catch {}
    }
  }

  async _broadcastSystem(): Promise<void> {
    const players: Array<{ slot: number; name: string; ready: boolean } | null> = [null, null];
    this._forEachSession((_ws, att) => {
      players[att.slot] = { slot: att.slot, name: att.name, ready: att.ready };
    });
    await this._broadcast({
      type: "room_state",
      data: {
        started: this.battle.started,
        players,
      },
    });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;

    let msg: any;
    try {
      const text = typeof message === "string" ? message : new TextDecoder().decode(message);
      msg = JSON.parse(text);
    } catch (e) {
      console.error("Parse error", e);
      return;
    }

    const { type, data } = msg;
    let stateChanged = false;

    switch (type) {
      case MSG.PING:
        this._send(ws, makeEnvelope(MSG.PONG, {}));
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
              await this._broadcast(makeEnvelope(MSG.LAUNCH_BOTH, { player: p0, enemy: p1 }));
            }
          } else {
            this._send(ws, errorResponse(400, "Invalid launch command"));
          }
        }
        break;

      case MSG.INPUT:
        if (this.battle.started && !this.battle.finished) {
          const frames: any[] = Array.isArray(data?.frames) ? data.frames : [];
          const validFrames: any[] = [];
          for (const f of frames) {
            if (validateInputFrame(f)) {
              validFrames.push(f);
            }
          }
          if (validFrames.length > 0) {
            await this._relayInputs(att.slot, validFrames);
          }
        }
        break;

      case MSG.HASH_CHECK:
        await this._relayHashCheck(ws, att.slot, data);
        break;

      case MSG.REPLAY_SUBMIT:
        await this._handleReplaySubmit(ws, data);
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
      await this._broadcast(makeEnvelope(MSG.LAUNCH_WINDOW, {
        window_ms: 15000,
        seed: this.battle.seed,
        arena_id: this.battle.arenaId,
      }));
    }
  }

  async _relayInputs(_senderSlot: number, frames: any[]): Promise<void> {
    const envelope = makeEnvelope(MSG.INPUT_BATCH, { frames });
    await this._broadcast(envelope);
  }

  async _relayHashCheck(senderWs: WebSocket, senderSlot: number, data: any): Promise<void> {
    const other = this._findWsBySlot(1 - senderSlot);
    if (other) {
      this._send(other, makeEnvelope(MSG.HASH_CHECK, data));
    }
  }

  async _handleReplaySubmit(ws: WebSocket, data: any): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att) return;
    const replayId = `${this.battle.roomId}_${att.slot}_${Date.now()}`;
    try {
      await this.env.REPLAYS?.put(`replays/${replayId}.json`, JSON.stringify(data));
      this._send(ws, makeEnvelope(MSG.REPLAY_ACK, { replay_id: replayId, accepted: true }));
    } catch (e) {
      this._send(ws, makeEnvelope(MSG.REPLAY_ACK, { replay_id: replayId, accepted: false, error: String(e) }));
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att && this.battle.started && !this.battle.finished) {
      this.battle.finished = true;
      this.battle.result = { winner: 1 - att.slot, reason: "disconnect" };
      await this._persist();
      await this._broadcast(makeEnvelope(MSG.RESULT, this.battle.result));
    }
    await this._broadcastSystem();
    await this._scheduleIdleAlarm();
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    try { ws.close(); } catch {}
  }
}

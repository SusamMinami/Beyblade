import { MSG, makeEnvelope, validateLaunchCommand, validateInputFrame, errorResponse } from "./protocol";

type Session = {
  ws: WebSocket;
  slot: number;
  name: string;
  ready: boolean;
  launched: boolean;
  seq: number;
  inputBuffer: any[];
};

type BattleState = {
  roomId: string;
  mode: string;
  arenaId: string;
  seed: number;
  created: number;
  started: boolean;
  finished: boolean;
  players: (Session | null)[];
  launchCmds: Record<number, any>;
  lastFrame: number;
  result: any;
  idleTimeout: any;
};

export class BattleRoom {
  state: DurableObjectState;
  env: any;
  sessions: Map<WebSocket, Session>;
  battle: BattleState;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.battle = this._createEmptyState();
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage?.get("battle");
      if (stored) this.battle = stored as BattleState;
    });
  }

  _createEmptyState(): BattleState {
    return {
      roomId: "",
      mode: "frame_sync",
      arenaId: "standard",
      seed: Math.floor(Math.random() * 0xffffffff),
      created: Date.now(),
      started: false,
      finished: false,
      players: [null, null],
      launchCmds: {},
      lastFrame: 0,
      result: null,
      idleTimeout: null,
    };
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/ws")) {
      return this._handleWebSocket(request);
    }
    if (url.pathname.endsWith("/status")) {
      return new Response(
        JSON.stringify({
          roomId: this.battle.roomId,
          started: this.battle.started,
          finished: this.battle.finished,
          players: this.battle.players.map((p) => (p ? { slot: p.slot, name: p.name, ready: p.ready } : null)),
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response("Not found", { status: 404 });
  }

  async _handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.accept();

    const slotParam = new URL(request.url).searchParams.get("slot");
    const requestedSlot = slotParam ? parseInt(slotParam) : this._findEmptySlot();
    if (requestedSlot < 0 || requestedSlot > 1 || this.battle.players[requestedSlot]) {
      server.send(JSON.stringify(errorResponse(400, "Slot unavailable")));
      server.close(1008, "Slot unavailable");
      return new Response(null, { status: 101, webSocket: client });
    }

    const name = new URL(request.url).searchParams.get("name") || `Player${requestedSlot + 1}`;
    const session: Session = {
      ws: server,
      slot: requestedSlot,
      name,
      ready: false,
      launched: false,
      seq: 0,
      inputBuffer: [],
    };
    this.battle.players[requestedSlot] = session;
    this.sessions.set(server, session);

    server.addEventListener("message", async (ev) => {
      try {
        const msg = JSON.parse(typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data));
        await this._onMessage(session, msg);
      } catch (e) {
        console.error("Message error", e);
      }
    });

    server.addEventListener("close", () => this._removeSession(session));
    server.addEventListener("error", () => this._removeSession(session));

    server.send(JSON.stringify(makeEnvelope(MSG.WELCOME, {
      slot: requestedSlot,
      protocol_version: 1,
      simulation_version: "2026.07.21-web-v2",
      seed: this.battle.seed,
      arena_id: this.battle.arenaId,
      server_time: Date.now(),
    })));

    this._broadcastSystem();
    this._resetIdleTimer();

    return new Response(null, { status: 101, webSocket: client });
  }

  _findEmptySlot(): number {
    if (!this.battle.players[0]) return 0;
    if (!this.battle.players[1]) return 1;
    return -1;
  }

  async _onMessage(session: Session, msg: any): Promise<void> {
    const { type, data } = msg;
    switch (type) {
      case MSG.PING:
        this._send(session, makeEnvelope(MSG.PONG, {}));
        break;
      case MSG.HELLO:
        break;
      case MSG.READY:
        session.ready = true;
        this._broadcastSystem();
        this._tryStart();
        break;
      case MSG.LAUNCH:
        if (this.battle.started && !session.launched) {
          if (validateLaunchCommand(data)) {
            this.battle.launchCmds[session.slot] = data;
            session.launched = true;
            const keys = Object.keys(this.battle.launchCmds);
            if (keys.length === 2) {
              const p0 = this.battle.launchCmds[0];
              const p1 = this.battle.launchCmds[1];
              this._broadcast(makeEnvelope(MSG.LAUNCH_BOTH, { player: p0, enemy: p1 }));
            }
          } else {
            this._send(session, errorResponse(400, "Invalid launch command"));
          }
        }
        break;
      case MSG.INPUT:
        if (this.battle.started && !this.battle.finished) {
          const frames: any[] = Array.isArray(data.frames) ? data.frames : [];
          for (const f of frames) {
            if (validateInputFrame(f)) {
              session.inputBuffer.push(f);
            }
          }
          this._relayInputs();
        }
        break;
      case MSG.HASH_CHECK:
        this._relayHashCheck(session, data);
        break;
      case MSG.REPLAY_SUBMIT:
        await this._handleReplaySubmit(session, data);
        break;
    }
  }

  _tryStart(): void {
    const [p0, p1] = this.battle.players;
    if (p0?.ready && p1?.ready && !this.battle.started) {
      this.battle.started = true;
      this._broadcast(makeEnvelope(MSG.LAUNCH_WINDOW, {
        window_ms: 15000,
        seed: this.battle.seed,
        arena_id: this.battle.arenaId,
      }));
    }
  }

  _relayInputs(): void {
    const [p0, p1] = this.battle.players;
    if (!p0 || !p1) return;
    const allFrames: any[] = [];
    while (p0.inputBuffer.length > 0 || p1.inputBuffer.length > 0) {
      if (p0.inputBuffer.length > 0) allFrames.push(p0.inputBuffer.shift());
      if (p1.inputBuffer.length > 0) allFrames.push(p1.inputBuffer.shift());
    }
    if (allFrames.length > 0) {
      this._broadcast(makeEnvelope(MSG.INPUT_BATCH, { frames: allFrames }));
    }
  }

  _relayHashCheck(sender: Session, data: any): void {
    const other = this.battle.players.find((p) => p && p !== sender);
    if (other) {
      this._send(other, makeEnvelope(MSG.HASH_CHECK, data));
    }
  }

  async _handleReplaySubmit(session: Session, data: any): Promise<void> {
    const replayId = `${this.battle.roomId}_${session.slot}_${Date.now()}`;
    try {
      await this.env.REPLAYS?.put(`replays/${replayId}.json`, JSON.stringify(data));
      this._send(session, makeEnvelope(MSG.REPLAY_ACK, { replay_id: replayId, accepted: true }));
    } catch (e) {
      this._send(session, makeEnvelope(MSG.REPLAY_ACK, { replay_id: replayId, accepted: false, error: String(e) }));
    }
  }

  _send(session: Session, msg: any): void {
    try {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(JSON.stringify(msg));
      }
    } catch (e) {
      console.error("Send error", e);
    }
  }

  _broadcast(msg: any): void {
    const raw = JSON.stringify(msg);
    for (const [ws] of this.sessions) {
      try {
        if (ws.readyState === WebSocket.OPEN) ws.send(raw);
      } catch {}
    }
  }

  _broadcastSystem(): void {
    const [p0, p1] = this.battle.players;
    this._broadcast({
      type: "room_state",
      data: {
        started: this.battle.started,
        players: [
          p0 ? { slot: 0, name: p0.name, ready: p0.ready } : null,
          p1 ? { slot: 1, name: p1.name, ready: p1.ready } : null,
        ],
      },
    });
  }

  _removeSession(session: Session): void {
    this.sessions.delete(session.ws);
    if (this.battle.players[session.slot] === session) {
      this.battle.players[session.slot] = null;
    }
    try {
      session.ws.close();
    } catch {}
    this._broadcastSystem();
    if (this.battle.started && !this.battle.finished) {
      this._broadcast(makeEnvelope(MSG.RESULT, { winner: 1 - session.slot, reason: "disconnect" }));
      this.battle.finished = true;
    }
    this._resetIdleTimer();
  }

  _resetIdleTimer(): void {
    if (this.battle.idleTimeout) clearTimeout(this.battle.idleTimeout);
    const empty = this.battle.players.every((p) => p === null);
    if (empty) {
      this.battle.idleTimeout = setTimeout(() => {
        for (const [ws] of this.sessions) {
          try { ws.close(); } catch {}
        }
        this.state.storage?.deleteAll();
      }, 60000);
    }
  }
}

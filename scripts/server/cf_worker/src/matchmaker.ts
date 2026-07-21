import { MSG, jsonResponse } from "./protocol";

type QueueEntry = {
  playerId: string;
  name: string;
  rank: string;
  rating: number;
  mode: string;
  enqueuedAt: number;
};

export class Matchmaker {
  state: DurableObjectState;
  env: any;
  queue: QueueEntry[];
  pendingMatches: Map<string, { a: QueueEntry; b: QueueEntry; roomId: string; created: number }>;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.queue = [];
    this.pendingMatches = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    const body = await request.json().catch(() => ({}));
    const action = url.pathname.split("/").pop();

    switch (action) {
      case "enqueue":
        return this._enqueue(body);
      case "status":
        return this._status(body);
      case "cancel":
        return this._cancel(body);
      default:
        return new Response("Not found", { status: 404 });
    }
  }

  async _enqueue(body: any): Promise<Response> {
    const entry: QueueEntry = {
      playerId: String(body.player_id || crypto.randomUUID()),
      name: String(body.name || "Anonymous"),
      rank: String(body.rank || "bronze"),
      rating: Number(body.rating || 1000),
      mode: String(body.mode || "frame_sync"),
      enqueuedAt: Date.now(),
    };
    this.queue = this.queue.filter((p) => p.playerId !== entry.playerId);
    this.queue.push(entry);
    const match = this._tryMatch(entry);
    if (match) {
      return jsonResponse({ status: "matched", ...match });
    }
    return jsonResponse({ status: "queued", position: this.queue.length, wait_ms: 0 });
  }

  _tryMatch(entry: QueueEntry): any {
    for (let i = 0; i < this.queue.length; i++) {
      const opponent = this.queue[i];
      if (opponent.playerId === entry.playerId) continue;
      if (opponent.rank !== entry.rank) continue;
      if (opponent.mode !== entry.mode) continue;
      if (Math.abs(opponent.rating - entry.rating) > 200) continue;
      this.queue.splice(i, 1);
      this.queue = this.queue.filter((p) => p.playerId !== entry.playerId);
      const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      return {
        room_id: roomId,
        opponent: { name: opponent.name, rating: opponent.rating },
        self_slot: Math.random() < 0.5 ? 0 : 1,
        ws_url: `/room/${roomId}/ws`,
      };
    }
    return null;
  }

  async _status(body: any): Promise<Response> {
    const pid = String(body.player_id || "");
    const inQueue = this.queue.some((p) => p.playerId === pid);
    return jsonResponse({ in_queue: inQueue, queue_size: this.queue.length });
  }

  async _cancel(body: any): Promise<Response> {
    const pid = String(body.player_id || "");
    this.queue = this.queue.filter((p) => p.playerId !== pid);
    return jsonResponse({ cancelled: true });
  }
}

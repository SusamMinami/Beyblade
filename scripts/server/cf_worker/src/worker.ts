import { BattleRoom } from "./battle_room";
import { Matchmaker } from "./matchmaker";
import { jsonResponse } from "./protocol";

export { BattleRoom, Matchmaker };

interface Env {
  BATTLE_ROOM: DurableObjectNamespace;
  MATCHMAKER: DurableObjectNamespace;
  REPLAYS: R2Bucket;
  ENVIRONMENT: string;
}

function genRoomId(): string {
  return `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function roomIdFromName(name: string): string {
  return name;
}

async function routeApi(path: string[], request: Request, env: Env): Promise<Response> {
  if (path[0] === "health") {
    return jsonResponse({ status: "ok", time: Date.now() });
  }

  if (path[0] === "match") {
    const id = env.MATCHMAKER.idFromName("global");
    const stub = env.MATCHMAKER.get(id);
    const url = new URL(request.url);
    return stub.fetch(new URL(`/match/${path[1] || ""}`, url.origin), request);
  }

  if (path[0] === "room" && path[1]) {
    const roomId = roomIdFromName(path[1]);
    const id = env.BATTLE_ROOM.idFromName(roomId);
    const stub = env.BATTLE_ROOM.get(id);
    const url = new URL(request.url);
    return stub.fetch(new URL(`/room/${path.slice(2).join("/") || ""}`, url.origin), request);
  }

  if (path[0] === "create-room") {
    const roomId = genRoomId();
    const id = env.BATTLE_ROOM.idFromName(roomId);
    const stub = env.BATTLE_ROOM.get(id);
    await stub.fetch(new URL("https://dummy/init", request.url).toString(), {
      method: "POST",
      body: JSON.stringify({ roomId }),
    });
    return jsonResponse({ room_id: roomId, ws_url: `/room/${roomId}/ws` });
  }

  if (path[0] === "submit-replay" && request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body) return new Response("Bad request", { status: 400 });
    const replayId = `replay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await env.REPLAYS.put(`${replayId}.json`, JSON.stringify(body));
    return jsonResponse({ replay_id: replayId, accepted: true });
  }

  return new Response("API not found", { status: 404 });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      }
      const url = new URL(request.url);
      if (url.pathname === "/") {
        return new Response(
          `Beyblade Battle Server
Environment: ${env.ENVIRONMENT}
Endpoints:
  POST /api/match/enqueue      - Join matchmaking
  POST /api/create-room        - Create private room
  GET  /api/room/:id/ws        - WebSocket frame sync
  POST /api/submit-replay      - Submit async replay
  GET  /health                 - Health check`,
          { headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" } }
        );
      }
      if (url.pathname.startsWith("/api/")) {
        return routeApi(url.pathname.replace(/^\/api\//, "").split("/").filter(Boolean), request, env);
      }
      if (url.pathname.startsWith("/room/")) {
        const parts = url.pathname.split("/").filter(Boolean);
        const roomId = parts[1];
        if (roomId) {
          const id = env.BATTLE_ROOM.idFromName(roomId);
          const stub = env.BATTLE_ROOM.get(id);
          return stub.fetch(new URL(url.pathname + url.search, url.origin).toString(), request);
        }
      }
      return new Response("Not found", { status: 404 });
    } catch (err: any) {
      console.error("Worker error", err);
      return new Response(`Server error: ${err?.message || err}`, { status: 500 });
    }
  },
};

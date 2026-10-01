// Retro Rack relay: a tiny Cloudflare Worker that passes messages between the two players in a room.
// It never runs the game itself; each browser checks every shot on its own.
import { DurableObject } from "cloudflare:workers";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]{3,12})$/);
    if (!m) {
      return new Response("Retro Rack relay is running.", { headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("This address expects a WebSocket connection.", { status: 426 });
    }
    const room = env.ROOMS.get(env.ROOMS.idFromName(m[1].toUpperCase()));
    return room.fetch(request);
  },
};

// One Durable Object per room. Uses the WebSocket Hibernation API, so an idle room costs nothing.
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // keep-alive pings are answered without waking the room up
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  live(except) {
    return this.ctx.getWebSockets()
      .filter(ws => ws !== except)
      .map(ws => ({ ws, a: ws.deserializeAttachment() || {} }))
      .filter(s => s.a.seat === 0 || s.a.seat === 1);
  }

  async fetch(request) {
    const url = new URL(request.url);
    const cid = (url.searchParams.get("cid") || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 32) || crypto.randomUUID();
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);

    let others = this.live(server);
    // the same browser tab reconnecting replaces its old connection and keeps its seat
    let seat = -1;
    for (const s of others) if (s.a.cid === cid) { seat = s.a.seat; s.ws.serializeAttachment({ cid, seat: -1 }); try { s.ws.close(4000, "replaced"); } catch (e) {} }
    others = others.filter(s => s.a.cid !== cid);
    const taken = new Set(others.map(s => s.a.seat));
    const seats = (await this.ctx.storage.get("seats")) || {};
    if (seat < 0) for (const k of [0, 1]) if (seats[k] === cid && !taken.has(k)) seat = k;
    if (seat < 0) for (const k of [0, 1]) if (!taken.has(k)) { seat = k; break; }

    if (seat < 0) {
      server.serializeAttachment({ cid, seat: -1 });
      server.send(JSON.stringify({ t: "full" }));
      server.close(4001, "room full");
      return new Response(null, { status: 101, webSocket: client });
    }
    server.serializeAttachment({ cid, seat });
    seats[seat] = cid;
    await this.ctx.storage.put("seats", seats);
    await this.ctx.storage.deleteAlarm();
    server.send(JSON.stringify({ t: "welcome", seat, peer: others.length > 0 }));
    for (const s of others) { try { s.ws.send(JSON.stringify({ t: "peer", on: true })); } catch (e) {} }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    if (typeof message !== "string" || message.length > 20000) return;
    const a = ws.deserializeAttachment() || {};
    if (a.seat !== 0 && a.seat !== 1) return;
    let o;
    try { o = JSON.parse(message); } catch (e) { return; }
    if (!o || typeof o.t !== "string") return;
    o.from = a.seat;
    const out = JSON.stringify(o);
    for (const s of this.live(ws)) if (s.a.seat !== a.seat) { try { s.ws.send(out); } catch (e) {} }
  }

  async webSocketClose(ws, code, reason) {
    await this.gone(ws);
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, "closing"); } catch (e) {}
  }

  async webSocketError(ws) { await this.gone(ws); }

  async gone(ws) {
    const a = ws.deserializeAttachment() || {};
    const rest = this.live(ws);
    if ((a.seat === 0 || a.seat === 1) && !rest.some(s => s.a.seat === a.seat)) {
      for (const s of rest) { try { s.ws.send(JSON.stringify({ t: "peer", on: false })); } catch (e) {} }
    }
    if (!rest.length) await this.ctx.storage.setAlarm(Date.now() + 6 * 60 * 60 * 1000);
  }

  // tidy up rooms nobody has used for six hours
  async alarm() {
    if (!this.ctx.getWebSockets().length) await this.ctx.storage.deleteAll();
  }
}

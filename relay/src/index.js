// Retro Rack relay: a tiny Cloudflare Worker that passes messages between the two players in a room,
// and keeps a live list of open rooms. It never runs the game itself; each browser checks every shot.
import { DurableObject } from "cloudflare:workers";

const MODES = ["8ball", "9ball", "uk8"];
const cleanName = s => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 14) || "Player";
const lobbyStub = env => env.LOBBY.get(env.LOBBY.idFromName("lobby"));

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isWs = request.headers.get("Upgrade") === "websocket";
    if (url.pathname === "/lobby") {
      if (!isWs) return new Response("This address expects a WebSocket connection.", { status: 426 });
      return lobbyStub(env).fetch(request);
    }
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]{3,12})$/);
    if (!m) {
      return new Response("Retro Rack relay is running.", { headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    if (!isWs) return new Response("This address expects a WebSocket connection.", { status: 426 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1].toUpperCase())).fetch(request);
  },
};

// One Durable Object per room. Uses the WebSocket Hibernation API, so an idle room costs nothing.
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  live(except) {
    return this.ctx.getWebSockets()
      .filter(ws => ws !== except)
      .map(ws => ({ ws, a: ws.deserializeAttachment() || {} }))
      .filter(s => s.a.seat === 0 || s.a.seat === 1);
  }

  async lobby(op, arg) {
    try { await lobbyStub(this.env)[op](arg); } catch (e) { /* the room still works if the list is unavailable */ }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const code = (url.pathname.split("/").pop() || "").toUpperCase();
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

    // open-rooms list: a listed room shows while its creator waits, and disappears once a second player joins
    const meta = (await this.ctx.storage.get("meta")) || { code };
    if (others.length > 0) {
      if (!meta.played) { meta.played = true; await this.ctx.storage.put("meta", meta); if (meta.listed) await this.lobby("removeRoom", code); }
    } else if (url.searchParams.get("list") === "1" && !meta.played) {
      const mode = MODES.includes(url.searchParams.get("mode")) ? url.searchParams.get("mode") : "8ball";
      Object.assign(meta, { listed: true, name: cleanName(url.searchParams.get("name")), mode });
      await this.ctx.storage.put("meta", meta);
      await this.lobby("addRoom", { code, name: meta.name, mode });
    }

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

  async webSocketClose(ws, code) {
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
    if (!rest.length) {
      const meta = (await this.ctx.storage.get("meta")) || {};
      if (meta.listed && !meta.played) await this.lobby("removeRoom", meta.code);
      await this.ctx.storage.setAlarm(Date.now() + 6 * 60 * 60 * 1000);
    }
  }

  // tidy up rooms nobody has used for six hours
  async alarm() {
    if (!this.ctx.getWebSockets().length) await this.ctx.storage.deleteAll();
  }
}

// A single Durable Object holding the list of open rooms. Menus watch it over a WebSocket and get
// pushed a fresh list whenever a room opens or closes.
export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async rooms() {
    const r = (await this.ctx.storage.get("rooms")) || {};
    const cutoff = Date.now() - 45 * 60 * 1000;          // forget rooms left waiting for 45 minutes
    for (const k of Object.keys(r)) if (r[k].at < cutoff) delete r[k];
    return r;
  }

  view(r) { return Object.values(r).sort((a, b) => b.at - a.at).slice(0, 30); }

  push(r, only) {
    const msg = JSON.stringify({ t: "rooms", rooms: this.view(r), now: Date.now() });
    for (const ws of only ? [only] : this.ctx.getWebSockets()) { try { ws.send(msg); } catch (e) {} }
  }

  async addRoom(e) {
    const r = await this.rooms();
    r[e.code] = { code: e.code, name: cleanName(e.name), mode: MODES.includes(e.mode) ? e.mode : "8ball", at: Date.now() };
    const keys = Object.keys(r).sort((a, b) => r[b].at - r[a].at);
    for (const k of keys.slice(50)) delete r[k];
    await this.ctx.storage.put("rooms", r);
    this.push(r);
  }

  async removeRoom(code) {
    const r = await this.rooms();
    if (!r[code]) return;
    delete r[code];
    await this.ctx.storage.put("rooms", r);
    this.push(r);
  }

  async fetch(request) {
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    this.push(await this.rooms(), server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, message) {
    if (message === "list") this.push(await this.rooms(), ws);
  }

  async webSocketClose(ws, code) {
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, "closing"); } catch (e) {}
  }
}

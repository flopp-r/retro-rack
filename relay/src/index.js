// Retro Rack relay: a tiny Cloudflare Worker that passes messages between the two players in a room,
// keeps a live list of open rooms, and holds the ideas players send in. It never runs the game itself;
// each browser checks every shot.
import { DurableObject } from "cloudflare:workers";

const MODES = ["8ball", "9ball", "uk8"];
const cleanName = s => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 14) || "Player";
const lobbyStub = env => env.LOBBY.get(env.LOBBY.idFromName("lobby"));
const ideasStub = env => env.IDEAS.get(env.IDEAS.idFromName("ideas"));
// ideas are posted as plain text (a JSON body), so browsers send them straight from the game's page with no preflight
const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type" };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isWs = request.headers.get("Upgrade") === "websocket";
    if (url.pathname === "/ideas") {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
      if (request.method !== "POST") return new Response("Send ideas from the game.", { status: 405, headers: CORS });
      return ideasStub(env).fetch(request);
    }
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

// A single Durable Object holding the ideas players send from the game: up to 100 characters each, with the
// sender's online name and the game's version. Reading or deleting them needs the dev word, checked against the
// same fingerprint as the game's (DEVW.print in src/game.js; keep the two the same). Anyone can post here
// without the game, so the limits are kept here: IDEA_DAY ideas a day from one address (stored only as a
// fingerprint, and forgotten the next day), IDEAS_DAY from everyone, and the newest IDEAS_KEEP kept.
// Refusals still answer 200 with a reason, so the game's console stays clean.
const DEV_PRINT = "f5fbd99c8a9a458d2267847deb9aab64fd2f699c0746cea014e74f8cc48e6ee5";
const IDEA_LEN = 100, IDEA_DAY = 5, IDEAS_DAY = 300, IDEAS_KEEP = 500;
const sha = async s => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, "0")).join("");
const reply = o => new Response(JSON.stringify(o), { headers: { "content-type": "application/json", ...CORS } });
const unseen = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g;   // control and invisible characters

export class Ideas extends DurableObject {
  async fetch(request) {
    const raw = await request.text();
    if (raw.length > 2000) return reply({ ok: false, why: "long" });
    let b; try { b = JSON.parse(raw); } catch (e) { return reply({ ok: false, why: "bad" }); }
    if (!b || typeof b !== "object") return reply({ ok: false, why: "bad" });
    if (b.op === "send") return this.send(b, request.headers.get("CF-Connecting-IP") || "");
    const print = this.env.DEV_PRINT || DEV_PRINT;   // DEV_PRINT in the environment: a stand-in word for the tests
    if (typeof b.key !== "string" || await sha("retroRack:" + b.key.trim().toLowerCase()) !== print) return reply({ ok: false, why: "key" });
    if (b.op === "list") {
      const all = await this.ctx.storage.list({ prefix: "i:", reverse: true });
      return reply({ ok: true, ideas: [...all].map(([k, v]) => ({ id: k.slice(2), ...v })) });
    }
    if (b.op === "delete" && typeof b.id === "string") { await this.ctx.storage.delete("i:" + b.id.slice(0, 40)); return reply({ ok: true }); }
    if (b.op === "clear") { await this.drop([...(await this.ctx.storage.list({ prefix: "i:" })).keys()]); return reply({ ok: true }); }
    return reply({ ok: false, why: "bad" });
  }

  async send(b, ip) {
    const text = String(b.text || "").replace(/\s/g, " ").replace(unseen, "").replace(/ +/g, " ").trim();   // line breaks and tabs become spaces
    if (!text) return reply({ ok: false, why: "empty" });
    if (text.length > IDEA_LEN) return reply({ ok: false, why: "long" });
    const name = String(b.name || "").replace(unseen, "").replace(/[<>]/g, "").trim().slice(0, 14);
    const v = /^[0-9a-f]{8}$/.test(b.v) ? b.v : "";
    const day = new Date().toISOString().slice(0, 10), who = (await sha("retroRack-ideas:" + ip)).slice(0, 16);
    let rate = await this.ctx.storage.get("rate");
    if (!rate || rate.day !== day) rate = { day, all: 0, by: {} };
    if ((rate.by[who] || 0) >= IDEA_DAY) return reply({ ok: false, why: "limit", max: IDEA_DAY });
    if (rate.all >= IDEAS_DAY) return reply({ ok: false, why: "busy" });
    rate.by[who] = (rate.by[who] || 0) + 1; rate.all++;
    const t = Date.now();
    await this.ctx.storage.put({ rate, ["i:" + String(t).padStart(15, "0") + "-" + crypto.randomUUID().slice(0, 8)]: { t, text, name, v } });
    const all = await this.ctx.storage.list({ prefix: "i:" });
    if (all.size > IDEAS_KEEP) await this.drop([...all.keys()].slice(0, all.size - IDEAS_KEEP));   // the oldest
    return reply({ ok: true, left: IDEA_DAY - rate.by[who] });
  }

  async drop(keys) { for (let i = 0; i < keys.length; i += 128) await this.ctx.storage.delete(keys.slice(i, i + 128)); }   // 128 at a time is the most allowed
}

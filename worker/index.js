import { sitesOrigin } from "../src/systems/party-endpoints.js";
import { eligible, supportsControl } from "../src/vehicle/classes.js";
import { makeCourse, validate, defaults } from "../src/world/events.js";
import { vehicles } from "../src/vehicle/catalog.js";
import { VehiclePhysics, STEP } from "../src/vehicle/physics.js";
import { Race, terminal } from "../src/systems/race.js";
import { citySolids } from "../src/world/city.js";
import { collideVehicles, makeProps, stepProps } from "../src/world/traffic.js";
import desertColliders from "../src/world/desert-colliders.json";
const json = (v, status = 200) =>
  Response.json(v, { status, headers: { "Cache-Control": "no-store" } });
const randomCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(4)), (n) =>
    String.fromCharCode(65 + (n % 26)),
  ).join("");
const now = () => Date.now() / 1000;
const allowed = [
  "forward",
  "back",
  "left",
  "right",
  "boost",
  "handbrake",
  "jump",
  "rise",
  "lower",
];
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/api/health")
      return json({ service: "SlipStream", ok: true });
    const origin = req.headers.get("Origin");
    if (origin && origin !== url.origin && origin !== sitesOrigin)
      return json({ error: "Invalid origin" }, 403);
    if (url.pathname === "/api/parties" && req.method === "POST") {
      let result = json({ error: "Please try again" }, 503);
      for (let i = 0; i < 16; i++) {
        const code = randomCode(),
          stub = env.PARTIES.get(env.PARTIES.idFromName(code));
        const resp = await stub.fetch("https://room/internal/create", {
          method: "POST",
          body: code,
        });
        if (resp.status === 201) {
          result = resp;
          break;
        }
      }
      if (origin !== sitesOrigin) return result;
      const response = new Response(result.body, result);
      response.headers.set("Access-Control-Allow-Origin", sitesOrigin);
      response.headers.append("Vary", "Origin");
      return response;
    }
    const match = /^\/api\/parties\/([A-Z]{4})\/socket$/.exec(url.pathname);
    if (match && req.headers.get("Upgrade")?.toLowerCase() === "websocket")
      return env.PARTIES.get(env.PARTIES.idFromName(match[1])).fetch(req);
    if (url.pathname.startsWith("/api/"))
      return json({ error: "Unknown endpoint" }, 404);
    return env.ASSETS.fetch(req);
  },
};
export class Party {
  constructor(ctx) {
    this.ctx = ctx;
    this.players = new Map();
    this.sockets = new Map();
    this.config = { ...defaults };
    this.version = 0;
    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get("room");
      if (saved) {
        Object.assign(this, {
          code: saved.code,
          config: saved.config,
          version: saved.version,
          host: saved.host,
          claim: saved.claim,
          active: saved.active,
          deadline: saved.deadline,
        });
        for (const p of saved.players)
          this.players.set(p.id, { ...p, input: {}, connected: false });
        this.grid();
        for (const v of saved.players) {
          const p = this.players.get(v.id);
          Object.assign(p.car.state, v.state);
          Object.assign(p.car, v.motion);
          Object.assign(p.race, v.result);
        }
        this.props = saved.props ?? this.props;
      }
    });
  }
  grid() {
    const count = this.players.size || 1;
    let i = 0;
    for (const p of this.players.values()) {
      const course = makeCourse(this.config, count, i++),
        car = new VehiclePhysics([]);
      car.configure(vehicles.find((v) => v.id === p.vehicle) ?? vehicles[0]);
      car.setCourse(
        course,
        course.id === "city"
          ? citySolids()
          : course.id === "desert"
            ? desertColliders
            : course.obstacles ?? [],
      );
      p.car = car;
      p.race = new Race(course);
      p.input = {};
      p.seq = 0;
    }
    this.props = makeProps(makeCourse(this.config, count));
    this.last = now();
  }
  snapshot() {
    return {
      code: this.code,
      host: this.host,
      config: this.config,
      version: this.version,
      active: !!this.active,
      deadline: this.deadline,
      server: now(),
      propChanges: (this.props ?? []).flatMap((p, i) =>
        p.touched ? [[i, p.x, p.z, p.tilt]] : [],
      ),
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        vehicle: p.vehicle,
        ready: p.ready,
        connected: p.connected,
        ping: p.ping,
        seq: p.seq,
        state: p.car.state,
        vx: p.car.vx,
        vz: p.car.vz,
        result: p.race.result(),
      })),
    };
  }
  save() {
    const data = this.snapshot();
    data.claim = this.claim;
    data.props = this.props;
    for (const p of data.players) {
      const live = this.players.get(p.id);
      p.token = live.token;
      p.seen = live.seen;
      p.motion = Object.fromEntries(
        [
          "vx",
          "vz",
          "hoverTarget",
          "pedal",
          "brakePedal",
          "yawRate",
          "cooldown",
          "jumpHeld",
          "preload",
          "spinSpeed",
        ].map((k) => [k, live.car[k]]),
      );
    }
    return this.ctx.storage.put("room", data);
  }
  async fetch(req) {
    const path = new URL(req.url).pathname;
    if (path === "/internal/create") {
      if (this.code) return json({}, 409);
      this.code = await req.text();
      this.claim = crypto.randomUUID();
      await this.save();
      await this.ctx.storage.setAlarm(Date.now() + 3600000);
      return json({ code: this.code, claim: this.claim }, 201);
    }
    if (!this.code) return json({ error: "Party not found" }, 404);
    const [client, ws] = Object.values(new WebSocketPair());
    ws.accept();
    let id;
    const handshake = setTimeout(() => {
      if (!id) ws.close(1008, "Join timeout");
    }, 8000);
    ws.addEventListener("message", async (event) => {
      try {
        if (typeof event.data !== "string" || event.data.length > 3000)
          throw Error("Invalid message");
        const msg = JSON.parse(event.data);
        if (!id) {
          if (msg.type !== "join") throw Error("Join first");
          let p = [...this.players.values()].find((p) => p.token === msg.token);
          if (!p) {
            if (this.active || this.players.size >= this.config.players)
              throw Error("Party is full or racing");
            if (!this.host && msg.claim !== this.claim)
              throw Error("Waiting for the party creator");
            p = {
              id: crypto.randomUUID(),
              token: crypto.randomUUID(),
              vehicle: "rally",
              name: String(msg.name || "Driver").slice(0, 24),
              ready: false,
              color: [
                "#fc9261",
                "#69d5fa",
                "#dbc564",
                "#74dab5",
                "#bc9dfb",
                "#ec96c1",
                "#9ec3ff",
                "#e29b58",
                "#d7ed82",
                "#72ebec",
                "#ebb2ff",
                "#a0adba",
              ][this.players.size % 12],
            };
            this.players.set(p.id, p);
            if (!this.host) {
              this.host = p.id;
              this.claim = null;
            }
            if (
              !eligible(
                vehicles.find((v) => v.id === p.vehicle),
                this.config,
              )
            )
              p.vehicle = vehicles.find((v) => eligible(v, this.config)).id;
            this.grid();
            this.version++;
          }
          id = p.id;
          clearTimeout(handshake);
          this.sockets.get(id)?.close(1000, "Reconnected");
          this.sockets.set(id, ws);
          p.connected = true;
          p.seq = 0;
          p.seen = now();
          p.input = {};
          ws.send(JSON.stringify({ type: "joined", id, token: p.token }));
          this.broadcast();
          await this.save();
          this.run();
          return;
        }
        if (this.sockets.get(id) !== ws) return;
        const p = this.players.get(id);
        p.seen = now();
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", at: msg.at, server: now() }));
          return;
        }
        if (msg.type === "input") {
          if (!Number.isSafeInteger(msg.seq) || msg.seq <= p.seq) return;
          p.seq = msg.seq;
          p.input = Object.fromEntries(
            allowed.map((k) => [k, msg.controls?.[k] === true && supportsControl(p.car.spec, k)]),
          );
          if (Number.isFinite(msg.controls?.steer))
            p.input.steer = Math.max(-1, Math.min(1, msg.controls.steer));
          p.ping = Math.max(0, Math.min(10000, Number(msg.ping) || 0));
          return;
        }
        if (msg.type === "leave") {
          ws.close(1000, "Left");
          if (this.active) {
            if (!terminal(p.race.phase)) p.race.phase = "dnf";
            p.connected = false;
          } else {
            this.players.delete(id);
            this.grid();
            this.version++;
          }
          if (id === this.host)
            this.host = [...this.players.values()].find(
              (x) => x.id !== id && x.connected,
            )?.id;
        } else if (msg.type === "ready" && !this.active) p.ready = !!msg.ready;
        else if (
          msg.type === "vehicle" &&
          !this.active &&
          eligible(
            vehicles.find((v) => v.id === msg.vehicle),
            this.config,
          ) &&
          (this.config.map !== "sky" || msg.vehicle === "roadster")
        ) {
          p.vehicle = msg.vehicle;
          p.car.configure(vehicles.find((v) => v.id === p.vehicle));
          p.input = {};
          p.ready = false;
        } else if (id !== this.host)
          throw Error("Only the host can change the event");
        else if (msg.type === "config" && !this.active) {
          const config = validate(msg.config);
          if (config.players < this.players.size)
            throw Error("Capacity is below the current party size");
          this.config = config;
          for (const x of this.players.values()) {
            x.ready = false;
            if (
              !eligible(
                vehicles.find((v) => v.id === x.vehicle),
                config,
              )
            )
              x.vehicle = vehicles.find((v) => eligible(v, config)).id;
          }
          this.version++;
          this.grid();
        } else if (
          msg.type === "start" &&
          !this.active &&
          this.config.format !== "free"
        ) {
          if ([...this.players.values()].some((x) => !x.connected || !x.ready))
            throw Error("All drivers must be connected and ready");
          this.grid();
          const t = now();
          for (const x of this.players.values()) x.race.start(t);
          this.active = true;
          this.deadline = null;
          this.version++;
        } else if (
          msg.type === "reset" &&
          (!this.active ||
            [...this.players.values()].every(
              (x) => x.race.phase === "countdown" || terminal(x.race.phase),
            ))
        ) {
          this.active = false;
          this.deadline = null;
          for (const [id, racer] of this.players)
            if (!racer.connected) this.players.delete(id);
            else racer.ready = false;
          this.grid();
          this.version++;
        } else throw Error("Unavailable during this event");
        this.broadcast();
        await this.save();
      } catch (e) {
        ws.send(JSON.stringify({ type: "error", error: e.message }));
        if (!id) ws.close(1008, "Join rejected");
      }
    });
    const close = () => {
      clearTimeout(handshake);
      if (this.sockets.get(id) !== ws) return;
      this.sockets.delete(id);
      const p = this.players.get(id);
      if (p) {
        p.connected = false;
        p.input = {};
        p.seen = now();
      }
      this.broadcast();
      this.ctx.waitUntil(this.save());
    };
    ws.addEventListener("close", close);
    ws.addEventListener("error", close);
    return new Response(null, { status: 101, webSocket: client });
  }
  async alarm() {
    if (this.sockets.size) {
      await this.ctx.storage.setAlarm(Date.now() + 3600000);
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
    this.players.clear();
    this.host = null;
    this.code = null;
    this.claim = null;
    this.active = false;
    this.deadline = null;
    this.config = { ...defaults };
    this.version = 0;
    await this.ctx.storage.deleteAll();
  }
  broadcast() {
    const payload = JSON.stringify({ type: "state", ...this.snapshot() });
    for (const ws of this.sockets.values())
      if (ws.readyState === 1) ws.send(payload);
  }
  run() {
    if (this.timer) return;
    this.last = now();
    let ticks = 0;
    this.timer = setInterval(() => {
      const t = now();
      if (!this.sockets.size) {
        clearInterval(this.timer);
        this.timer = null;
        return;
      }
      this.last = Math.max(this.last, t - 0.3);
      let lobbyChanged = false;
      for (const [id, p] of this.players) {
        if (!p.connected && t - p.seen > 30 && !this.active) {
          this.players.delete(id);
          lobbyChanged = true;
        }
      }
      if (
        !this.players.get(this.host)?.connected &&
        t - (this.players.get(this.host)?.seen ?? 0) > 30
      )
        this.host = [...this.players.values()].find((p) => p.connected)?.id;
      if (lobbyChanged) {
        this.grid();
        this.version++;
      }
      const ps = [...this.players.values()];
      while (this.last + STEP <= t) {
        this.last += STEP;
        for (const p of ps) {
          if (
            !p.connected &&
            this.active &&
            !terminal(p.race.phase) &&
            t - p.seen > 30
          )
            p.race.phase = "dnf";
          p.race.step(p.car, t - p.seen > 1 ? {} : p.input, STEP, this.last);
          if (p.race.phase === "finished" && !this.deadline && this.config.dnf)
            this.deadline = p.race.green + p.race.elapsed + this.config.dnf;
          if (
            this.deadline &&
            this.last >= this.deadline &&
            !terminal(p.race.phase)
          )
            p.race.phase = "dnf";
        }
        if (this.config.collision === "real")
          for (let i = 0; i < ps.length; i++)
            for (let j = i + 1; j < ps.length; j++)
              collideVehicles(ps[i].car, ps[j].car);
        stepProps(
          this.props,
          ps.map((p) => p.car),
          STEP,
        );
      }
      this.broadcast();
      if (++ticks % 60 === 0) this.ctx.waitUntil(this.save());
    }, 50);
  }
}

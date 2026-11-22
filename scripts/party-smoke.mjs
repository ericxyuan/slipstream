// Run against Wrangler locally or an explicitly chosen production origin.
import assert from "node:assert/strict";
const origin = process.argv[2] ?? "http://localhost:8788";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const created = await fetch(origin + "/api/parties", { method: "POST" });
assert.equal(created.status, 201);
const { code, claim } = await created.json();
assert.match(code, /^[A-Z]{4}$/);
async function connect(name, extra = {}) {
  const ws = new WebSocket(
    origin.replace(/^http/, "ws") + "/api/parties/" + code + "/socket",
  );
  const client = { ws, errors: [], send: (m) => ws.send(JSON.stringify(m)) };
  ws.onopen = () => client.send({ type: "join", name, ...extra });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === "joined") {
      client.id = m.id;
      client.token = m.token;
    }
    if (m.type === "state") client.state = m;
    if (m.type === "error") client.errors.push(m.error);
  };
  await until(() => client.state, "connect " + name);
  return client;
}
async function until(fn, label, ms = 8000) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > ms) throw Error("Timed out: " + label);
    await delay(30);
  }
}
const host = await connect("Test driver A", { claim }),
  guest = await connect("Test driver B");
let other = guest;
try {
  const config = {
    ...host.state.config,
    map: "drag",
    format: "drag",
    distance: 50,
    countdown: 1,
    dnf: 2,
    collision: "real",
    players: 2,
  };
  guest.send({ type: "config", config });
  await until(
    () => guest.errors.some((e) => e.includes("host")),
    "host permissions",
  );
  host.send({ type: "config", config });
  await until(() => guest.state.config.distance === 50, "shared config");
  guest.send({ type: "vehicle", vehicle: "u9" });
  await until(
    () => host.state.players.some((p) => p.vehicle === "u9"),
    "remote car",
  );
  for (const c of [host, guest]) c.send({ type: "ready", ready: true });
  await until(() => host.state.players.every((p) => p.ready), "ready");
  host.send({ type: "start" });
  await until(() => guest.state.active, "countdown");
  assert.ok(
    Math.abs(host.state.players[0].state.x - host.state.players[1].state.x) >=
      4,
  );
  await until(
    () => host.state.players.every((p) => p.result.phase === "running"),
    "green",
  );
  let seq = 0;
  const pedal = setInterval(
    () => host.send({ type: "input", seq: ++seq, controls: { forward: true } }),
    40,
  );
  try {
    await until(
      () => guest.state.players[0].state.groundSpeed > 1,
      "remote movement",
    );
    guest.ws.close();
    other = await connect("Test driver B", { token: guest.token });
    assert.equal(other.id, guest.id);
    await until(
      () => host.state.players.some((p) => p.result.phase === "finished"),
      "valid finish",
      12000,
    );
    await until(
      () => other.state.players.some((p) => p.result.phase === "dnf"),
      "DNF",
      6500,
    );
    const results = (c) =>
      c.state.players.map((p) => [p.id, p.result.phase, p.result.elapsed]);
    assert.deepEqual(results(host), results(other));
    console.log(
      "PASS",
      code,
      results(host).map((r) => [r[1], r[2]]),
    );
  } finally {
    clearInterval(pedal);
  }
} finally {
  for (const c of [host, other]) {
    if (c.ws.readyState === 1) c.send({ type: "leave" });
    c.ws.close();
  }
}

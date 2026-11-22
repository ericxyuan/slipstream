export class PartyClient {
  constructor(onState, onMessage) {
    this.onState = onState;
    this.message = onMessage;
    this.seq = 0;
    this.ping = null;
  }
  resume() {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("slipstream.current-party"),
      );
      if (saved) this.join(saved.room, saved.name);
    } catch {
      sessionStorage.removeItem("slipstream.current-party");
    }
  }
  async create(name) {
    const r = await fetch("/api/parties", { method: "POST" });
    if (!r.ok || !r.headers.get("content-type")?.includes("json"))
      throw Error("Multiplayer requires the Cloudflare game server.");
    const { code, claim } = await r.json();
    this.join(code, name, claim);
  }
  join(code, name, claim) {
    code = code.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code))
      throw Error("Enter a four-letter party code.");
    this.leave();
    this.room = code;
    this.name = name;
    this.claim = claim;
    this.connect();
  }
  connect() {
    const ws = new WebSocket(
      (location.protocol === "https:" ? "wss://" : "ws://") +
        location.host +
        "/api/parties/" +
        this.room +
        "/socket",
    );
    this.ws = ws;
    this.seq = 0;
    ws.onopen = () =>
      this.send({
        type: "join",
        claim: this.claim,
        token: sessionStorage.getItem("slipstream.party." + this.room),
        name: this.name,
      });
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === "joined") {
        this.id = m.id;
        sessionStorage.setItem(
          "slipstream.current-party",
          JSON.stringify({ room: this.room, name: this.name }),
        );
        this.claim = null;
        sessionStorage.setItem("slipstream.party." + this.room, m.token);
        this.message("Joined " + this.room);
      }
      if (m.type === "state") {
        this.state = m;
        this.received = performance.now();
        this.onState(m);
      }
      if (m.type === "error") this.message(m.error);
      if (m.type === "pong") this.ping = Math.round(performance.now() - m.at);
    };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      if (this.id && e.code !== 1008) {
        this.message("Reconnecting to " + this.room);
        this.retry = setTimeout(() => this.connect(), 1000);
      } else {
        this.message("Unable to join " + this.room);
        this.leave();
      }
    };
    ws.onerror = () => this.message("Could not reach the party server.");
  }
  send(msg) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg));
  }
  input(controls, now) {
    if (!this.id || now - (this.sent ?? -100) < 40) return;
    this.sent = now;
    this.send({ type: "input", controls, seq: ++this.seq, ping: this.ping });
    if (now - (this.lastPing ?? -1500) > 1000) {
      this.lastPing = now;
      this.send({ type: "ping", at: now });
    }
  }
  leave() {
    sessionStorage.removeItem("slipstream.current-party");
    clearTimeout(this.retry);
    if (this.ws) {
      this.send({ type: "leave" });
      this.ws.onclose = null;
      this.ws.close();
    }
    this.ws = null;
    this.id = null;
    this.state = null;
    this.room = null;
    this.onState(null);
  }
}

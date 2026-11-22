import { freightPassage } from "../world/city.js";
// Procedural sources are started only after a user gesture. Each remote voice has its own spatial mix.
const tones = {
  rally: [62, 2.5, "sawtooth"],
  sport: [87, 3, "triangle"],
  bus: [24, 1.5, "sawtooth"],
  semi: [31, 2.25, "sawtooth"],
  roadster: [93, 2.01, "sine"],
  u9: [145, 3.98, "sine"],
  i8: [55, 1.5, "triangle"],
};
export class DriveAudio {
  constructor() {
    try {
      this.volumes = JSON.parse(localStorage.getItem("slipstream.audio")) ?? {};
    } catch {
      this.volumes = {};
    }
    this.voices = new Map();
    const unlock = () => {
      if (!this.ctx) this.init();
      if (this.ctx?.state === "suspended") this.ctx.resume().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }
  init() {
    if (!window.AudioContext) return;
    this.ctx = new AudioContext();
    let c = this.ctx;
    this.master = c.createGain();
    const limiter = c.createDynamicsCompressor();
    this.master.connect(limiter).connect(c.destination);
    this.buses = {};
    for (const id of ["engine", "surface", "ambient", "effects", "ui"]) {
      this.buses[id] = c.createGain();
      this.buses[id].connect(this.master);
    }
    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    let data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.traffic = this.texture(this.buses.ambient);
    const hum = c.createOscillator();
    this.industrial = c.createGain();
    this.industrial.gain.value = 0;
    hum.frequency.value = 56;
    hum.type = "triangle";
    hum.connect(this.industrial).connect(this.buses.ambient);
    hum.start();
    const echo = c.createDelay(0.5);
    echo.delayTime.value = 0.115;
    this.reverb = c.createGain();
    this.reverb.gain.value = 0;
    this.buses.engine.connect(echo).connect(this.reverb).connect(this.master);
    this.wind = this.texture(this.buses.ambient);
    this.tyres = this.texture(this.buses.surface);
    this.apply();
  }
  texture(bus) {
    const c = this.ctx,
      node = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    node.buffer = this.noise;
    node.loop = true;
    filter.type = "lowpass";
    gain.gain.value = 0;
    node.connect(filter).connect(gain).connect(bus);
    node.start();
    return { gain: gain.gain, freq: filter.frequency };
  }
  set(key, v) {
    this.volumes[key] = v;
    try {
      localStorage.setItem("slipstream.audio", JSON.stringify(this.volumes));
    } catch {}
    this.apply();
  }
  apply() {
    if (!this.ctx) return;
    for (const [id, node] of Object.entries({
      master: this.master,
      ...this.buses,
    }))
      node.gain.setTargetAtTime(
        this.volumes[id] ?? (id === "master" ? 0.45 : 0.65),
        this.ctx.currentTime,
        0.05,
      );
  }
  tone(freq, duration = 0.09, bus = "ui") {
    if (!this.ctx) return;
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain(),
      t = c.currentTime;
    o.frequency.value = freq;
    o.connect(g).connect(this.buses[bus]);
    g.gain.setValueAtTime(0.085, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.start();
    o.stop(t + duration);
  }
  update(id, s, v, listener, surface, map) {
    if (!this.ctx) return;
    const c = this.ctx,
      t = c.currentTime;
    let voice = this.voices.get(id);
    if (!voice) {
      const osc = c.createOscillator(),
        harm = c.createOscillator(),
        gain = c.createGain(),
        pan = c.createStereoPanner(),
        filter = c.createBiquadFilter();
      filter.type = "lowpass";
      osc.connect(filter);
      harm.connect(filter);
      filter.connect(gain).connect(pan).connect(this.buses.engine);
      gain.gain.value = 0;
      osc.start();
      harm.start();
      voice = { osc, harm, gain, pan, filter };
      this.voices.set(id, voice);
    }
    const ev = v.electric && !v.hybrid,
      heavy = v.mass > 5000,
      rev = ev ? s.groundSpeed * 0.95 : (Math.abs(s.speed) % 9) * 4.2;
    const [base, harmonic, wave] = tones[v.id];
    voice.osc.type = v.hybrid && s.engineLoad < 0.1 ? "sine" : wave;
    voice.harm.type = ev ? "triangle" : "sine";
    const f =
      base + rev + s.throttle * (heavy ? 12 : 33) + s.regen * 13 + s.boost * 15;
    voice.osc.frequency.setTargetAtTime(f, t, 0.09);
    voice.harm.frequency.setTargetAtTime(f * harmonic, t, 0.1);
    voice.filter.frequency.setTargetAtTime(170 + s.throttle * 760, t, 0.09);
    const dx = s.x - listener.x,
      dz = s.z - listener.z,
      dist = Math.hypot(dx, dz);
    voice.pan.pan.setTargetAtTime(
      Math.max(
        -1,
        Math.min(
          1,
          (dx * Math.cos(listener.heading) - dz * Math.sin(listener.heading)) /
            20,
        ),
      ),
      t,
      0.08,
    );
    voice.gain.gain.setTargetAtTime(
      ((ev ? 0.017 : 0.045) * (1 + s.throttle * 1.8)) / (1 + dist * 0.07),
      t,
      0.08,
    );
    if (id === "local") {
      const city = map === "city",
        pass = freightPassage;
      const echo =
        city &&
        Math.abs(s.x - pass.x) < pass.rx &&
        Math.abs(s.z - pass.z) < pass.rz &&
        s.altitude < pass.clearance;
      this.reverb.gain.setTargetAtTime(echo ? 0.32 : 0, t, 0.15);
      this.industrial.gain.setTargetAtTime(
        city ? 0.038 / (1 + Math.hypot(s.x - 180, s.z + 170) / 60) : 0,
        t,
        0.4,
      );
      const traffic = 0.5 + 0.5 * Math.sin(t * 0.53 + s.x * 0.017);
      this.traffic.freq.setTargetAtTime(230 + traffic * 950, t, 0.4);
      this.traffic.gain.setTargetAtTime(
        city ? 0.014 + traffic * 0.026 : 0,
        t,
        0.4,
      );
      this.wind.freq.setTargetAtTime(
        map === "city" ? 480 : map === "sky" ? 1200 : 650,
        t,
        0.3,
      );
      this.wind.gain.setTargetAtTime(
        0.014 + s.groundSpeed * 0.0007 + s.rearThrust * 0.14,
        t,
        0.14,
      );
      this.tyres.freq.setTargetAtTime(
        650 + (1 - (surface?.grip ?? 1)) * 2900 + s.wheelSlip * 900,
        t,
        0.1,
      );
      this.tyres.gain.setTargetAtTime(
        (1 - s.airborne) *
          Math.min(
            0.16,
            s.groundSpeed * 0.0008 * (surface?.rolling ?? 1) +
              s.wheelSlip * 0.08,
          ),
        t,
        0.1,
      );
      if (heavy && s.brake > 0.7 && !this.pneumatic)
        this.burst(0.14, 2400, 0.12);
      this.pneumatic = s.brake > 0.7;
      if (s.compression > 0.5 && this.compression < 0.2)
        this.tone(63, 0.14, "effects");
      this.compression = s.compression;
      if (s.impact > 1 && !this.hit)
        this.burst(0.17, (surface?.rolling ?? 1) > 1.4 ? 470 : 160, 0.17);
      this.hit = s.impact > 1;
      if (s.mode === 4 && this.mode !== 4) this.tone(110, 0.08, "effects");
      this.mode = s.mode;
    }
  }
  burst(duration, cutoff, level) {
    if (!this.ctx) return;
    const c = this.ctx,
      t = c.currentTime,
      node = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    node.buffer = this.noise;
    f.frequency.value = cutoff;
    node.connect(f).connect(g).connect(this.buses.effects);
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    node.start();
    node.stop(t + duration);
  }
  remove(id) {
    const v = this.voices.get(id);
    if (v) {
      v.osc.stop();
      v.harm.stop();
      v.pan.disconnect();
      this.voices.delete(id);
    }
  }
  mute(on) {
    if (this.ctx)
      this.master.gain.setTargetAtTime(
        on ? 0 : (this.volumes.master ?? 0.45),
        this.ctx.currentTime,
        0.06,
      );
  }
}

import { combinedAcceleration, motionNames } from "./readouts.js";
import { Minimap } from "./minimap.js";
import { gear } from "../vehicle/physics.js";
const byId = (id) => document.getElementById(id);
function segments(el, count) {
  return Array.from({ length: count }, () =>
    el.appendChild(document.createElement("i")),
  );
}
function setAxis(el, left, right) {
  el.style.setProperty("--left", (left * 50).toFixed(1) + "%");
  el.style.setProperty("--right", (right * 50).toFixed(1) + "%");
}
export class Hud {
  constructor() {
    this.map = new Minimap(byId("minimap"));
    this.pedals = byId("pedal-axis");
    this.steer = byId("steer-axis");
    this.altitude = byId("altitude");
    this.speed = byId("speed");
    this.gear = byId("gear");
    this.fps = byId("fps");
    this.camera = byId("camera");
    this.revs = segments(document.querySelector(".revbar"), 25);
    this.revs.slice(-5).forEach((e) => e.classList.add("hot"));
    this.buttons = [...document.querySelectorAll("footer button")];
    this.lastSpeed = -1;
    this.elapsed = 0;
    this.frames = 0;
  }
  select(spec) {
    document.documentElement.style.setProperty("--accent", spec.color);
    byId("vehicle-name").textContent = spec.name;
    byId("vehicle-plate").textContent = spec.plate;
    document.querySelector(".flight-controls").hidden = !spec.flying;
    document.querySelector('[data-control="jump"]').hidden = !spec.jump;
    byId("regen-label").hidden = byId("regen-level").hidden = !spec.electric;
    this.flying = spec.flying;
  }
  update(s, input, dt) {
    const n = Math.round(s.groundSpeed * 3.6),
      g =
        this.flying && gear(s.speed) !== "R" && gear(s.speed) !== "N"
          ? "D"
          : gear(s.speed);
    if (n !== this.lastSpeed) {
      this.speed.innerHTML =
        "<span>" +
        "0".repeat(Math.max(0, 3 - String(n).length)) +
        "</span>" +
        n;
      this.lastSpeed = n;
    }
    if (this.gear.textContent !== g) this.gear.textContent = g;
    setAxis(this.pedals, s.brake, s.throttle);
    setAxis(this.steer, Math.max(0, s.steeringInput), Math.max(0, -s.steeringInput));
    byId("acceleration").value = combinedAcceleration(s);
    byId("regen-level").style.transform = "scaleX(" + s.regen / 4 + ")";
    byId("brake-level").style.transform = "scaleX(" + s.brake + ")";
    byId("boost-lamp").classList.toggle("on", s.boost > 0.1);
    byId("hand-lamp").classList.toggle("on", !!input.handbrake);
    this.speed.classList.toggle("boosting", s.boost > 0.1);
    byId("motion-info").textContent =
      motionNames[Math.round(s.mode)] +
      (this.flying || s.airborne
        ? " · " +
          s.altitude.toFixed(1) +
          " m · " +
          s.verticalSpeed.toFixed(1) +
          " m/s"
        : "");
    this.map.update(s);
    if (this.flying) this.altitude.textContent = s.altitude.toFixed(1) + " m";
    const revs =
      g === "D"
        ? 2 + s.throttle * 23
        : g === "N"
          ? 2
          : g === "R"
            ? 4 + Math.abs(s.speed) * 2
            : 5 +
              Math.min(1, (Math.abs(s.speed) - (Number(g) - 1) * 8.4) / 8.4) *
                20;
    this.revs.forEach((e, i) => e.classList.toggle("on", i < revs));
    this.buttons.forEach((el) =>
      el.classList.toggle("active", !!input[el.dataset.control]),
    );
    this.elapsed += dt;
    this.frames++;
    if (this.elapsed >= 0.45) {
      this.fps.textContent = Math.round(this.frames / this.elapsed);
      this.frames = 0;
      this.elapsed = 0;
    }
  }
}

import { courses, courseLayout, surfaces } from "../world/courses.js";

const byId = id => document.getElementById(id);
const seconds = n => n.toFixed(3) + " s";

function preview(course) {
  const xs = course.points.map(p => p.x), zs = course.points.map(p => p.z);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...zs) - Math.min(...zs);
  const scale = 34 / Math.max(w, h);
  const points = course.points.map(p =>
    [(p.x - Math.min(...xs) - w / 2) * scale + 26, (p.z - Math.min(...zs) - h / 2) * scale + 21].join(","));
  return '<svg viewBox="0 0 52 42" aria-hidden="true"><path d="M' + points.join(" L") + (course.closed ? ' Z' : '') + '"/></svg>';
}

export class RaceUI {
  constructor(enter, restart, clearInput) {
    this.chooser = byId("course-dialog");
    this.results = byId("result-dialog");
    this.action = byId("race-action");
    this.progress = byId("race-progress");
    this.signal = byId("launch-signal");
    const list = this.chooser.querySelector(".course-list");
    for (const [id, { type, name, detail }] of Object.entries(courses)) {
      const label = document.createElement("label");
      label.className = "course-option";
      label.innerHTML = '<input type="radio" name="course" value="' + id + '">' + preview(courseLayout(id))
        + '<span><small>' + type + '</small><b>' + name + '</b><em>' + detail + '</em></span>';
      list.append(label);
    }
    const form = byId("course-form"), settings = byId("strip-settings");
    const distance = byId("strip-length"), surface = byId("strip-surface");
    for (const [id, spec] of Object.entries(surfaces)) surface.add(new Option(spec.name, id));
    function fields() { settings.hidden = settings.disabled = form.elements.course.value !== "drag"; }
    list.addEventListener("change", fields);
    const openChooser = () => {
      this.results.close();
      clearInput();
      form.elements.course.value = this.course.id;
      distance.value = this.savedLength ?? 402;
      surface.value = this.savedSurface ?? "prepared";
      fields();
      this.chooser.showModal();
      list.querySelector(":checked").focus();
    };
    byId("choose-course").onclick = byId("result-courses").onclick = openChooser;
    for (const dialog of [this.chooser, this.results]) {
      dialog.querySelector(".close").onclick = () => dialog.close();
      dialog.addEventListener("close", () => { clearInput(); if (!this.paused) byId("world").focus(); });
    }
    form.onsubmit = e => {
      e.preventDefault();
      const id = form.elements.course.value;
      if (id === "drag") {
        this.savedLength = distance.valueAsNumber;
        this.savedSurface = surface.value;
      }
      this.chooser.close();
      enter(courseLayout(id, this.savedLength, this.savedSurface));
    };
    byId("result-retry").onclick = () => { this.results.close(); restart(); this.race.start(); };
    this.action.onclick = () => {
      if (this.race.phase === "finished") this.results.showModal();
      else this.race.start();
      if (!this.paused) byId("world").focus();
    };
  }
  get paused() { return this.chooser.open || this.results.open; }
  reset(race) {
    this.race = race;
    this.course = race.course;
    this.lastPhase = null;
    this.progress.textContent = "";
    byId("course-name").textContent = this.course.name;
    byId("course-type").textContent = this.course.type;
    byId("race-info").hidden = this.course.id === "desert";
    this.signal.hidden = true;
  }
  update(state, vehicle) {
    const race = this.race, course = this.course, phase = race.phase;
    if (phase === "free") return;
    const drag = course.id === "drag", sky = course.id === "sky";
    if (phase !== this.lastPhase) {
      this.action.hidden = phase !== "ready" && phase !== "finished";
      this.action.textContent = phase === "finished" ? "View results" : drag ? "Arm launch" : "Start race";
      if (phase === "finished") this.finish(vehicle);
      this.lastPhase = phase;
    }
    let text;
    if (phase === "finished") text = "Finish · " + seconds(race.elapsed);
    else if (phase === "running") {
      const gate = course.gates[race.next];
      text = drag ? Math.max(0, Math.ceil(course.length + state.z)) + " m to finish"
        : (sky ? "Gate " : "Checkpoint ") + (race.next + 1) + "/" + course.gates.length
          + " · " + Math.round(Math.hypot(gate.x - state.x, gate.z - state.z)) + " m"
          + (sky ? " · Alt " + gate.y + " m" : "");
      text += " · " + race.elapsed.toFixed(1) + " s";
    } else text = drag ? course.length + " m · " + course.surface.name
      : sky ? "8 gates · E to rise, Q to lower" : "1 lap · Follow the mint arrows";
    if (this.progress.textContent !== text) this.progress.textContent = text;
    const green = phase === "running" && race.elapsed < 1.1;
    this.signal.hidden = phase !== "countdown" && !green;
    if (!this.signal.hidden) {
      const n = green ? 0 : Math.max(1, Math.ceil(race.countdown - 1e-8));
      const value = green ? "GO" : String(n);
      if (this.signal.querySelector("strong").textContent !== value) {
        this.signal.classList.toggle("green", green);
        this.signal.querySelector("strong").textContent = value;
        this.signal.querySelector("small").textContent = green ? "Accelerate" : drag ? "Hold throttle to stage" : "Get ready";
        this.signal.querySelectorAll("i").forEach((lamp, i) => lamp.classList.toggle("on", i < 4 - n));
      }
    }
  }
  finish(vehicle) {
    const r = this.race, c = this.course, drag = c.id === "drag";
    byId("result-title").textContent = drag ? "Drag results" : c.id === "sky" ? "Flight results" : "Lap results";
    byId("result-course").textContent = c.name + " · " + vehicle.name + (drag ? " · " + c.length + " m · " + c.surface.name : "");
    byId("result-time").textContent = seconds(r.elapsed);
    const stats = [["Max acceleration", r.maxAccel.toFixed(2) + " m/s²"], ["Max speed", (r.maxSpeed * 3.6).toFixed(1) + " km/h"]];
    if (drag) stats.push(["Launch reaction", r.reaction === null ? "—" : seconds(r.reaction) + (r.reaction === 0 && r.staged ? " · staged" : "")],
      ["Peak wheel slip", (r.maxSlip * 100).toFixed(1) + "%"]);
    else stats.push([c.id === "sky" ? "Gates cleared" : "Checkpoints cleared", r.next + " / " + c.gates.length]);
    const dl = byId("result-stats");
    dl.replaceChildren();
    for (const [name, value] of stats) {
      const dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = name; dd.textContent = value; dl.append(dt, dd);
    }
    this.results.showModal();
  }
}

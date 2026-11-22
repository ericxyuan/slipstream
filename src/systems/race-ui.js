import { classes } from "../vehicle/classes.js";
import { courses, surfaces } from "../world/courses.js";
import { defaults, formats, makeCourse } from "../world/events.js";
import { vehicles } from "../vehicle/catalog.js";
import { GaragePreview } from "./garage-preview.js";
import { terminal } from "./race.js";
import { accelerationText, formatTime } from "./readouts.js";
const el = (id) => document.getElementById(id);
const tabs = [
  "Drive",
  "Maps",
  "Race Configuration",
  "Car Packs",
  "Vehicle Selection",
  "Active Rotation",
  "Multiplayer",
  "Party Management",
  "Graphics",
  "Audio",
  "Controls",
  "General Settings",
];
const opts = (entries) =>
  Object.entries(entries)
    .map(([k, v]) => '<option value="' + k + '">' + v + "</option>")
    .join("");
const pick = (name, label, entries) =>
  "<label>" +
  label +
  '<select name="' +
  name +
  '">' +
  opts(entries) +
  "</select></label>";
const num = (name, label, min, max) =>
  "<label>" +
  label +
  '<input type="number" required name="' +
  name +
  '" min="' +
  min +
  '" max="' +
  max +
  '"></label>';
const btn = (id, label) =>
  '<button type="button" id="' +
  id +
  '" class="secondary-button">' +
  label +
  "</button>";
function saved(k, fallback) {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback;
  } catch {
    return fallback;
  }
}
export class RaceUI {
  constructor(api) {
    this.api = api;
    this.dialog = el("course-dialog");
    this.results = el("result-dialog");
    this.pane = el("menu-pane");
    this.tab = "Drive";
    this.config = { ...defaults };
    this.draft = { ...this.config };
    this.action = el("race-action");
    this.signal = el("launch-signal");
    for (const name of tabs) {
      const b = document.createElement("button");
      b.textContent = name;
      b.onclick = () => this.show(name);
      el("menu-tabs").append(b);
    }
    el("choose-course").onclick = () => this.toggle();
    el("result-courses").onclick = () => {
      this.results.close();
      this.toggle("Race Configuration");
    };
    this.action.onclick = () => this.arm();
    el("result-retry").onclick = () => {
      this.results.close();
      api.restart();
    };
    for (const d of [this.results, this.dialog]) {
      d.querySelector(".close").onclick = () => d.close();
      d.addEventListener("close", () => {
        this.preview?.dispose();
        this.preview = null;
        api.clear();
        el("world").focus();
      });
    }
  }
  tell(text) {
    el("menu-status").textContent = text;
  }
  get paused() {
    return (this.dialog.open || this.results.open) && !this.api.party().id;
  }
  toggle(tab) {
    if (this.dialog.open) {
      this.dialog.close();
      return;
    }
    this.results.close();
    this.api.clear();
    this.dialog.showModal();
    this.show(tab ?? "Drive");
  }
  arm() {
    const p = this.api.party();
    if (terminal(this.race.phase)) {
      this.finish();
      return;
    }
    if (p.id)
      p.send({ type: this.race.phase === "countdown" ? "reset" : "start" });
    else if (this.race.phase === "countdown") this.race.cancel();
    else this.race.start();
  }
  reset(race) {
    this.race = race;
    this.config = race.course.config;
    this.draft = { ...this.config };
    this.lastPhase = null;
    el("course-name").textContent = race.course.name;
    el("course-type").textContent = race.course.type;
    el("race-info").hidden = race.phase === "free";
    this.signal.hidden = true;
  }
  show(tab) {
    this.api.audio.tone(440, 0.045);
    this.preview?.dispose();
    this.preview = null;
    this.tab = tab;
    this.tell("");
    el("course-title").textContent = tab;
    [...el("menu-tabs").children].forEach((b) =>
      b.classList.toggle("selected", b.textContent === tab),
    );
    const a = this.api,
      p = this.pane;
    p.replaceChildren();
    if (tab === "Maps" || tab === "Race Configuration")
      return this.settings(tab === "Maps");
    if (["Car Packs", "Vehicle Selection", "Active Rotation"].includes(tab))
      return this.garage(tab);
    if (tab === "Multiplayer" || tab === "Party Management")
      return this.partyMenu();
    if (tab === "Drive") {
      p.innerHTML =
        "<h3></h3><p></p>" +
        btn("resume-drive", "Resume driving") +
        btn("configure-event", "Configure event");
      p.querySelector("h3").textContent = this.race.course.name;
      p.querySelector("p").textContent =
        formats[this.config.format] + " · " + vehicles[a.fleet.index].name;
      el("resume-drive").onclick = () => this.dialog.close();
      el("configure-event").onclick = () => this.show("Race Configuration");
    }
    if (tab === "Audio") {
      for (const key of [
        "master",
        "engine",
        "surface",
        "ambient",
        "effects",
        "ui",
      ]) {
        const label = document.createElement("label");
        label.textContent =
          key === "ui" ? "Interface" : key[0].toUpperCase() + key.slice(1);
        const range = document.createElement("input");
        range.type = "range";
        range.min = 0;
        range.max = 1;
        range.step = 0.01;
        range.value = a.audio.volumes[key] ?? (key === "master" ? 0.45 : 0.65);
        range.oninput = () => a.audio.set(key, Number(range.value));
        label.append(range);
        p.append(label);
      }
    }
    if (tab === "Controls")
      p.innerHTML =
        "<dl>" +
        Object.entries({
          "W / ↑": "Accelerate",
          "S / ↓": "Brake, then reverse",
          "A D / ← →": "Steer",
          Space: "Handbrake",
          Shift: "Boost",
          "E / Q": "Rise / lower Roadster",
          J: "U9 suspension jump",
          SCROLL: "Change active vehicle",
          "Left drag": "Freelook",
          C: "Recenter / change camera",
          "F / Esc": "Arm / cancel countdown",
          R: "Reset vehicle",
          X: "Open / close menu",
        })
          .map(([k, v]) => "<dt>" + k + "</dt><dd>" + v + "</dd>")
          .join("") +
        "</dl>";
    if (tab === "Graphics") {
      p.innerHTML =
        pick("quality", "Rendering quality", {
          low: "Performance",
          high: "High",
        }) +
        '<label><input type="checkbox" id="geometry-debug"> Show collision shapes</label>';
      const q = p.querySelector("select");
      q.value = saved("slipstream.quality", "high");
      q.onchange = () => {
        localStorage.setItem("slipstream.quality", JSON.stringify(q.value));
        a.quality(q.value);
      };
      el("geometry-debug").checked = a.debug.visible;
      el("geometry-debug").onchange = (e) =>
        (a.debug.visible = e.target.checked);
    }
    if (tab === "General Settings") {
      p.innerHTML = pick("zoom", "Minimap range", {
        ".65": "Close",
        1: "Standard",
        1.7: "Wide",
      });
      const q = p.querySelector("select");
      q.value = a.hud.map.zoom ?? 1;
      q.onchange = () => {
        a.hud.map.zoom = Number(q.value);
        localStorage.setItem("slipstream.zoom", q.value);
      };
    }
  }
  settings(mapOnly) {
    const p = this.pane,
      c = this.draft,
      room = this.api.party(),
      locked = room.id && (room.state?.host !== room.id || room.state?.active);
    p.innerHTML =
      '<form id="event-form"><fieldset><legend>Environment</legend>' +
      pick(
        "map",
        "Map",
        Object.fromEntries(
          Object.entries(courses).map(([k, v]) => [k, v.name]),
        ),
      ) +
      pick("format", "Format", formats) +
      pick("surface", "Road surface", {
        original: "Original map surface",
        mixed: "Mixed preset",
        custom: "Custom sections",
        ...Object.fromEntries(
          Object.entries(surfaces).map(([k, v]) => [k, v.name]),
        ),
      }) +
      '<label id="sections-label">Surfaces in route order<input name="sections" placeholder="asphalt,gravel,wet"></label></fieldset>' +
      "<fieldset><legend>Route</legend>" +
      pick(
        "route",
        "Route preset",
        c.map === "city"
          ? {
              main: "Foundry loop",
              short: "Market block",
              outer: "Freight perimeter",
            }
          : { main: "Full course", short: "Short course" },
      ) +
      pick("reverse", "Direction", { false: "Forward", true: "Reverse" }) +
      num("distance", "Strip or drag distance (m)", 50, 2000) +
      num("start", "Start along route (%)", 0, 90) +
      num("end", "Finish along route (%)", 10, 100) +
      num("checkpoints", "Checkpoints", 2, 32) +
      num("laps", "Circuit laps", 1, 99) +
      "</fieldset>" +
      "<fieldset><legend>Competition</legend>" +
      pick("collision", "Player collisions", { ghost: "Ghost", real: "Real" }) +
      pick("vehicleClass", "Vehicle class", classes) +
      pick("rules", "Performance", {
        authentic: "Authentic",
        balanced: "Balanced · common 10 m/s² drive and 270 km/h limit",
      }) +
      num("players", "Party capacity", 1, 12) +
      num("dnf", "DNF after first finish (s, 0 disables)", 0, 3600) +
      num("countdown", "Countdown (s)", 1, 15) +
      "</fieldset>" +
      '<div id="route-preview"></div><p id="event-summary"></p><div class="form-actions">' +
      btn("save-event", "Save preset") +
      btn("load-event", "Load preset") +
      '<button class="primary-button">Apply event</button></div></form>';
    const form = el("event-form");
    for (const [k, v] of Object.entries(c))
      if (form.elements[k]) form.elements[k].value = v;
    if (mapOnly) {
      form.elements.format.value = "free";
      form.querySelectorAll("fieldset")[1].hidden = true;
      form.querySelectorAll("fieldset")[2].hidden = true;
    }
    function read() {
      const raw = Object.fromEntries(new FormData(form));
      for (const k of Object.keys(defaults))
        if (typeof defaults[k] === "number") raw[k] = Number(raw[k]);
      raw.reverse = raw.reverse === "true";
      return raw;
    }
    const update = () => {
      try {
        const v = read(),
          course = makeCourse(v),
          pts = course.route;
        const routeField = form.elements.route;
        if (routeField.dataset.map !== v.map) {
          routeField.innerHTML = opts(
            v.map === "city"
              ? {
                  main: "Foundry loop",
                  short: "Market block",
                  outer: "Freight perimeter",
                }
              : { main: "Full course", short: "Short course" },
          );
          routeField.value = [...routeField.options].some(
            (o) => o.value === v.route,
          )
            ? v.route
            : "main";
          routeField.dataset.map = v.map;
        }
        form.elements.laps.parentElement.hidden = v.format !== "circuit";
        form.elements.distance.parentElement.hidden =
          v.format !== "drag" && v.map !== "drag";
        this.draft = v;
        el("sections-label").hidden = v.surface !== "custom";
        const xs = pts.map((p) => p.x),
          zs = pts.map((p) => p.z),
          x = Math.min(...xs),
          z = Math.min(...zs),
          w = Math.max(...xs) - x,
          h = Math.max(...zs) - z,
          pad = Math.max(w, h) * 0.06;
        el("route-preview").innerHTML =
          '<svg viewBox="' +
          [x - pad, z - pad, w + 2 * pad, h + 2 * pad].join(" ") +
          '"><polyline fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" points="' +
          pts.map((p) => p.x + "," + p.z).join(" ") +
          '"/>' +
          course.gates
            .map(
              (g) =>
                '<circle cx="' +
                g.x +
                '" cy="' +
                g.z +
                '" r="' +
                pad * 0.24 +
                '"/>',
            )
            .join("") +
          "</svg>";
        el("event-summary").textContent = [
          course.name,
          course.type,
          Math.round(course.routeLength) + " m",
          v.surface,
          v.collision,
          course.config.laps + " lap(s)",
          v.dnf ? "DNF " + v.dnf + " s" : "DNF off",
          "up to " + v.players + " drivers",
          v.rules,
          classes[v.vehicleClass],
        ].join(" · ");
        form.querySelector("[type=submit],.primary-button").disabled = !!locked;
      } catch (e) {
        el("event-summary").textContent = e.message;
        form.querySelector(".primary-button").disabled = true;
      }
    };
    form.oninput = update;
    update();
    const presets = saved("slipstream.presets", {});
    const presetLabel = document.createElement("label");
    presetLabel.textContent = "Preset name";
    const presetName = document.createElement("input");
    presetName.maxLength = 44;
    presetName.value = courses[c.map].name;
    presetLabel.append(presetName);
    const savedSelect = document.createElement("select");
    savedSelect.setAttribute("aria-label", "Saved presets");
    function refreshPresets() {
      savedSelect.replaceChildren(
        ...Object.keys(presets).map((k) => new Option(k, k)),
      );
      savedSelect.hidden = !savedSelect.length;
    }
    refreshPresets();
    form.querySelector(".form-actions").before(presetLabel, savedSelect);
    if (locked) {
      Array.from(form.elements).forEach((e) => (e.disabled = true));
      this.tell("The host controls the event while the party is in the lobby.");
    }
    el("save-event").onclick = () => {
      try {
        const v = read();
        makeCourse(v);
        const name = presetName.value.trim();
        if (!name) throw Error("Give the preset a name.");
        Object.defineProperty(presets, name, {
          value: v,
          enumerable: true,
          configurable: true,
        });
        localStorage.setItem("slipstream.presets", JSON.stringify(presets));
        refreshPresets();
        savedSelect.value = name;
        this.tell("Preset saved.");
      } catch (e) {
        this.tell(e.message);
      }
    };
    el("load-event").onclick = () => {
      const v = presets[savedSelect.value];
      if (v) {
        this.draft = v;
        this.show("Race Configuration");
      } else this.tell("No saved preset yet.");
    };
    form.onsubmit = (e) => {
      e.preventDefault();
      try {
        const v = read();
        if (room.id) room.send({ type: "config", config: v });
        else this.api.enter(makeCourse(v));
        this.dialog.close();
      } catch (err) {
        this.tell(err.message);
      }
    };
  }
  garage(tab) {
    const fleet = this.api.fleet,
      p = this.pane;
    if (tab === "Active Rotation") {
      p.innerHTML =
        fleet.rotation
          .map((id, i) =>
            pick(
              "slot" + i,
              "Slot " + (i + 1),
              Object.fromEntries(vehicles.map((v) => [v.id, v.name])),
            ),
          )
          .join("") + btn("save-rotation", "Save rotation");
      const slots = [...p.querySelectorAll("select")];
      slots.forEach((q, i) => (q.value = fleet.rotation[i]));
      el("save-rotation").onclick = () => {
        const ids = slots.map((q) => q.value);
        if (new Set(ids).size !== 3)
          return this.tell("Choose three different vehicles.");
        fleet.rotation = ids;
        localStorage.setItem("slipstream.rotation", JSON.stringify(ids));
        this.tell("Rotation saved.");
      };
      return;
    }
    p.innerHTML =
      '<canvas id="garage-model" aria-label="Vehicle preview. Drag to rotate."></canvas>' +
      pick(
        "model",
        "Vehicle",
        Object.fromEntries(
          vehicles.map((v) => [v.id, v.pack + " · " + v.name]),
        ),
      ) +
      '<h3 id="model-name"></h3><p id="model-stats"></p>' +
      btn("use-car", "Drive vehicle");
    const q = p.querySelector("select");
    q.value = vehicles[fleet.index].id;
    this.preview = new GaragePreview(el("garage-model"));
    const update = () => {
      const v = vehicles.find((v) => v.id === q.value);
      this.preview.select(v);
      el("model-name").textContent = v.name;
      el("model-stats").textContent =
        v.description +
        " · " +
        v.top +
        " km/h · " +
        v.mass.toLocaleString() +
        " kg · " +
        v.seconds +
        " s " +
        (v.flying ? "0–60 mph reference" : "0–100 km/h");
    };
    q.onchange = update;
    update();
    el("use-car").onclick = () => {
      if (this.api.choose(q.value)) this.dialog.close();
      else this.tell("Vehicle selection is locked for this event.");
    };
  }
  partyMenu() {
    const p = this.pane,
      room = this.api.party();
    if (!room.id) {
      p.innerHTML =
        '<label>Driver name<input id="driver-name" maxlength="24" value="Driver"></label>' +
        btn("create-party", "Create party") +
        '<label>Party code<input id="party-code" maxlength="4" autocomplete="off"></label>' +
        btn("join-party", "Join party");
      el("create-party").onclick = async () => {
        try {
          await room.create(el("driver-name").value);
        } catch (e) {
          this.tell(e.message);
        }
      };
      el("join-party").onclick = () => {
        try {
          room.join(el("party-code").value, el("driver-name").value);
        } catch (e) {
          this.tell(e.message);
        }
      };
      return;
    }
    p.innerHTML =
      "<h3>Party " +
      room.room +
      '</h3><p id="party-roster"></p><p id="party-event"></p>' +
      btn("ready-party", "Toggle ready") +
      btn("arm-party", "Start race") +
      btn("reset-party", "Return to lobby") +
      btn("exit-party", "Leave party");
    el("ready-party").onclick = () =>
      room.send({
        type: "ready",
        ready: !room.state.players.find((p) => p.id === room.id).ready,
      });
    el("arm-party").onclick = () => {
      room.send({ type: "start" });
      this.dialog.close();
    };
    el("reset-party").onclick = () => room.send({ type: "reset" });
    el("exit-party").onclick = () => {
      room.leave();
      this.show("Multiplayer");
    };
    this.partyUpdate(room.state);
  }
  partyUpdate(m) {
    if (!m) return;
    if (
      this.dialog.open &&
      ["Party Management", "Multiplayer"].includes(this.tab)
    ) {
      if (!el("party-roster")) {
        this.partyMenu();
        return;
      }
      el("party-roster").textContent = m.players
        .map(
          (p) =>
            p.name +
            " · " +
            (p.connected ? (p.ready ? "Ready" : "In lobby") : "Disconnected"),
        )
        .join("  /  ");
      el("party-event").textContent = [
        courses[m.config.map].name,
        formats[m.config.format],
        m.config.surface,
        m.config.collision,
        m.config.laps + " lap(s)",
        m.config.dnf + " s DNF",
        m.config.rules,
        classes[m.config.vehicleClass],
        m.players.length + " drivers",
      ].join(" · ");
      el("arm-party").disabled = el("reset-party").disabled =
        m.host !== this.api.party().id;
    }
  }
  update(s, vehicle) {
    const r = this.race,
      c = r.course,
      phase = r.phase;
    this.vehicle = vehicle;
    if (phase === "free") {
      this.signal.hidden = true;
      return;
    }
    if (phase !== this.lastPhase) {
      this.api.audio.tone(phase === "running" ? 780 : 390);
      this.action.hidden = phase === "running";
      this.action.textContent = terminal(phase)
        ? "Results"
        : phase === "countdown"
          ? "Cancel"
          : "Arm race";
      if (terminal(phase) && !this.api.party().id) this.finish();
      this.lastPhase = phase;
    }
    const g = c.gates[r.next];
    el("race-progress").textContent =
      phase === "running"
        ? "Lap " +
          r.lap +
          "/" +
          c.config.laps +
          " · Gate " +
          (r.next + 1) +
          "/" +
          c.gates.length +
          (g
            ? " · " + Math.round(Math.hypot(g.x - s.x, g.z - s.z)) + " m"
            : "") +
          " · " +
          formatTime(r.elapsed)
        : terminal(phase)
          ? phase
          : Math.round(c.routeLength) + " m · " + c.surface.name;
    const green = phase === "running" && r.elapsed < 0.8;
    this.signal.hidden = phase !== "countdown" && !green;
    if (!this.signal.hidden) {
      this.signal.classList.toggle("green", green);
      this.signal.querySelector("strong").textContent = green
        ? "GO"
        : r.countdown.toFixed(3).padStart(6, "0");
      this.signal.querySelector("small").textContent = green
        ? "Accelerate"
        : "Hold at the line";
      const n = Math.ceil(r.countdown);
      if (phase === "countdown" && n !== this.lastLight)
        this.api.audio.tone(380, 0.065);
      this.lastLight = n;
      this.signal
        .querySelectorAll("i")
        .forEach((l, i) => l.classList.toggle("on", green || i >= n - 1));
    }
  }
  finish() {
    const room = this.api.party(),
      r = this.race,
      c = r.course;
    el("result-title").textContent = "Race results";
    el("result-course").textContent =
      c.name + " · " + formats[c.format] + " · " + c.config.rules;
    el("result-time").textContent =
      r.phase === "finished" ? formatTime(r.elapsed) : r.phase;
    const dl = el("result-stats");
    dl.replaceChildren();
    const rows = room.state
      ? [...room.state.players].sort(
          (a, b) =>
            (a.result.phase === "finished" ? a.result.elapsed : Infinity) -
            (b.result.phase === "finished" ? b.result.elapsed : Infinity),
        )
      : [
          {
            name: "Driver",
            vehicle: this.vehicle?.id ?? "rally",
            color: "var(--accent)",
            result: r,
          },
        ];
    rows.forEach((p, i) => {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd"),
        v = vehicles.find((v) => v.id === p.vehicle),
        t = p.result;
      dt.textContent =
        (t.phase === "finished" ? i + 1 + ". " : "") + p.name + " · " + v.name;
      dt.style.color = p.color;
      dd.textContent = [
        t.phase,
        t.phase === "finished" ? formatTime(t.elapsed) : "—",
        "Reaction " + formatTime(t.reaction),
        "Line " + formatTime(t.lineTime),
        "Finish " + (t.finishSpeed * 3.6).toFixed(1) + " km/h",
        "Peak " + accelerationText(t.maxAccel),
        "Mean " + accelerationText(t.elapsed ? t.finishSpeed / t.elapsed : 0),
        t.completedLaps + " lap(s)",
      ].join(" · ");
      dl.append(dt, dd);
    });
    el("result-retry").hidden = !!room.id;
    if (!this.results.open) {
      this.dialog.close();
      this.results.showModal();
    }
  }
}

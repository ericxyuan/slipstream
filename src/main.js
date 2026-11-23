import { eligible, supportsControl } from "./vehicle/classes.js";
import "./style.css";
import * as T from "three";
import { makeCourse, defaults } from "./world/events.js";
import { surfaceAt } from "./world/surfaces.js";
import {
  buildCity,
  buildSky,
  buildStrip,
  disposeCourse,
} from "./world/racing.js";
import { buildDesert } from "./world/desert.js";
import { makeProps, stepProps } from "./world/traffic.js";
import {
  colliderView,
  propMeshes,
  surfaceOverlay,
  startFinish,
} from "./world/overlays.js";
import { Race, terminal } from "./systems/race.js";
import { RaceUI } from "./systems/race-ui.js";
import { vehicles } from "./vehicle/catalog.js";
import { initRenderer } from "./systems/render.js";
import { Fleet } from "./vehicle/fleet.js";
import { VehiclePhysics, STEP } from "./vehicle/physics.js";
import { CameraRig } from "./systems/camera.js";
import { Input } from "./systems/input.js";
import { Hud } from "./systems/hud.js";
import { DriveAudio } from "./systems/audio.js";
import { PartyClient } from "./systems/party.js";
import { Peers } from "./systems/peers.js";

const canvas = document.getElementById("world"),
  viewport = document.querySelector("main");
function fail(text) {
  const el = document.querySelector(".failure");
  el.textContent = text;
  el.hidden = false;
}
function start() {
  const { renderer, scene, draw, atmosphere } = initRenderer(canvas);
  const desert = new T.Group(),
    rocks = buildDesert(desert),
    physics = new VehiclePhysics(rocks),
    rig = new CameraRig(rocks);
  const hud = new Hud(),
    audio = new DriveAudio(),
    peers = new Peers(scene, audio),
    debug = new T.Group(),
    state = {};
  debug.visible = false;
  scene.add(debug);
  rig.bind(canvas);
  let course,
    world,
    overlay,
    race,
    ui,
    props = [],
    markers = [],
    stripScenery,
    snap = true,
    acc = 0,
    last = null,
    frameId,
    version = -1,
    roomCode,
    localBeforeSky,
    lastGate,
    clock = 0;
  let pendingVehicle,
    remote = null,
    ended = false,
    soloConfig = { ...defaults };
  const fleet = new Fleet(scene, (spec) => {
    physics.configure(spec);
    rig.configure(spec);
    hud.select(spec);
  });
  const goal = new T.Mesh(
    new T.TorusGeometry(1, 0.045, 8, 56),
    new T.MeshBasicMaterial({ color: "#77ffd0" }),
  );
  scene.add(goal);
  const party = new PartyClient(receive, (text) => {
    ui.tell(text);
    if (!ui.dialog.open) {
      const el = document.getElementById("party-hud");
      el.hidden = false;
      el.textContent = text;
    }
  });
  function select(id) {
    if (
      !eligible(
        vehicles.find((v) => v.id === id),
        course.config,
      ) ||
      course?.id === "sky" ||
      ["running", "countdown"].includes(race?.phase) ||
      party.state?.active
    )
      return false;
    if (party.id) {
      pendingVehicle = id;
      party.send({ type: "vehicle", vehicle: id });
    } else fleet.select(vehicles.findIndex((v) => v.id === id));
    audio.tone(340);
    return true;
  }
  function cycle(d) {
    const ids = fleet.rotation.filter((id) =>
      eligible(
        vehicles.find((v) => v.id === id),
        course.config,
      ),
    );
    if (!ids.length) return;
    const i = ids.indexOf(vehicles[fleet.index].id);
    select(
      ids[
        i < 0 ? (d > 0 ? 0 : ids.length - 1) : (i + d + ids.length) % ids.length
      ],
    );
  }
  function clear() {
    input.clear();
    acc = 0;
    last = null;
  }
  function restart() {
    if (party.id) {
      if (party.state?.host === party.id) party.send({ type: "reset" });
      return;
    }
    clear();
    physics.reset();
    fleet.exhaust?.clear();
    race = new Race(course);
    clock = 0;
    ui.reset(race);
    snap = true;
    props = makeProps(course);
  }
  function enter(next) {
    if (
      course?.id === "sky" &&
      next.id !== "sky" &&
      localBeforeSky !== undefined
    ) {
      fleet.select(localBeforeSky, false);
      localBeforeSky = undefined;
    }
    if (next.id === "sky" && course?.id !== "sky") {
      localBeforeSky = fleet.index;
      fleet.select(4, false);
    }
    if (!eligible(vehicles[fleet.index], next.config))
      fleet.select(
        vehicles.findIndex((v) => eligible(v, next.config)),
        false,
      );
    if (world) {
      scene.remove(world);
      if (world !== desert) disposeCourse(world);
    }
    if (overlay) {
      scene.remove(overlay);
      disposeCourse(overlay);
    }
    course = next;
    world = next.id === "desert" ? desert : new T.Group();
    const obs =
      next.id === "desert"
        ? rocks
        : { city: buildCity, sky: buildSky, drag: buildStrip }[next.id](
            world,
            next,
          );
    scene.add(world);
    atmosphere(next.id);
    rig.obstacles = obs;
    physics.setCourse(next, obs);
    hud.map.configure(next, obs);
    for (const l of debug.children) {
      l.geometry.dispose();
      l.material.dispose();
    }
    debug.clear();
    debug.userData.built = false;
    props = makeProps(next);
    overlay = new T.Group();
    scene.add(overlay);
    stripScenery = next.id === "drag" ? world : null;
    if (next.format === "drag" && ["city", "desert"].includes(next.id)) {
      stripScenery = new T.Group();
      buildStrip(stripScenery, next);
      overlay.add(stripScenery);
    }
    markers = propMeshes(overlay, props);
    surfaceOverlay(overlay, next);
    startFinish(overlay, next);
    clear();
    race = new Race(course);
    clock = 0;
    ui.reset(race);
    snap = true;
    lastGate = null;
    ended = false;
    if (!party.id) soloConfig = next.config;
  }
  function receive(m) {
    if (!m) {
      remote = null;
      version = -1;
      roomCode = null;
      hud.map.players = [];
      document.getElementById("party-hud").hidden = true;
      if (ui && course && course.config !== soloConfig)
        enter(makeCourse(soloConfig));
      return;
    }
    const self = m.players.find((p) => p.id === party.id);
    if (!self) return;
    const changed = version !== m.version || roomCode !== m.code;
    if (changed) {
      version = m.version;
      roomCode = m.code;
      enter(makeCourse(m.config, m.players.length, m.players.indexOf(self)));
    }
    if (vehicles[fleet.index].id !== self.vehicle)
      fleet.select(
        vehicles.findIndex((v) => v.id === self.vehicle),
        false,
      );
    if (
      changed ||
      Math.hypot(
        self.state.x - physics.state.x,
        self.state.z - physics.state.z,
      ) > 12
    ) {
      Object.assign(physics.state, self.state);
      Object.assign(physics.previous, self.state);
      physics.vx = self.vx;
      physics.vz = self.vz;
      physics.hoverTarget = self.state.altitude;
    }
    if (self.vehicle === pendingVehicle) {
      try {
        localStorage.setItem("slipstream.vehicle", pendingVehicle);
      } catch {}
      pendingVehicle = undefined;
    }
    remote = self;
    Object.assign(race, self.result);
    for (const [i, x, z, tilt] of m.propChanges ?? [])
      if (props[i]) Object.assign(props[i], { x, z, tilt });
    hud.map.players = m.players.filter((p) => p !== self);
    const el = document.getElementById("party-hud");
    el.hidden = false;
    const rosterKey = m.code + ":" + m.players.map((p) => p.id).join(",");
    if (
      el.dataset.roster !== rosterKey ||
      el.children.length !== m.players.length + 1
    ) {
      const heading = document.createElement("b");
      heading.textContent = "PARTY · " + m.code;
      el.replaceChildren(
        heading,
        ...m.players.map((p) => {
          const row = document.createElement("div");
          const dot = document.createElement("i");
          dot.style.backgroundColor = p.color;
          row.append(dot, document.createElement("span"));
          return row;
        }),
      );
      el.dataset.roster = rosterKey;
    }
    m.players.forEach((p, i) => {
      const distance = Math.round(
        Math.hypot(p.state.x - self.state.x, p.state.z - self.state.z),
      );
      el.children[i + 1].lastChild.textContent =
        p.name +
        " · " +
        (p.ping == null ? "—" : p.ping + " ms") +
        " · " +
        (p === self ? "You" : distance + " m");
    });
    ui.partyUpdate(m);
    if (m.active && m.players.every((p) => terminal(p.result.phase))) {
      if (!ended || ui.results.open) ui.finish();
      ended = true;
    }
  }
  const input = new Input({
    vehicle: cycle,
    previous: () => cycle(-1),
    next: () => cycle(1),
    reset: restart,
    menu: () => ui.toggle(),
    configure: () => ui.toggle("Race Configuration"),
    partyMenu: () => ui.toggle("Party Management"),
    ready: () => ui.ready(),
    arm: () => ui.arm(),
    cancel: () => {
      if (race.phase === "countdown") ui.arm();
    },
    camera: () => {
      hud.camera.textContent = rig.cycle();
      snap = true;
    },
  }, action => supportsControl(vehicles[fleet.index], action));
  const quality = (v) => {
    renderer.setPixelRatio(Math.min(devicePixelRatio, v === "low" ? 1 : 1.65));
    renderer.shadowMap.enabled = v !== "low";
  };
  ui = new RaceUI({
    fleet,
    hud,
    audio,
    debug,
    quality,
    choose: select,
    clear,
    enter,
    restart,
    party: () => party,
  });
  try {
    quality(JSON.parse(localStorage.getItem("slipstream.quality")) ?? "high");
  } catch {}
  enter(makeCourse(defaults));
  party.resume();
  new ResizeObserver(() => {
    const { width, height } = viewport.getBoundingClientRect();
    renderer.setSize(width, height, false);
    rig.resize(width, height);
  }).observe(viewport);
  window.addEventListener("blur", clear);
  document.addEventListener("visibilitychange", () => {
    clear();
    audio.mute(document.hidden);
  });
  canvas.addEventListener("pointerdown", () =>
    canvas.focus({ preventScroll: true }),
  );
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    cancelAnimationFrame(frameId);
    clear();
    fail("Graphics interrupted. Waiting for the display to recover.");
  });
  canvas.addEventListener("webglcontextrestored", () => {
    document.querySelector(".failure").hidden = true;
    snap = true;
    frameId = requestAnimationFrame(frame);
  });
  function frame(now) {
    frameId = requestAnimationFrame(frame);
    if (document.hidden) return;
    if (ui.paused) {
      last = null;
      audio.mute(true);
      return;
    }
    if (last === null) audio.mute(false);
    const elapsed = last === null ? 0 : (now - last) / 1000;
    last = now;
    const dt = Math.min(0.12, elapsed);
    const controls = ui.dialog.open || ui.results.open ? {} : input.read();
    party.input(controls, now);
    clock += elapsed;
    acc += dt;
    while (acc >= STEP) {
      if (party.id && remote) {
        if (["running", "free"].includes(race.phase))
          physics.step(controls, STEP);
        const age = Math.min(
            0.15,
            (now - party.received) / 1000 + (party.ping ?? 0) / 2000,
          ),
          blend = 1 - Math.exp(-STEP * 7);
        physics.state.x +=
          (remote.state.x + remote.vx * age - physics.state.x) * blend;
        physics.state.z +=
          (remote.state.z + remote.vz * age - physics.state.z) * blend;
        physics.state.heading +=
          (remote.state.heading - physics.state.heading) * blend;
        physics.state.altitude +=
          (remote.state.altitude - physics.state.altitude) * blend;
        physics.vx += (remote.vx - physics.vx) * blend;
        physics.vz += (remote.vz - physics.vz) * blend;
      } else {
        race.step(physics, controls, STEP, clock - acc + STEP);
        stepProps(props, [physics], STEP);
      }
      acc -= STEP;
    }
    if (party.id && remote && race.phase === "countdown")
      race.countdown = Math.max(
        0,
        race.green - party.state.server - (now - party.received) / 1000,
      );
    const roll = physics.sample(acc / STEP, state),
      g = course.gates[race.next];
    if (g !== lastGate || snap) {
      hud.map.target(g);
      goal.visible = !!g && course.format !== "free";
      if (g) {
        goal.position.set(g.x, course.id === "sky" ? g.y : 2.7, g.z);
        goal.rotation.y = Math.atan2(-g.dx, -g.dz);
        goal.scale.setScalar(course.id === "sky" ? g.radius : 2.3);
      }
      lastGate = g;
    }
    props.forEach((p, i) => {
      if (markers[i]) {
        markers[i].position.set(p.x, 0.05, p.z);
        markers[i].rotation.z = p.tilt;
      }
    });
    if (debug.visible && !debug.userData.built) {
      colliderView(debug, rig.obstacles);
      debug.userData.built = true;
    }
    const spec = vehicles[fleet.index],
      surface = surfaceAt(course, state.x, state.z);
    ui.update(state, spec);
    fleet.update(dt, state, roll, state.brake > 0.12 || state.regen > 1.3);
    peers.update(party.state, party.id, state, dt, course.id, surface);
    rig.update(state, dt, snap);
    snap = false;
    hud.update(state, controls, elapsed);
    audio.update("local", state, spec, state, surface, course.id);
    stripScenery?.userData.followStrip(state.z);
    draw(rig.camera, state);
  }
  frameId = requestAnimationFrame(frame);
}
try {
  start();
} catch (e) {
  console.error(e);
  fail(
    "SlipStream could not start. Check that browser hardware acceleration is enabled and reload.",
  );
}

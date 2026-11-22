import "./style.css";
import * as T from "three";
import { courseLayout } from "./world/courses.js";
import { buildCity, buildSky, buildStrip, disposeCourse } from "./world/racing.js";
import { Race } from "./systems/race.js";
import { RaceUI } from "./systems/race-ui.js";
import { vehicles } from "./vehicle/catalog.js";
import { initRenderer } from "./systems/render.js";
import { buildDesert } from "./world/desert.js";
import { Fleet } from "./vehicle/fleet.js";
import { VehiclePhysics, STEP } from "./vehicle/physics.js";
import { CameraRig } from "./systems/camera.js";
import { Input } from "./systems/input.js";
import { Hud } from "./systems/hud.js";

const canvas = document.querySelector("#world"),
  viewport = document.querySelector("main");
function fail(text) {
  const message = document.querySelector(".failure");
  message.textContent = text;
  message.hidden = false;
  document.querySelector(".live").lastChild.textContent = "System offline";
}
function start() {
  const { renderer, scene, draw, atmosphere } = initRenderer(canvas);
  const desert = new T.Group(), desertObstacles = buildDesert(desert);
  const physics = new VehiclePhysics(desertObstacles), rig = new CameraRig(desertObstacles);
  const hud = new Hud(), state = {};
  let course, world, race, savedVehicle, accumulator = 0, previousTime = null, snap = true, frameTimer = null;
  const fleet = new Fleet(scene, (spec) => {
    physics.configure(spec);
    rig.configure(spec);
    hud.select(spec);
  });
  const target = new T.Mesh(new T.TorusGeometry(1, 0.035, 8, 64),
    new T.MeshBasicMaterial({ color: "#76ffd2" }));
  scene.add(target);

  function cycle(direction) {
    if (course.id === "sky" || ["running", "countdown", "finished"].includes(race.phase)) return;
    fleet.cycle(direction);
    if (course.id === "drag") document.querySelector(".flight-controls").hidden = true;
  }
  function restart() {
    input.clear();
    physics.reset();
    fleet.exhaust?.clear();
    race = new Race(course);
    ui.reset(race);
    accumulator = 0;
    previousTime = null;
    snap = true;
  }
  function enter(next) {
    if (world) {
      scene.remove(world);
      if (world !== desert) disposeCourse(world);
    }
    if (next.id === "sky" && course?.id !== "sky") {
      savedVehicle = fleet.index;
      fleet.select(vehicles.findIndex(v => v.flying), false);
    } else if (course?.id === "sky" && next.id !== "sky") fleet.select(savedVehicle, false);
    course = next;
    world = next.id === "desert" ? desert : new T.Group();
    const builders = { drag: buildStrip, city: buildCity, sky: buildSky };
    const obstacles = next.id === "desert" ? desertObstacles : builders[next.id](world, next);
    scene.add(world);
    atmosphere(next.id);
    rig.obstacles = obstacles;
    physics.setCourse(next, obstacles);
    hud.map.configure(next, obstacles);
    document.querySelector(".flight-controls").hidden = next.id === "drag" || !vehicles[fleet.index].flying;
    restart();
  }
  const input = new Input({
    vehicle: cycle,
    previous: () => cycle(-1),
    next: () => cycle(1),
    reset: restart,
    camera() {
      hud.camera.textContent = rig.cycle();
      snap = true;
    },
  });
  const ui = new RaceUI(enter, restart, () => { input.clear(); previousTime = null; accumulator = 0; });
  enter(courseLayout("desert"));
  const vehicleButtons = document.querySelectorAll('[data-control="previous"], [data-control="next"]');
  let lastGate, lastLock;
  function resize() {
    const { width, height } = viewport.getBoundingClientRect();
    renderer.setSize(width, height, false);
    rig.resize(width, height);
  }
  new ResizeObserver(resize).observe(viewport);
  resize();
  function resetClock() {
    previousTime = null;
    accumulator = 0;
    input.clear();
  }
  window.addEventListener("blur", resetClock);
  document.addEventListener("visibilitychange", resetClock);
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    clearTimeout(frameTimer);
    frameTimer = null;
    resetClock();
    fail(
      "Graphics interrupted. Waiting for the browser to restore the display.",
    );
  });
  canvas.addEventListener("webglcontextrestored", () => {
    document.querySelector(".failure").hidden = true;
    document.querySelector(".live").lastChild.textContent = "System online";
    resetClock();
    snap = true;
    scheduleFrame();
  });
  canvas.addEventListener("pointerdown", () =>
    canvas.focus({ preventScroll: true }),
  );
  function frame(now) {
    scheduleFrame();
    if (document.hidden || ui.paused) return;
    const elapsed = previousTime === null ? 0 : (now - previousTime) / 1000;
    previousTime = now;
    const dt = Math.min(0.1, elapsed),
      controls = input.read();
    accumulator += dt;
    while (accumulator >= STEP) {
      race.step(physics, controls, STEP);
      accumulator -= STEP;
    }
    const roll = physics.sample(race.phase === "finished" ? 1 : accumulator / STEP, state);
    const gate = course.gates[race.next];
    if (lastGate !== gate || snap) {
      hud.map.target(gate);
      target.visible = !!gate && (course.id === "sky" || course.id === "city");
      if (target.visible) {
        target.position.set(gate.x, course.id === "sky" ? gate.y : 4, gate.z + 0.34);
        target.rotation.y = Math.atan2(-gate.dx, -gate.dz);
        target.scale.setScalar(course.id === "sky" ? gate.radius : 2);
      }
      lastGate = gate;
    }
    const locked = course.id === "sky" || ["running", "countdown", "finished"].includes(race.phase);
    if (lastLock !== locked) {
      vehicleButtons.forEach(button => { button.disabled = locked; });
      lastLock = locked;
    }
    ui.update(state, vehicles[fleet.index]);
    fleet.update(dt, state, roll, state.brake > 0.12);
    rig.update(state, dt, snap);
    snap = false;
    hud.update(state, controls, elapsed);
    draw(rig.camera, state);
  }
  function scheduleFrame() {
    frameTimer = setTimeout(() => frame(performance.now()), 0);
  }
  scheduleFrame();
}
try {
  start();
} catch (error) {
  console.error(error);
  fail(
    "Slipstream could not start its 3D renderer. Enable hardware acceleration in your browser and reload.",
  );
}

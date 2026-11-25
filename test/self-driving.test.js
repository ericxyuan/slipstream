import test from "node:test";
import assert from "node:assert/strict";
import { SelfDriver } from "../src/systems/self-driving.js";
import { Input } from "../src/systems/input.js";
import { Race } from "../src/systems/race.js";
import { VehiclePhysics, STEP } from "../src/vehicle/physics.js";
import { vehicles } from "../src/vehicle/catalog.js";
import { makeCourse } from "../src/world/events.js";
import { onCoastRoad } from "../src/world/coast.js";
import { streetsX, streetsZ, roadWidth } from "../src/world/city.js";
import { roadDistance } from "../src/world/road.js";

function onRoad(course, x, z) {
  if (course.format === "drag" || course.id === "drag")
    return Math.abs(x - course.stripX) <= course.stripWidth / 2 + 1;
  if (course.id === "desert") return roadDistance(x, z) <= 7.9;
  if (course.id === "coast") return onCoastRoad(x, z, 7.8);
  return streetsX.some(p => Math.abs(x - p) <= roadWidth("x", p) / 2) ||
    streetsZ.some(p => Math.abs(z - p) <= roadWidth("z", p) / 2);
}

function checkFootprint(car, course) {
  const { x, z, heading } = car.state;
  for (const end of [-0.5, 0.5]) {
    for (const side of [-0.5, 0.5]) {
      const along = end * car.spec.length, across = side * car.spec.width;
      const px = x + along * Math.sin(heading) + across * Math.cos(heading);
      const pz = z + along * Math.cos(heading) - across * Math.sin(heading);
      assert.ok(onRoad(course, px, pz), `Body left the road at ${px}, ${pz}`);
    }
  }
}

function driveRace(settings, vehicle, count = 1, lane = 0) {
  const course = makeCourse(settings, count, lane);
  const car = new VehiclePhysics([]);
  car.configure(vehicles.find(v => v.id === vehicle));
  car.setCourse(course, []);
  const driver = new SelfDriver(course, car.spec, car.state);
  const race = new Race(course);
  race.start();
  let braking = false;
  for (let i = 0; i < 240 / STEP && race.phase !== "finished"; i++) {
    const input = race.phase === "running" ? driver.controls(car) : {};
    race.step(car, input, STEP);
    braking ||= car.state.brake > 0.25;
    if (i % 5 === 0) checkFootprint(car, course);
  }
  assert.equal(race.phase, "finished");
  return { race, braking, car };
}

test("self-driving uses grip to select speed and crosses corner gates with the whole car on the city streets", () => {
  const settings = { map: "city", format: "circuit" };
  const dry = driveRace(settings, "u9");
  const ice = driveRace({ ...settings, surface: "ice" }, "u9");
  assert.ok(dry.braking && ice.braking);
  assert.ok(dry.race.maxSpeed > ice.race.maxSpeed * 2);
});

test("self-driving completes reverse mixed-surface laps and a shortened desert sprint on the road", () => {
  driveRace({ map: "coast", format: "circuit", reverse: true, laps: 2, start: 25, surface: "mixed" }, "bus");
  driveRace({ map: "desert", format: "sprint", route: "short" }, "roadster");
});

test("self-driving holds its assigned drag lane at full throttle through the finish", () => {
  const { car, race, braking } = driveRace({ map: "desert", format: "drag", distance: 1600, reverse: true }, "sport", 8, 1);
  assert.equal(car.state.x, car.course.spawn.x);
  assert.equal(braking, false);
  assert.ok(race.finishSpeed > 85);
});

test("the bus turns around on the pavement during a strip circuit", () => {
  driveRace({ map: "drag", format: "circuit", laps: 2 }, "bus");
});

test("F toggles once per press and immediately hands back held manual controls", t => {
  const win = new EventTarget(), document = new EventTarget();
  document.querySelector = () => null;
  document.querySelectorAll = () => [];
  t.after(() => { delete globalThis.window; delete globalThis.document; });
  globalThis.window = win;
  globalThis.document = document;
  let enabled = false, starts = 0;
  const input = new Input({ selfDrive: () => { enabled = !enabled; }, arm: () => { starts++; } });
  const key = (code, type = "keydown", repeat = false) =>
    win.dispatchEvent(Object.assign(new Event(type), { code, repeat }));
  key("KeyF");
  key("KeyF", "keydown", true);
  assert.equal(enabled, true);
  key("KeyF", "keyup");
  key("KeyA");
  key("KeyF");
  assert.equal(enabled, false);
  assert.equal(input.read().left, true);
  assert.equal(starts, 0);
  key("KeyT");
  assert.equal(starts, 1);

  // Changing an environment slider leaves browser focus on the input.
  win.closest = () => ({ closest: selector => selector === ".conditions" });
  key("KeyF");
  assert.equal(enabled, true);
  win.closest = () => ({ closest: () => null });
  key("KeyF");
  assert.equal(enabled, true);
});

import test from "node:test";
import assert from "node:assert/strict";
import { courseLayout, crossing } from "../src/world/courses.js";
import { Race } from "../src/systems/race.js";
import { VehiclePhysics, STEP } from "../src/vehicle/physics.js";
import { vehicles } from "../src/vehicle/catalog.js";

function stage(id, length, surface, spec = vehicles[0], preload = false) {
  const course = courseLayout(id, length, surface);
  const car = new VehiclePhysics([]);
  car.configure(spec);
  car.setCourse(course, []);
  const race = new Race(course);
  const start = { ...car.state };
  race.start();
  for (let i = 0; i < 360; i++) race.step(car, { forward: preload }, STEP);
  assert.equal(car.state.z, start.z);
  assert.equal(car.state.groundSpeed, 0);
  assert.equal(car.state.throttle, 0);
  assert.equal(race.phase, "running");
  assert.equal(race.elapsed, 0);
  return { car, race };
}

function dragRun(length, surface, delay = 0) {
  const { car, race } = stage("drag", length, surface, vehicles[0], false);
  for (let i = 0; i < delay; i++) race.step(car, {}, STEP);
  for (let i = 0; i < 60000 && race.phase !== "finished"; i++) race.step(car, { forward: true }, STEP);
  assert.equal(race.phase, "finished");
  assert.ok(car.previous.z > -length && car.state.z <= -length);
  return race;
}

test("the timing slip includes reaction time and stops at the selected finish line", () => {
  const staged = dragRun(50, "prepared"), manual = dragRun(50, "prepared", 40);
  assert.equal(staged.reaction, 0);
  assert.ok(Math.abs(manual.reaction - 40 * STEP) < 1e-9);
  assert.ok(Math.abs(manual.elapsed - staged.elapsed - manual.reaction) < STEP);
  assert.ok(dragRun(2000, "prepared").elapsed > staged.elapsed);
});

test("the same launch on progressively looser surfaces trades acceleration for wheel spin", () => {
  const runs = ["prepared", "wet", "gravel", "ice"].map(s => dragRun(402, s));
  for (let i = 1; i < runs.length; i++) {
    assert.ok(runs[i].maxSlip > runs[i - 1].maxSlip && runs[i].maxSlip <= 1);
    assert.ok(runs[i].maxAccel < runs[i - 1].maxAccel);
    assert.ok(runs[i].maxSpeed < runs[i - 1].maxSpeed);
    assert.ok(runs[i].elapsed > runs[i - 1].elapsed);
  }
});

test("the Roadster can use cold-gas propulsion over a drag strip", () => {
  const { car, race } = stage("drag", 201, "wet", vehicles.find(v => v.flying));
  for (let i = 0; i < 240; i++) race.step(car, { forward: true, rise: true }, STEP);
  assert.ok(car.state.altitude > 1);
  assert.ok(car.state.rearThrust > 0 && car.state.mode === 2);
});

for (const id of ["city", "sky"]) test(id + " requires every gate in order with a directed crossing", () => {
  const { race } = stage(id);
  const gates = race.course.gates;
  const cross = (g, offset = 0, reverse = false) => {
    const point = d => ({ x: g.x + g.dx * d, z: g.z + g.dz * d,
      altitude: g.y + offset, groundSpeed: 10, wheelSlip: 0 });
    const before = point(reverse ? 1 : -1), after = point(reverse ? -1 : 1);
    race.step({ previous: before, state: after, step() {} }, {}, STEP);
  };
  cross(gates.at(-1));
  cross(gates[0], 0, true);
  if (id === "sky") cross(gates[0], gates[0].radius + 1);
  assert.equal(race.next, 0);
  for (const gate of gates) cross(gate);
  assert.equal(race.phase, "finished");
  assert.equal(race.next, gates.length);
  const elapsed = race.elapsed;
  race.step(null, {}, STEP);
  assert.equal(race.elapsed, elapsed);
});

test("crossing the finish line outside the strip does not count", () => {
  const g = courseLayout("drag", 150).gates[0];
  assert.equal(crossing(g, { x: 14, z: -149 }, { x: 14, z: -152 }, false), null);
  assert.equal(crossing(g, { x: 0, z: -149 }, { x: 0, z: -152 }, false), 1 / 3);
});

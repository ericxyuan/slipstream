import test from "node:test";
import assert from "node:assert/strict";
import { vehicles } from "../src/vehicle/catalog.js";
import { VehiclePhysics, STEP } from "../src/vehicle/physics.js";
import { makeCourse, formats } from "../src/world/events.js";
import { flight, flightBase } from "../src/vehicle/lift.js";
import { Race } from "../src/systems/race.js";
import { collideVehicles } from "../src/world/traffic.js";
import { surfaceAt } from "../src/world/surfaces.js";
function vehicle(
  spec,
  config = { map: "drag", format: "free", distance: 2000 },
) {
  const car = new VehiclePhysics([]);
  car.configure(spec);
  car.setCourse(makeCourse(config), []);
  return car;
}
test("each map offers finite routes, a directed start, and free drive", () => {
  for (const map of ["city", "sky", "desert", "drag"])
    for (const format of Object.keys(formats))
      for (const reverse of [true, false]) {
        const c = makeCourse({ map, format, reverse, start: 10, end: 90 });
        assert.ok(c.routeLength > 0);
        assert.ok(
          c.gates.every((g) => Math.abs(Math.hypot(g.dx, g.dz) - 1) < 0.01),
        );
        assert.equal(c.gates.length === 0, format === "free");
        if (format === "circuit")
          assert.ok(
            Math.hypot(
              c.route.at(-1).x - c.route[0].x,
              c.route.at(-1).z - c.route[0].z,
            ) < 0.01,
          );
      }
});
test("early throttle earns a false start and cancelling leaves the car stationary", () => {
  const c = vehicle(vehicles[0], { map: "drag", format: "drag" }),
    r = new Race(c.course);
  r.start();
  r.cancel();
  assert.equal(r.phase, "ready");
  r.start();
  r.step(c, { forward: true }, STEP);
  assert.equal(r.phase, "false-start");
  assert.ok(r.reaction < 0);
  assert.equal(c.state.speed, 0);
});
test("tyres, thrusters and regen agree at 20 cm of lift", () => {
  const c = vehicle(vehicles[4]);
  c.state.altitude = c.hoverTarget = 0.2;
  const roll = c.roll;
  for (let i = 0; i < 100; i++) c.step({ forward: true });
  assert.equal(c.roll, roll);
  assert.equal(c.state.support, 0);
  assert.ok(c.state.rearThrust > 0);
  for (let i = 0; i < 120; i++) c.step({});
  assert.equal(c.state.regen, 0);
  for (const key in flightBase)
    assert.equal(flight[key], flightBase[key] * 1.8);
});
test("lift-off regen reduces kinetic energy and returns energy to the battery", () => {
  for (const spec of vehicles.filter((v) => v.electric)) {
    const c = vehicle(spec);
    c.vz = -16;
    c.state.speed = 16;
    for (let i = 0; i < 120; i++) c.step({});
    assert.ok(c.state.groundSpeed < 15);
    assert.equal(c.state.regen / 4, 0.375);
    assert.ok(c.state.energy > 0 && c.state.battery > 0.75);
  }
});
test("U9 jump is ballistic, settles and requires a fresh press", () => {
  const c = vehicle(vehicles[5]);
  let peaks = 0,
    apex = 0,
    air = false;
  for (let i = 0; i < 400; i++) {
    c.step({ jump: true });
    apex = Math.max(apex, c.state.altitude);
    if (!air && c.state.airborne) peaks++;
    air = c.state.airborne;
  }
  assert.equal(peaks, 1);
  assert.ok(apex > 0.18 && apex < 0.22);
  assert.equal(c.state.altitude, 0);
  assert.ok(!c.state.rearThrust);
});
test("fictional launches and facelift i8 match their calibrated targets", () => {
  for (const spec of [...vehicles.slice(0, 4), vehicles[6]]) {
    const c = vehicle(spec);
    let t = 0;
    while (t < 8 && c.state.speed * 3.6 < 100) {
      c.step({ forward: true });
      t += STEP;
    }
    assert.ok(Math.abs(t - spec.seconds) < 0.12, spec.id + " " + t);
  }
});
test("a longer race counts gates in order across laps", () => {
  const c = makeCourse({ map: "city", format: "circuit", laps: 2 }),
    r = new Race(c);
  r.start();
  r.phase = "running";
  for (let lap = 1; lap <= 2; lap++)
    for (const g of c.gates) {
      const state = (d) => ({
        x: g.x + g.dx * d,
        z: g.z + g.dz * d,
        groundSpeed: 10,
        wheelSlip: 0,
        altitude: 0,
      });
      r.step({ previous: state(-1), state: state(1), step() {} }, {}, STEP);
    }
  assert.equal(r.completedLaps, 2);
  assert.equal(r.phase, "finished");
});
test("drag lane centres, per-section surfaces and mass-weighted collisions", () => {
  const grid = Array.from({ length: 5 }, (_, i) =>
    makeCourse(
      {
        map: "drag",
        format: "drag",
        surface: "custom",
        sections: "ice,gravel",
      },
      5,
      i,
    ),
  );
  assert.equal(new Set(grid.map((c) => c.spawn.x)).size, 5);
  assert.equal(surfaceAt(grid[0], 0, -350).id, "gravel");
  const a = vehicle(vehicles[0]),
    b = vehicle(vehicles[3]);
  a.state.z = 2;
  b.state.z = -2;
  a.vz = -10;
  collideVehicles(a, b);
  assert.ok(a.vz > -8 && b.vz < 0);
  assert.ok(Math.abs(b.vz) < 2);
});

test("freight overhead clears a bus and blocks an elevated Roadster", async () => {
  const { citySolids, freightPassage: p } =
    await import("../src/world/city.js");
  const obs = citySolids().filter((o) => o.minY === p.clearance);
  const car = vehicle(vehicles[2], { map: "city", format: "free" });
  car.obstacles = obs;
  Object.assign(car.state, { x: p.x, z: p.z + 13, altitude: 0 });
  car.step({});
  assert.equal(car.state.z, p.z + 13);
  car.configure(vehicles[4]);
  car.state.altitude = car.hoverTarget = p.clearance + 0.3;
  car.step({});
  assert.ok(Math.abs(car.state.z - p.z) >= p.rz);
});
test("lighter roadside objects receive most of a heavy vehicle's collision velocity", async () => {
  const { makeProps, stepProps } = await import("../src/world/traffic.js");
  const truck = vehicle(vehicles[3]),
    props = makeProps(makeCourse({ map: "desert" }));
  const rock = props.find((p) => p.kind === "rock");
  Object.assign(rock, { x: truck.state.x, z: truck.state.z - 2 });
  truck.vz = -10;
  stepProps([rock], [truck], STEP);
  assert.ok(rock.vz < -8 && truck.vz < -9.9 && rock.touched);
});
test("class eligibility and route validation use the same rules as the host", async () => {
  const { eligible } = await import("../src/vehicle/classes.js");
  const { validate } = await import("../src/world/events.js");
  const config = validate({ vehicleClass: "heavy", map: "city" });
  assert.deepEqual(
    vehicles.filter((v) => eligible(v, config)).map((v) => v.id),
    ["bus", "semi"],
  );
  assert.throws(() => validate({ ...config, map: "sky" }));
  assert.throws(() => validate({ start: 70, end: 20 }));
});

test("drag length sets the actual finish and bounds in every map and direction", () => {
  for (const map of ["city", "desert", "sky", "drag"])
    for (const reverse of [true, false])
      for (const distance of [1, 402, 100_000, 1_000_000]) {
        const c = makeCourse({ map, format: "drag", distance, reverse, start: 10, end: 70 }, 12, 11);
        const gate = c.gates[0], start = c.startLine;
        assert.equal(c.routeLength, distance);
        assert.equal(Math.hypot(gate.x - start.x, gate.z - start.z), distance);
        assert.equal(Math.sign(gate.dz), reverse ? 1 : -1);
        assert.ok(c.spawn.z >= c.bounds[2] && c.spawn.z <= c.bounds[3]);
        assert.ok(gate.z > c.bounds[2] && gate.z < c.bounds[3]);
        assert.ok(Math.abs(c.spawn.x - gate.x) < gate.radius);
        assert.deepEqual(makeCourse(c.config, 12, 11).spawn, c.spawn);
        const at = (d) => ({ x: c.spawn.x, z: gate.z + gate.dz * d, altitude: gate.y, wheelSlip: 0, groundSpeed: 40 });
        const r = new Race(c);
        r.start(0);
        r.step({previous: at(-0.1), state: at(0.1), step() {}}, {}, STEP, 4);
        assert.equal(r.phase, "finished");
      }
  for (const distance of [0, -1, 10.5, Infinity, NaN])
    assert.throws(() => makeCourse({ format: "drag", distance }));
});
test("race-specific fields match the active format, map and party", async () => {
  const { eventOptions } = await import("../src/world/events.js");
  const drag = eventOptions("city", "drag", "custom", false);
  assert.ok(drag.sections && drag.distance && drag.reverse);
  assert.ok(!drag.route && !drag.start && !drag.end && !drag.checkpoints && !drag.laps && !drag.dnf);
  const circuit = eventOptions("city", "circuit", "original", true);
  assert.ok(circuit.laps && circuit.checkpoints && circuit.route && circuit.dnf);
  assert.ok(!circuit.distance && !circuit.end && !circuit.sections);
  const sky = eventOptions("sky", "free", "custom", false);
  assert.ok(!sky.surface && !sky.sections && !sky.vehicleClass && !sky.countdown);
});
test("the acceleration display combines lateral and vertical components in both units", async () => {
  const { combinedAcceleration } = await import("../src/systems/readouts.js");
  assert.equal(combinedAcceleration({ lateralAccel: -3, verticalAccel: 4, acceleration: 50 }), "5.00 m/s² · 0.51 g");
});
test("only the U9 accepts jump and only the Roadster accepts lift", async () => {
  const { supportsControl } = await import("../src/vehicle/classes.js");
  for (const v of vehicles) {
    assert.equal(supportsControl(v, "jump"), !!v.jump);
    assert.equal(supportsControl(v, "rise"), !!v.flying);
    assert.equal(supportsControl(v, "lower"), !!v.flying);
    assert.equal(supportsControl(v, "forward"), true);
  }
});

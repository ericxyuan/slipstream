import { vehicles } from "../src/vehicle/catalog.js";
import test from "node:test";
import assert from "node:assert/strict";
import { VehiclePhysics, STEP, SPAWN, gear } from "../src/vehicle/physics.js";

const idle = {
  forward: false,
  back: false,
  left: false,
  right: false,
  handbrake: false,
};

function drive(car, seconds, controls) {
  const input = { ...idle, ...controls };
  for (let i = 0; i < Math.round(seconds / STEP); i++) car.step(input);
}

test("accelerating and steering can be combined; the handbrake slows the car", () => {
  const car = new VehiclePhysics([]);
  drive(car, 2, { forward: true });
  assert.ok(car.state.speed > 12);
  drive(car, 1, { forward: true, left: true });
  assert.ok(car.state.x < SPAWN.x - 2);
  assert.ok(car.state.heading > 0);
  const before = car.state.speed;
  drive(car, 0.75, { handbrake: true });
  assert.ok(car.state.speed < before - 6);
});

test("holding brake stops the car before reversing, and reset clears all momentum", () => {
  const car = new VehiclePhysics([]);
  drive(car, 1, { forward: true });
  drive(car, 0.25, { back: true });
  assert.ok(car.state.speed > 0);
  drive(car, 2, { back: true });
  assert.equal(gear(car.state.speed), "R");
  car.reset();
  assert.deepEqual(car.state, SPAWN);
  drive(car, 0.5, {});
  assert.equal(car.state.x, SPAWN.x);
  assert.equal(car.state.z, SPAWN.z);
  assert.equal(Math.abs(car.state.speed), 0);
  assert.equal(gear(car.state.speed), "N");
});

test("a sustained throttle cannot push the car through a solid obstacle", () => {
  const car = new VehiclePhysics([{ x: SPAWN.x, z: 0, rx: 1, rz: 1 }]);
  drive(car, 8, { forward: true });
  assert.ok(car.state.z >= 3.04 && car.state.z < 3.1);
  assert.ok(Math.abs(car.state.speed) < 0.1);
});

test("equal physics time yields the same pose at different display rates", () => {
  const final = [30, 60, 144].map((fps) => {
    let accumulator = 0;
    const car = new VehiclePhysics([]);
    for (let frame = 0; frame < fps * 3; frame++) {
      accumulator += 1 / fps;
      while (accumulator + 1e-10 >= STEP) {
        car.step({ ...idle, forward: true, left: true });
        accumulator -= STEP;
      }
    }
    return car.state;
  });
  assert.deepEqual(final[0], final[1]);
  assert.deepEqual(final[0], final[2]);
});

test("pedal pressure rises progressively, and steering centres on release", () => {
  const car = new VehiclePhysics([]);
  drive(car, 0.1, { forward: true, left: true });
  assert.ok(car.state.throttle > 0 && car.state.throttle < 0.5);
  assert.ok(car.state.steer > 0);
  drive(car, 0.7, { forward: true });
  assert.equal(car.state.throttle, 1);
  assert.ok(Math.abs(car.state.steer) < 0.001);
  drive(car, 0.1, { back: true });
  assert.ok(car.state.brake > 0 && car.state.brake < 0.5);
  drive(car, 0.5, { right: true });
  assert.equal(car.state.brake, 0);
  assert.ok(car.state.steer < 0);
});

test("changing vehicle preserves motion and uses the new body length", () => {
  const car = new VehiclePhysics([{ x: SPAWN.x, z: 0, rx: 1, rz: 1 }]);
  drive(car, 0.75, { forward: true });
  const before = { ...car.state };
  car.configure(vehicles.find((v) => v.id === "bus"));
  assert.deepEqual(car.state, before);
  drive(car, 8, { forward: true });
  assert.ok(car.state.z >= 5.59 && car.state.z < 5.62);
});

test("the Roadster clears low obstacles in flight and a ground vehicle settles after a swap", () => {
  const car = new VehiclePhysics([
    { x: SPAWN.x, z: 5, rx: 1, rz: 1, height: 2 },
  ]);
  car.configure(vehicles.find((v) => v.flying));
  drive(car, 1, { rise: true });
  assert.ok(car.state.altitude > 2.2 && car.state.altitude < car.hoverTarget);
  drive(car, 3, { forward: true });
  assert.ok(car.state.z < 2);
  const before = { ...car.state };
  car.configure(vehicles[0]);
  assert.deepEqual(car.state, before);
  drive(car, 3, {});
  assert.equal(car.state.altitude, 0);
});

test("class profiles produce distinct launches, stopping distances and turn-in", () => {
  const measurements = {};
  for (const spec of vehicles) {
    const car = new VehiclePhysics([]);
    car.configure(spec);
    car.hoverTarget = 0;
    drive(car, 2, { forward: true });
    const launchSpeed = car.state.speed;
    car.reset();
    car.hoverTarget = 0;
    car.vz = -15;
    const start = car.state.z;
    let steps = 0;
    while (Math.abs(car.vz) > 0.24 && steps++ < 900)
      car.step({ ...idle, back: true });
    const stoppingDistance = start - car.state.z;
    car.reset();
    car.hoverTarget = 0;
    car.vz = -9;
    drive(car, 0.7, { left: true });
    measurements[spec.id] = {
      launchSpeed,
      stoppingDistance,
      heading: car.state.heading,
    };
  }
  const { rally, sport, bus, semi, roadster } = measurements;
  assert.ok(
    roadster.launchSpeed > sport.launchSpeed &&
      sport.launchSpeed > rally.launchSpeed,
  );
  assert.ok(
    rally.launchSpeed > semi.launchSpeed && semi.launchSpeed > bus.launchSpeed,
  );
  assert.ok(
    bus.stoppingDistance > semi.stoppingDistance &&
      semi.stoppingDistance > sport.stoppingDistance,
  );
  assert.ok(rally.heading > bus.heading && sport.heading > semi.heading);
});

test("rocket thrust moves the airborne car with stationary wheels, including when yawing", () => {
  const car = new VehiclePhysics([]);
  car.configure(vehicles.find((v) => v.flying));
  drive(car, 2, { rise: true });
  const originalRoll = car.roll;
  drive(car, 1, { forward: true });
  assert.ok(car.state.rearThrust > 0.8 && car.state.speed > 4);
  assert.equal(car.roll, originalRoll);
  drive(car, 0.6, {});
  const coastingX = car.vx;
  drive(car, 1, { left: true });
  assert.ok(car.state.heading > 0.4);
  assert.equal(car.state.steer, 0);
  assert.equal(car.roll, originalRoll);
  assert.ok(Math.abs(car.vx - coastingX) < 0.01);
  drive(car, 1, { forward: true });
  assert.ok(car.vx < coastingX - 3);
  drive(car, 5, { lower: true });
  assert.equal(car.state.altitude, 0);
  drive(car, 1, { forward: true });
  assert.notEqual(car.roll, originalRoll);
  assert.equal(car.state.rearThrust, 0);
});

test("lift, hover and landing ramp vertical velocity and settle without oscillation", () => {
  const car = new VehiclePhysics([]);
  car.configure(vehicles.find((v) => v.flying));
  car.step({ ...idle, rise: true });
  assert.ok(car.state.verticalSpeed > 0 && car.state.verticalSpeed < 0.1);
  drive(car, 1, { rise: true });
  const rising = car.state.verticalSpeed;
  car.step(idle);
  assert.ok(car.state.verticalSpeed > rising - 0.1);
  drive(car, 3, {});
  assert.equal(car.state.verticalSpeed, 0);
  const heldHeight = car.state.altitude;
  drive(car, 1, {});
  assert.equal(car.state.altitude, heldHeight);
  drive(car, 5, { lower: true });
  assert.equal(car.state.altitude, 0);
  assert.equal(car.state.verticalSpeed, 0);
});

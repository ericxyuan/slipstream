import assert from "node:assert/strict";
import test from "node:test";
import { Scene } from "three";
import { vehicles } from "../src/vehicle/catalog.js";
import { STEP, SPAWN, VehiclePhysics } from "../src/vehicle/physics.js";
import { GasExhaust } from "../src/vehicle/exhaust.js";
import { steeringPorts } from "../src/vehicle/ports.js";

for (const direction of [1, -1]) {
  test(`airborne ${direction > 0 ? "left" : "right"} steering uses opposite side ports and counter-thrust on release`, () => {
    const car = new VehiclePhysics([]);
    car.configure(vehicles.find((v) => v.flying));
    for (let i = 0; i < 240; i++) car.step({ rise: true });
    const controls = direction > 0 ? { left: true } : { right: true };
    for (let i = 0; i < 120; i++) car.step(controls);
    assert.ok(car.state.sideThrust * direction > 0.1);
    assert.ok(car.state.heading * direction > 0.4);
    assert.equal(car.state.groundSpeed, 0);
    const ports = steeringPorts.filter((p) => p.turn === direction);
    assert.equal(ports.length, 2);
    assert.equal(ports[0].dx + ports[1].dx, 0);
    assert.ok(ports.every((p) => -p.z * p.dx * direction > 0));
    const initialRate = Math.abs(car.yawRate);
    let countered = false;
    for (let i = 0; i < 120; i++) {
      car.step({});
      countered ||= car.state.sideThrust * direction < -0.015;
    }
    assert.ok(countered);
    assert.ok(Math.abs(car.yawRate) < initialRate * 0.1);
  });
  test(`side gas follows the active nozzle pair at a rotated heading (${direction})`, () => {
    const exhaust = new GasExhaust(new Scene());
    const s = {
      ...SPAWN,
      altitude: 4,
      heading: Math.PI / 2,
      sideThrust: direction,
      airborne: 1,
    };
    exhaust.update(true, s, 1 / 80);
    const live = exhaust.pool.filter((p) => p.age < p.life);
    assert.equal(live.length, 2);
    for (const p of live) {
      const side = Math.sign(s.z - p.z);
      assert.ok(-p.vz * side > 5);
      assert.equal(-Math.sign(p.x - s.x) * side, direction);
    }
  });
}
test("ground steering, including on the drag strip, emits no side gas", () => {
  const car = new VehiclePhysics([]);
  car.configure(vehicles.find((v) => v.flying));
  car.setCourse({ id: "drag" }, []);
  const exhaust = new GasExhaust(new Scene());
  for (let i = 0; i < 120; i++) {
    car.step({ left: true, rise: true, forward: true });
    exhaust.update(true, car.state, STEP);
  }
  assert.equal(car.state.sideThrust, 0);
  assert.equal(exhaust.mesh.count, 0);
});

import assert from "node:assert/strict";
import test from "node:test";
import { coastLoop, coastBranches, coastSolids } from "../src/world/coast.js";
import { makeCourse } from "../src/world/events.js";
import { surfaceAt } from "../src/world/surfaces.js";
import { Race } from "../src/systems/race.js";

test("each coastal detour has two connected mouths, road grip and clearance for a vehicle", () => {
  const course = makeCourse({ map: "coast" });
  for (const { start, end, points } of coastBranches) {
    for (const [point, index] of [
      [points[0], start],
      [points.at(-1), end],
    ])
      assert.ok(
        Math.hypot(point.x - coastLoop[index].x, point.z - coastLoop[index].z) <
          0.01,
      );
    assert.ok(
      points.some(
        (p, i) =>
          Math.hypot(
            p.x - coastLoop[start + i].x,
            p.z - coastLoop[start + i].z,
          ) > 30,
      ),
    );
    for (const p of points) {
      assert.equal(surfaceAt(course, p.x, p.z).id, "asphalt");
      for (const o of coastSolids) {
        const dx = Math.max(0, Math.abs(p.x - o.x) - o.rx),
          dz = Math.max(0, Math.abs(p.z - o.z) - o.rz);
        assert.ok(Math.hypot(dx, dz) > 8);
      }
    }
  }
  assert.equal(surfaceAt(course, 0, 0).id, "grass");
});

test("all eight fork combinations complete forward and reverse checkpoint laps", () => {
  for (const reverse of [false, true]) {
    const course = makeCourse({
      map: "coast",
      format: "circuit",
      reverse,
      checkpoints: 32,
      laps: 2,
    });
    for (let mask = 0; mask < 8; mask++) {
      const path = coastLoop.slice(0, -1);
      coastBranches.forEach(({ points, start }, i) => {
        if (mask & (1 << i)) path.splice(start, points.length, ...points);
      });
      if (reverse) path.reverse();
      const race = new Race(course);
      race.start(0);
      const state = (p) => ({
        ...p,
        altitude: 0,
        groundSpeed: 15,
        wheelSlip: 0,
        acceleration: 0,
        lateralAccel: 0,
        verticalAccel: 0,
      });
      const car = { state: state(course.spawn), step() {} };
      let clock = race.green;
      for (const p of [...path, ...path, path[0], path[1]]) {
        car.previous = car.state;
        car.state = state(p);
        clock += 0.1;
        race.step(car, {}, 0.1, clock);
      }
      assert.equal(
        race.phase,
        "finished",
        JSON.stringify({ reverse, mask, next: race.next }),
      );
      assert.equal(race.completedLaps, 2);
    }
  }
});

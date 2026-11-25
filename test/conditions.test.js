import { test } from "node:test";
import assert from "node:assert/strict";
import { Conditions } from "../src/systems/conditions.js";

test("manual time and weather hold, including when taking over mid-transition", () => {
  const conditions = new Conditions();
  conditions.minutes = 720;
  conditions.weather = 0.9;
  conditions.step(200);
  assert.deepEqual([conditions.minutes, conditions.weather], [720, 0.9]);
  conditions.setAuto(true);
  conditions.step(10);
  conditions.setAuto(false);
  const held = [conditions.minutes, conditions.weather];
  assert.notDeepEqual(held, [720, 0.9]);
  conditions.step(200);
  assert.deepEqual([conditions.minutes, conditions.weather], held);
});

test("automatic transitions ease forward across midnight and meet at the same weather", () => {
  const conditions = new Conditions();
  conditions.minutes = 1320;
  conditions.weather = 0.2;
  conditions.setAuto(true);
  conditions.next(() => 0);
  conditions.step(8);
  assert.equal(conditions.minutes, 1366.875);
  conditions.step(8);
  assert.equal(conditions.minutes, 30);
  assert.ok(Math.abs(conditions.weather - 0.34) < 1e-9);
  conditions.step(16);
  assert.equal(conditions.minutes, 180);
  assert.equal(conditions.fromWeather, conditions.weather);
  assert.equal(conditions.elapsed, 0);
  conditions.step(0.01);
  assert.ok(Math.abs(conditions.weather - conditions.fromWeather) < 0.000001);
  assert.ok(conditions.minutes >= 180);
});

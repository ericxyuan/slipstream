// Plan in metres along the road so braking accounts for every bend between the
// car and its braking point, including bends beyond the lap boundary.
import { surfaceAt } from "../world/surfaces.js";
import { roadYawLimit } from "../vehicle/physics.js";
import { streetsX, streetsZ, roadWidth } from "../world/city.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const distance = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
function projection(a, b, car) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const t = clamp(((car.x - a.x) * dx + (car.z - a.z) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  const p = mix(a, b, t);
  return { ...p, t, error: distance(p, car) };
}

function nearest(points, state, start = 0, count = points.length - 1, loop = false, matchHeading = false) {
  let best, bestScore = Infinity;
  const n = points.length - 1;
  for (let k = start; k < start + count; k++) {
    const i = loop ? (k % n + n) % n : k;
    if (i < 0 || i >= n) continue;
    const a = points[i], b = points[i + 1], p = projection(a, b, state);
    let score = p.error;
    if (matchHeading) {
      // Grid slots can be equidistant from opposing lanes on a strip circuit.
      const alignment = ((a.x - b.x) * Math.sin(state.heading) +
        (a.z - b.z) * Math.cos(state.heading)) / (distance(a, b) || 1);
      score += 8 * (1 - alignment);
    }
    if (score < bestScore) {
      best = { ...p, i };
      bestScore = score;
    }
  }
  return best;
}

function needsShunt(course, spec) {
  const radius = spec.wheelbase / Math.tan(spec.handling.steeringLock);
  return Math.hypot(radius + spec.width / 2, spec.length / 2) > course.stripWidth / 2;
}

function drivingRoute(course, state, spec) {
  if (course.id === "drag" && course.format === "circuit") {
    // The timing route doubles back four metres beside itself. Use the
    // paved runoff for a U-turn, crossing each transverse gate at its end.
    const path = [];
    const radius = needsShunt(course, spec) ? 2.2 : Math.min(4.4, course.stripWidth / 2 - 1.8);
    for (const end of [-1, 1]) {
      const z = end < 0 ? -course.length : 0;
      for (let i = 0; i <= 16; i++) {
        const angle = Math.PI * i / 16;
        path.push({ x: end * radius * Math.cos(angle), z: z + end * radius * Math.sin(angle) });
      }
      if (needsShunt(course, spec) && end < 0) {
        const offset = Math.min(7, course.length / 3);
        path.push(
          { x: course.config.reverse ? radius : 4.35, z: -course.length + offset },
          { x: course.config.reverse ? 4.35 : radius, z: -offset },
        );
      }
    }
    path.push(path[0]);
    return course.config.reverse ? path.reverse() : path;
  }
  let points = course.route.slice();
  if (course.format === "drag" || (course.id === "drag" && course.format !== "circuit")) {
    // Keep each entrant in their assigned lane, including reverse events.
    points = points.map(p => ({ ...p, x: course.spawn.x }));
  }
  if (course.id === "coast") {
    // A driver can engage on either arm of a fork. Rejoin the main road at
    // the merge instead of aiming across the land between the two roads.
    const alternate = points.map(p => p.alternate ?? p);
    if (nearest(alternate, state).error + 1 < nearest(points, state).error)
      points = alternate;
  }
  if (course.format === "free") {
    const { i } = nearest(points, state);
    const a = points[i], b = points[i + 1];
    if ((b.x - a.x) * Math.sin(state.heading) + (b.z - a.z) * Math.cos(state.heading) > 0)
      points.reverse();
  }
  return points;
}

// Relax the bends across the usable tarmac. Neighbouring bends share the
// same line, so opening up an entry can also straighten the preceding exit.
function racingLine(path, loop, spec) {
  const lengths = [0];
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + distance(path[i - 1], path[i]));
  const length = lengths.at(-1);
  const count = Math.max(3, Math.ceil(length / 4));
  const centre = [];
  for (let i = 0, j = 1; i <= count; i++) {
    const at = length * i / count;
    while (j < lengths.length - 1 && lengths[j] < at) j++;
    centre.push(mix(path[j - 1], path[j], (at - lengths[j - 1]) / (lengths[j] - lengths[j - 1])));
  }
  const index = i => loop ? (i % count + count) % count : clamp(i, 0, count);
  const line = centre.map(p => ({ ...p }));
  const normals = centre.map((p, i) => {
    const a = centre[index(i - 1)], b = centre[index(i + 1)], span = distance(a, b);
    return { x: (a.z - b.z) / span, z: (b.x - a.x) / span };
  });
  // Leave extra tracking room for cars which gain speed rapidly as boost
  // comes back on after the apex.
  const room = 7.8 - spec.width / 2 - 1.75 - spec.length * 0.12 -
    Math.min(0.9, spec.handling.launch * spec.handling.brakeTime ** 2 * 0.12);
  // Relax at several distances. The wide passes anticipate a turn while
  // the fine passes remove sudden steering changes at the edge of the line.
  for (const stride of [8, 4, 2, 1]) {
    for (let pass = 0; pass < 24; pass++) {
      for (let i = loop ? 0 : 1; i < count; i++) {
        const left = index(i - stride), right = index(i + stride);
        const outerLeft = line[index(i - 2 * stride)], outerRight = line[index(i + 2 * stride)];
        const a = line[left], b = line[right], p = centre[i], normal = normals[i];
        // Fourth differences smooth curvature instead of shrinking a circular bend.
        const x = (4 * (a.x + b.x) - outerLeft.x - outerRight.x) / 6;
        const z = (4 * (a.z + b.z) - outerLeft.z - outerRight.z) / 6;
        const offset = clamp((x - p.x) * normal.x + (z - p.z) * normal.z, -room, room);
        line[i] = { x: p.x + offset * normal.x, z: p.z + offset * normal.z };
      }
    }
  }
  if (loop) line[count] = line[0];
  return line;
}

function roundCorners(points, loop, spec) {
  const path = [];
  const n = points.length - Number(loop);
  // Blend lateral lane changes along each straight so the car can accelerate
  // out of the previous arc without a sudden change in steering.
  function join(entry, dx, dz) {
    const from = path.at(-1);
    if (!from) return;
    const along = (entry.x - from.x) * dx + (entry.z - from.z) * dz;
    const shiftX = entry.x - from.x - along * dx, shiftZ = entry.z - from.z - along * dz;
    const steps = Math.ceil(along / 5);
    for (let j = 1; j < steps; j++) {
      const t = j / steps, blend = t * t * (3 - 2 * t);
      path.push({ x: from.x + dx * along * t + shiftX * blend, z: from.z + dz * along * t + shiftZ * blend });
    }
  }
  let firstTangent;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (!loop && (i === 0 || i === n - 1)) {
      if (i > 0) {
        const a = points[i - 1], span = distance(a, p);
        join(p, (p.x - a.x) / span, (p.z - a.z) / span);
      }
      path.push(p);
      continue;
    }
    const a = points[(i + n - 1) % n], b = points[(i + 1) % n];
    const before = distance(a, p), after = distance(b, p);
    const dx = (p.x - a.x) / before, dz = (p.z - a.z) / before;
    const ex = (b.x - p.x) / after, ez = (b.z - p.z) / after;
    firstTangent ??= { dx, dz };
    if (Math.abs(dx * ez - dz * ex) < 0.9) {
      join(p, dx, dz);
      path.push(p);
      continue;
    }
    // Join the outside of each street with a quarter circle, leaving room
    // for the body. Its apex must also fit through a junction-centred gate.
    const margin = spec.width / 2 + spec.length * 0.27 + 2.1;
    const room = (vertical) => Math.min(4.3, (vertical ? roadWidth("x", p.x) : roadWidth("z", p.z)) / 2 - margin);
    const entryOffset = Math.min(room(Math.abs(dz) > 0.5), after * 0.15);
    const exitOffset = Math.min(room(Math.abs(ez) > 0.5), before * 0.15);
    const radius = Math.min(29, 11 + 2.2 * Math.min(entryOffset, exitOffset),
      before * 0.43 + exitOffset, after * 0.43 + entryOffset);
    const pivot = { x: p.x + dx * exitOffset - ex * entryOffset, z: p.z + dz * exitOffset - ez * entryOffset };
    join({ x: pivot.x - radius * dx, z: pivot.z - radius * dz }, dx, dz);
    for (let j = 0; j <= 12; j++) {
      const theta = Math.PI * j / 24;
      const along = radius * (Math.sin(theta) - 1), across = radius * (1 - Math.cos(theta));
      path.push({ x: pivot.x + dx * along + ex * across, z: pivot.z + dz * along + ez * across });
    }
  }
  if (loop) {
    join(path[0], firstTangent.dx, firstTangent.dz);
    path.push(path[0]);
  }
  return path;
}

// Join the circuit along the grid when F is pressed on a side street.
function cityApproach(points, state) {
  const closest = nearest(points, state);
  if (closest.error < 8) return null;
  const street = (values, v) => values.reduce((a, b) => Math.abs(a - v) < Math.abs(b - v) ? a : b);
  const x = street(streetsX, state.x), z = street(streetsZ, state.z);
  const onNorthSouth = Math.abs(x - state.x) <= Math.abs(z - state.z);
  const start = onNorthSouth ? { x, z: state.z } : { x: state.x, z };
  let best;
  for (const cross of onNorthSouth ? streetsZ : streetsX) {
    const turn = onNorthSouth ? { x, z: cross } : { x: cross, z };
    const behind = (turn.x - start.x) * Math.sin(state.heading) +
      (turn.z - start.z) * Math.cos(state.heading) > 1;
    for (let i = 1; i < points.length; i++) {
      const join = projection(points[i - 1], points[i], turn);
      if (onNorthSouth ? Math.abs(join.z - cross) > 0.01 : Math.abs(join.x - cross) > 0.01) continue;
      const length = distance(start, turn) + distance(turn, join) + (behind ? 1000 : 0);
      if (!best || length < best.length) best = { length, path: [start, turn, join] };
    }
  }
  return best?.path;
}

export class SelfDriver {
  constructor(course, spec, state, approach = true) {
    this.course = course;
    this.spec = spec;
    let path = drivingRoute(course, state, spec);
    this.approach = approach && course.id === "city" && course.format !== "drag" && cityApproach(path, state);
    if (this.approach) path = this.approach;
    path = path.filter((p, i) => !i || distance(p, path[i - 1]) > 1e-6);
    this.loop = distance(path[0], path.at(-1)) < 1e-4;
    if (course.id === "city" && course.format !== "drag") path = roundCorners(path, this.loop, spec);
    if (course.format !== "drag" && ["coast", "desert"].includes(course.id)) path = racingLine(path, this.loop, spec);

    this.points = [path[0]];
    this.arc = [0];
    const strip = course.format === "drag" || course.id === "drag";
    this.shunt = course.id === "drag" && this.loop && needsShunt(course, spec);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], len = distance(a, b);
      if (len < 1e-6) continue;
      // Straight drag distances can be arbitrarily long.
      const maxPieces = course.format === "circuit" ? 80 : 1;
      const pieces = Math.min(Math.ceil(len / 5), strip ? maxPieces : Infinity);
      for (let j = 1; j <= pieces; j++) {
        this.points.push(mix(a, b, j / pieces));
        this.arc.push(this.arc.at(-1) + len / pieces);
      }
    }
    const h = spec.handling;
    const top = (course.config.rules === "balanced" ? 75 : h.limit) * (spec.mass > 5000 ? 1.29 : 1.19);
    const surface = this.points.map(p => surfaceAt(course, p.x, p.z));
    const n = this.points.length - 1;
    this.precisionTurn = course.id === "drag" || Boolean(this.approach);
    // Slower steering racks need extra yaw authority to correct the line
    // as curvature builds, particularly in a bus on a tightening bend.
    const yawFraction = this.precisionTurn ? 0.89 : clamp(1 - 0.6 / h.steerResponse, 0.88, 0.985);
    this.speed = this.points.map((p, i) => {
      if (!this.loop && (i === 0 || i === n)) return top;
      const a = this.points[(i + n - 1) % n], b = this.points[i === n ? 1 : i + 1];
      const cross = (p.x - a.x) * (b.z - p.z) - (p.z - a.z) * (b.x - p.x);
      const curvature = 2 * Math.abs(cross) / (distance(a, p) * distance(b, p) * distance(a, b) || 1);
      // Use the full boosted speed whenever the line fits at that speed.
      if (curvature * top <= yawFraction * roadYawLimit(h, top, surface[i].grip)) return top;
      // Road yaw is speed-limited by the same handling curve as the tyres.
      let low = 0, high = top;
      for (let j = 0; j < 12; j++) {
        const v = (low + high) / 2;
        if (v * curvature < yawFraction * roadYawLimit(h, v, surface[i].grip)) low = v;
        else high = v;
      }
      return low;
    });
    this.brakes = surface.map(s => (this.precisionTurn ? 0.85 : 0.99) * Math.min(h.braking, s.traction));
    // A timed finish freezes the simulation at the line. In free drive, stop
    // before the end of an open road.
    if (!this.loop && (course.format === "free" || this.approach)) this.speed[n] = this.approach ? 4 : 0;
    for (let lap = 0; lap < (this.loop ? 2 : 1); lap++) {
      if (this.loop) this.speed[n] = this.speed[0];
      for (let i = n - 1; i >= 0; i--) {
        const exitSpeed = this.speed[i + 1];
        const decel = this.brakes[i] + (this.precisionTurn ? 0 : h.drag * exitSpeed ** 2);
        this.speed[i] = Math.min(this.speed[i], Math.sqrt(exitSpeed ** 2 +
          2 * decel * (this.arc[i + 1] - this.arc[i])));
      }
    }
  }

  turnaround(s) {
    const north = s.z < -this.course.length + 1;
    const south = s.z > -1;
    const inbound = (north ? 1 : -1) * Math.cos(s.heading);
    if (!north && !south) {
      this.turnPhase = null;
      return;
    }
    if (this.turnPhase !== "done") {
      const turn = this.course.config.reverse ? 1 : -1;
      // A long vehicle needs a three-point turn between the strip walls.
      if (!this.turnPhase && inbound > 0.45) this.turnPhase = "enter";
      if (this.turnPhase === "enter" && inbound < 0.38) this.turnPhase = "reverse";
      const towardRight = north !== this.course.config.reverse;
      if (this.turnPhase === "reverse" && inbound < (towardRight ? -0.025 : -0.10)) this.turnPhase = "exit";
      if (this.turnPhase === "exit" && inbound < -0.96) this.turnPhase = "done";
      if (this.turnPhase && this.turnPhase !== "done") {
        const reverse = this.turnPhase === "reverse";
        const steer = reverse ? -turn : turn;
        return { steer, left: steer > 0, right: steer < 0,
          forward: !reverse && s.speed < 1.65, back: reverse && s.speed > -1.65 };
      }
    }
  }

  controls(car) {
    const { state: s, spec } = car, h = spec.handling, n = this.points.length - 1;
    let p = this.index == null ? null : nearest(this.points, s, this.index - 5, 16, this.loop);
    if (!p || p.error > 9) {
      const opposingLanes = this.course.id === "drag" && this.loop;
      p = nearest(this.points, s, 0, n, this.loop, opposingLanes);
    }
    this.index = p.i;
    const at = this.arc[p.i] + p.t * (this.arc[p.i + 1] - this.arc[p.i]);
    const remaining = this.arc[n] - at;
    if (this.approach && remaining < 2) {
      Object.assign(this, new SelfDriver(this.course, spec, s, false));
      this.index = undefined;
      return this.controls(car);
    }
    const v = s.groundSpeed;
    if (this.shunt) {
      const turn = this.turnaround(s);
      if (turn) return turn;
    }
    const look = clamp(4 + v * (0.16 + 1 / h.steerResponse), 4, 22);
    const ahead = (d) => {
      let i = p.i;
      if (this.loop && d >= this.arc[n]) { d %= this.arc[n]; i = 0; }
      while (i < n - 1 && this.arc[i + 1] < d) i++;
      return { i, t: (d - this.arc[i]) / (this.arc[i + 1] - this.arc[i]) };
    };
    const aim = ahead(at + look);
    // Extend the tangent past an open finish so we cross the timing gate.
    const target = mix(this.points[aim.i], this.points[aim.i + 1], aim.t);
    const dx = target.x - s.x, dz = target.z - s.z;
    const headingError = Math.atan2(-dx * Math.cos(s.heading) + dz * Math.sin(s.heading),
      -dx * Math.sin(s.heading) - dz * Math.cos(s.heading));
    const surface = surfaceAt(this.course, s.x, s.z);
    const maxCurve = Math.min(Math.tan(h.steeringLock) / spec.wheelbase,
      roadYawLimit(h, v, surface.grip) / Math.max(v, 0.1));
    const steer = clamp(2 * Math.sin(clamp(headingError, -Math.PI / 2, Math.PI / 2)) /
      (Math.max(1, Math.hypot(dx, dz)) * maxCurve), -1, 1);
    const responseTime = this.precisionTurn ? h.brakeTime + 0.12 : 0.85 * h.brakeTime + 0.10;
    const lead = ahead(at + v * responseTime);
    const i = lead.i, gap = (1 - clamp(lead.t, 0, 1)) * (this.arc[i + 1] - this.arc[i]);
    const decel = this.brakes[i] + (this.precisionTurn ? 0 : h.drag * this.speed[i + 1] ** 2);
    let limit = Math.min(
      Math.sqrt(this.speed[i + 1] ** 2 + 2 * decel * gap),
      this.speed[i] + Math.max(0, this.speed[i + 1] - this.speed[i]) * clamp(lead.t, 0, 1),
    );
    if (!this.precisionTurn && this.course.format !== "drag") {
      // The brake preview can see the next straight before the car has
      // cleared a bend. Keep entry speed until the arc opens up.
      const here = this.speed[p.i] + (this.speed[p.i + 1] - this.speed[p.i]) * p.t;
      limit = Math.min(limit, here + 1);
    }
    // Brake early when taking over with a large lateral or heading error.
    if (p.error > 3 || Math.abs(headingError) > 0.65)
      limit = Math.min(limit, Math.max(3, 15 / (1 + p.error * 0.18 + Math.abs(headingError))));
    if (!this.loop && this.course.format === "free" && remaining < 0.7) limit = 0;
    // The throttle pedal takes time to unwind. Anticipate the residual
    // acceleration of a loaded powertrain as we approach a braking zone.
    if (!this.precisionTurn && this.course.format !== "drag" && limit < this.speed[p.i])
      limit -= Math.max(0, s.acceleration) * h.pedalTime * 0.30;
    const forward = v < limit && limit > 0.1;
    return { steer, left: steer > 0.05, right: steer < -0.05, forward,
      back: v > limit + 0.25 && s.speed > 0.3, boost: forward, lower: !!spec.flying && s.altitude > 0 };
  }
}

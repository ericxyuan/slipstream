// Plan in metres along the road so braking accounts for every bend between the
// car and its braking point, including bends beyond the lap boundary.
import { surfaceAt } from "../world/surfaces.js";
import { roadYawLimit } from "../vehicle/physics.js";
import { streetsX, streetsZ } from "../world/city.js";

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

function roundCorners(points, loop, gates) {
  const path = [];
  const n = points.length - Number(loop);
  for (let i = 0; i < n; i++) {
    const p = points[i];
    if (!loop && (i === 0 || i === n - 1)) {
      path.push(p);
      continue;
    }
    const a = points[(i + n - 1) % n], b = points[(i + 1) % n];
    const trim = Math.min(18, distance(a, p) * 0.45, distance(b, p) * 0.45);
    const entry = mix(p, a, trim / distance(a, p)), exit = mix(p, b, trim / distance(b, p));
    // Pass through the junction centre. Some timed gates sit exactly on the
    // incoming street's end plane and an inside-only arc would miss them.
    const nearGate = gates.some(g => distance(g, p) < trim);
    const control = nearGate ? mix(p, mix(entry, exit, 0.5), -1.25) : p;
    for (let j = 0; j <= 8; j++) {
      const t = j / 8;
      path.push(mix(mix(entry, control, t), mix(control, exit, t), t));
    }
  }
  if (loop) path.push(path[0]);
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
    if (course.id === "city" && course.format !== "drag") path = roundCorners(path, this.loop, this.approach ? [] : course.gates);

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
    this.speed = this.points.map((p, i) => {
      if (!this.loop && (i === 0 || i === n)) return top;
      const a = this.points[(i + n - 1) % n], b = this.points[i === n ? 1 : i + 1];
      const cross = (p.x - a.x) * (b.z - p.z) - (p.z - a.z) * (b.x - p.x);
      const curvature = 2 * Math.abs(cross) / (distance(a, p) * distance(b, p) * distance(a, b) || 1);
      // Road yaw is speed-limited by the same handling curve as the tyres.
      let low = 0, high = top;
      for (let j = 0; j < 12; j++) {
        const v = (low + high) / 2;
        if (v * curvature < 0.89 * roadYawLimit(h, v, surface[i].grip)) low = v;
        else high = v;
      }
      return low;
    });
    this.brakes = surface.map(s => 0.85 * Math.min(h.braking, s.traction));
    // A timed finish freezes the simulation at the line. In free drive, stop
    // before the end of an open road.
    if (!this.loop && (course.format === "free" || this.approach)) this.speed[n] = this.approach ? 4 : 0;
    for (let lap = 0; lap < (this.loop ? 2 : 1); lap++) {
      if (this.loop) this.speed[n] = this.speed[0];
      for (let i = n - 1; i >= 0; i--)
        this.speed[i] = Math.min(this.speed[i], Math.sqrt(this.speed[i + 1] ** 2 +
          2 * this.brakes[i] * (this.arc[i + 1] - this.arc[i])));
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
    const lead = ahead(at + v * (h.brakeTime + 0.12));
    const i = lead.i, gap = (1 - clamp(lead.t, 0, 1)) * (this.arc[i + 1] - this.arc[i]);
    let limit = Math.min(
      Math.sqrt(this.speed[i + 1] ** 2 + 2 * this.brakes[i] * gap),
      this.speed[i] + Math.max(0, this.speed[i + 1] - this.speed[i]) * clamp(lead.t, 0, 1),
    );
    // Brake early when taking over with a large lateral or heading error.
    if (p.error > 3 || Math.abs(headingError) > 0.65)
      limit = Math.min(limit, Math.max(3, 15 / (1 + p.error * 0.18 + Math.abs(headingError))));
    if (!this.loop && this.course.format === "free" && remaining < 0.7) limit = 0;
    const forward = v < limit && limit > 0.1;
    return { steer, left: steer > 0.05, right: steer < -0.05, forward,
      back: v > limit + 0.25 && s.speed > 0.3, boost: forward, lower: !!spec.flying && s.altitude > 0 };
  }
}

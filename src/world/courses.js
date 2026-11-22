import { road } from "./road.js";

import { surfaces } from "./surfaces.js";
export { surfaces };
export const courses = {
  desert: { name: "Redrock Basin", type: "Free drive", detail: "Explore the desert test loop." },
  drag: { name: "Meridian Strip", type: "Drag strip", detail: "Set the distance and surface." },
  city: { name: "Foundry City", type: "Street circuit", detail: "One timed lap around the foundry district." },
  sky: { name: "Tesla Skyway", type: "Air race", detail: "Fly the Rocket Edition through eight altitude gates." },
};

// Gates face along the direction of travel. Their coordinates also drive the HUD.
function gate(x, y, z, dx, dz, radius) {
  const length = Math.hypot(dx, dz);
  return { x, y, z, dx: dx / length, dz: dz / length, radius };
}
export const cityCorners = [[0, 40], [0, -120], [120, -120], [120, 0], [60, 0], [60, 80], [0, 80]];
const cityGates = [
  gate(0, 0, -80, 0, -1, 10), gate(65, 0, -120, 1, 0, 10),
  gate(120, 0, -60, 0, 1, 10), gate(91, 0, 0, -1, 0, 10),
  gate(60, 0, 48, 0, 1, 10), gate(28, 0, 80, -1, 0, 10),
  gate(0, 0, 40, 0, -1, 10),
];
const skyPoints = [[0, 8, -72], [10, 11, -148], [36, 15, -224], [54, 13, -298],
  [48, 8, -370], [22, 5, -448], [-4, 9, -524], [-12, 14, -604]];
const skyGates = skyPoints.map(([x, y, z], i) => {
  const [px, , pz] = skyPoints[i - 1] ?? [0, 8, 0];
  return gate(x, y, z, x - px, z - pz, 5.5);
});

export function courseLayout(id, length = 402, surface = "prepared") {
  const layout = { id, ...courses[id], gates: [], closed: false };
  if (id === "desert") return { ...layout, points: road.getSpacedPoints(150), closed: true,
    bounds: [-250, 235, -315, 215] };
  if (id === "drag") return { ...layout, length, surface: surfaces[surface],
    spawn: { x: 0, z: 0 }, bounds: [-9, 9, -length - 100, 22],
    points: [{ x: 0, z: 0 }, { x: 0, z: -length }], gates: [gate(0, 0, -length, 0, -1, 10)] };
  if (id === "city") return { ...layout, gates: cityGates, closed: true,
    spawn: { x: 0, z: 40 }, bounds: [-98, 220, -211, 180],
    points: cityCorners.map(([x, z]) => ({ x, z })) };
  return { ...layout, gates: skyGates, spawn: { x: 0, z: 0, altitude: 8, airborne: 1 },
    bounds: [-190, 220, -730, 120], points: [{ x: 0, z: 0 }, ...skyGates] };
}

// Fraction of this physics step at which the car crossed the gate in order.
export function crossing(gate, before, after, airborne) {
  const distance = p => (p.x - gate.x) * gate.dx + (p.z - gate.z) * gate.dz;
  const a = distance(before), b = distance(after);
  if (a >= 0 || b < 0) return null;
  const fraction = -a / (b - a);
  const x = before.x + (after.x - before.x) * fraction - gate.x;
  const z = before.z + (after.z - before.z) * fraction - gate.z;
  const height = airborne ? before.altitude + (after.altitude - before.altitude) * fraction - gate.y : 0;
  return Math.hypot(x, height, z) <= gate.radius ? fraction : null;
}

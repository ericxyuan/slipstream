// Metres in the X/Z plane. Both the renderer and the race authority sample these roads.
import { CatmullRomCurve3, Vector3 } from "three";

const knots = [
  [40, 125],
  [88, 75],
  [106, 4],
  [96, -65],
  [125, -127],
  [69, -178],
  [-10, -186],
  [-82, -153],
  [-132, -115],
  [-155, -48],
  [-132, 21],
  [-162, 91],
  [-102, 145],
  [-30, 153],
];
const forks = [
  {
    name: "Lantern Point",
    from: 1,
    to: 4,
    via: [
      [135, 48],
      [179, 0],
      [181, -50],
      [152, -92],
    ],
  },
  {
    name: "Saltworks",
    from: 5,
    to: 8,
    via: [
      [38, -212],
      [-18, -225],
      [-78, -196],
      [-110, -161],
    ],
  },
  {
    name: "Reedbank",
    from: 9,
    to: 12,
    via: [
      [-112, -18],
      [-78, 25],
      [-85, 72],
      [-111, 111],
    ],
  },
];
const curve = (coords, closed = false) =>
  new CatmullRomCurve3(
    coords.map(([x, z]) => new Vector3(x, 0, z)),
    closed,
  );
const samplesPerLeg = 18;
const main = curve(knots, true).getPoints(knots.length * samplesPerLeg);
export const coastBranches = forks.map(({ name, from, to, via }) => {
  const start = from * samplesPerLeg,
    end = to * samplesPerLeg;
  const points = curve([knots[from], ...via, knots[to]]).getPoints(end - start);
  return { name, start, end, points };
});
export const coastLoop = main.map(({ x, z }) => ({ x, z, y: 0 }));
for (const branch of coastBranches)
  branch.points.forEach((p, i) => {
    coastLoop[branch.start + i].alternate = p;
  });

export const coastRoads = [coastLoop, ...coastBranches.map((b) => b.points)];
export const coastSolids = [
  { x: 152, z: -29, rx: 4.4, rz: 4.4, height: 33 },
  { x: 141, z: -29, rx: 4.5, rz: 3, height: 6, rectangle: true },
  { x: -18, z: -205, rx: 8, rz: 4, height: 6, rectangle: true },
  { x: 3, z: -205, rx: 8, rz: 4, height: 6, rectangle: true },
  { x: -110, z: 45, rx: 4.5, rz: 3, height: 5, rectangle: true },
];

// Shallow intertidal pools remain traversable on soft ground.
export const coastPools = [
  [126, 88, 18, 12],
  [138, 12, 13, 21],
  [-103, 34, 15, 33],
  [-123, 73, 10, 23],
  [15, -84, 43, 18],
  [61, -48, 13, 32],
  [-44, 19, 19, 42],
];
export function inTidalPool(x, z) {
  return coastPools.some(
    ([cx, cz, w, d]) => ((x - cx) / w) ** 2 + ((z - cz) / d) ** 2 < 1,
  );
}

// A small spatial index keeps the tyre lookup local even in a full party.
const cellSize = 24,
  cells = new Map();
const cellKey = (x, z) =>
  Math.floor(x / cellSize) + "," + Math.floor(z / cellSize);
for (const road of coastRoads) {
  for (let i = 1; i < road.length; i++) {
    const a = road[i - 1],
      b = road[i];
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const segment = { a, dx, dz, squared: dx * dx + dz * dz };
    for (
      let x = Math.floor((Math.min(a.x, b.x) - 9) / cellSize);
      x <= Math.floor((Math.max(a.x, b.x) + 9) / cellSize);
      x++
    )
      for (
        let z = Math.floor((Math.min(a.z, b.z) - 9) / cellSize);
        z <= Math.floor((Math.max(a.z, b.z) + 9) / cellSize);
        z++
      ) {
        const key = x + "," + z;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(segment);
      }
  }
}
export function onCoastRoad(x, z, radius = 8) {
  const segments = cells.get(cellKey(x, z));
  return (
    segments?.some(({ a, dx, dz, squared }) => {
      const t = Math.min(
        1,
        Math.max(0, ((x - a.x) * dx + (z - a.z) * dz) / squared),
      );
      return (
        (a.x + dx * t - x) ** 2 + (a.z + dz * t - z) ** 2 <= radius * radius
      );
    }) ?? false
  );
}

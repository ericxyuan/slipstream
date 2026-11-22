// The rendering, minimap and collision simulation share this street plan.
export const streetsX = [-160, -80, 0, 60, 120, 200, 280],
  streetsZ = [-280, -200, -120, -60, 0, 80, 160, 240];
export function roadWidth(axis, position) {
  if (position === 0 || position === -120) return 28;
  if (position === 200 || position === -200) return 24;
  if (position === 60 || position === 80) return 18;
  return axis === "x" ? 14 : 16;
}
export function cityBlocks() {
  const blocks = [];
  for (let i = 1; i < streetsX.length; i++)
    for (let j = 1; j < streetsZ.length; j++) {
      const [left, right] = streetsX.slice(i - 1, i + 1),
        [near, far] = streetsZ.slice(j - 1, j + 1);
      const x0 = left + roadWidth("x", left) / 2,
        x1 = right - roadWidth("x", right) / 2;
      const z0 = near + roadWidth("z", near) / 2,
        z1 = far - roadWidth("z", far) / 2;
      const district =
        i >= 5
          ? "freight"
          : j <= 2
            ? "industrial"
            : i <= 2
              ? "residential"
              : j >= 6
                ? "park"
                : i === 3 && j === 5
                  ? "civic"
                  : i === 3
                    ? "downtown"
                    : "retail";
      blocks.push({
        x: (x0 + x1) / 2,
        z: (z0 + z1) / 2,
        w: x1 - x0,
        d: z1 - z0,
        district,
        i,
        j,
      });
    }
  return blocks;
}
export function cityBuildings() {
  const lots = [];
  for (const b of cityBlocks()) {
    const { district: k, w, d, x, z, i, j } = b;
    if (k === "park") continue;
    const n =
      k === "residential" ? 3 : k === "downtown" || k === "retail" ? 2 : 1;
    for (let l = 0; l < n; l++) {
      const bw = w / n - 4,
        bd = d - (k === "freight" ? 18 : 8);
      const height = {
        downtown: 32 + ((i * 31 + j * 7 + l * 17) % 49),
        residential: 5 + ((j + l) % 3),
        retail: 8 + (j % 3) * 2,
        industrial: 12,
        civic: 15,
        freight: 9,
      }[k];
      lots.push({
        x: x - w / 2 + (w / n) * (l + 0.5),
        z,
        rx: bw / 2,
        rz: bd / 2,
        height,
        rectangle: true,
        district: k,
      });
    }
  }
  return lots;
}

// A covered freight passage crosses the east avenue. Solids include a
// lower vertical bound so cars can pass underneath the overhead deck.
export const freightPassage = {
  x: 200,
  z: -159,
  rx: 14,
  rz: 16,
  clearance: 6.1,
};
export function citySolids() {
  const buildings = cityBuildings(),
    { x, z, rx, rz, clearance } = freightPassage;
  const solids = [
    ...buildings,
    {
      x,
      z,
      rx,
      rz,
      height: clearance + 1.35,
      minY: clearance,
      rectangle: true,
    },
  ];
  for (const side of [-1, 1])
    for (const end of [-1, 1])
      solids.push({
        x: x + side * (rx - 0.6),
        z: z + end * (rz - 1),
        rx: 0.6,
        rz: 1,
        height: clearance,
        rectangle: true,
      });
  for (const b of buildings)
    if (b.district === "downtown")
      solids.push({
        ...b,
        rx: b.rx * 0.77,
        rz: b.rz * 0.8,
        minY: b.height,
        height: b.height + 6,
      });
  return solids;
}

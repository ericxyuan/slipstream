import { vehicles } from "../vehicle/catalog.js";

export const roadsideMargin = 1.5 * Math.max(...vehicles.map((v) => v.width));

// Check the entire footprint against each straight segment of the rendered ribbon.
export function sceneryClearance(roads, shoulder) {
  const segments = roads.flatMap((points) =>
    points.slice(1).map((b, i) => {
      const a = points[i],
        dx = b.x - a.x,
        dz = b.z - a.z;
      return { x: a.x, z: a.z, dx, dz, squared: dx * dx + dz * dz };
    }),
  );
  return (x, z, radius) => {
    const minimum = shoulder + roadsideMargin + radius;
    return !segments.some((s) => {
      const t = Math.min(
        1,
        Math.max(0, ((x - s.x) * s.dx + (z - s.z) * s.dz) / (s.squared || 1)),
      );
      return (
        (s.x + t * s.dx - x) ** 2 + (s.z + t * s.dz - z) ** 2 < minimum ** 2
      );
    });
  };
}

export function clearPosition(clear, x, z, radius) {
  if (clear(x, z, radius)) return { x, z };
  for (let distance = 1; ; distance += 1) {
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8,
        px = x + distance * Math.cos(angle),
        pz = z + distance * Math.sin(angle);
      if (clear(px, pz, radius)) return { x: px, z: pz };
    }
  }
}

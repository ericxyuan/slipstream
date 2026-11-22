import * as T from "three";
import { box, paint, solid } from "./geometry.js";
export function propMeshes(group, props) {
  const orange = paint("#e47637"),
    white = paint("#f1e9d5"),
    dark = paint("#383a3c");
  const leaf = paint("#718451"),
    stone = paint("#a87c59"),
    metal = paint("#65727a");
  return props.map((p) => {
    const g = new T.Group();
    group.add(g);
    if (p.kind === "cone") {
      box(g, dark, 0, 0.05, 0, 0.67, 0.1, 0.67);
      solid(g, new T.ConeGeometry(0.26, 0.78, 12), orange, 0, 0.45, 0);
      solid(g, new T.CylinderGeometry(0.09, 0.15, 0.17, 12), white, 0, 0.54, 0);
    } else if (p.kind === "rock") {
      const rock = solid(
        g,
        new T.IcosahedronGeometry(0.48, 0),
        stone,
        0,
        0.21,
        0,
      );
      rock.scale.set(1.24, 0.64, 0.83);
    } else if (p.kind === "plant" || p.kind === "shrub") {
      for (const side of [-1, 0, 1]) {
        const stem = solid(
          g,
          new T.IcosahedronGeometry(p.kind === "shrub" ? 0.39 : 0.24, 0),
          leaf,
          side * 0.21,
          0.35,
          0,
        );
        stem.scale.y = p.kind === "plant" ? 2.1 : 1.2;
        stem.rotation.z = -side * 0.32;
      }
    } else if (["post", "sign", "bollard"].includes(p.kind)) {
      const height = p.kind === "sign" ? 1.9 : 1,
        r = p.kind === "bollard" ? 0.19 : 0.075;
      solid(
        g,
        new T.CylinderGeometry(r, r, height, 10),
        metal,
        0,
        height / 2,
        0,
      );
      if (p.kind === "sign")
        box(g, orange, 0, height, 0, 0.68, 0.68, 0.09).rotation.z = 0.785;
      else
        solid(
          g,
          new T.CylinderGeometry(r + 0.005, r + 0.005, 0.11, 10),
          white,
          0,
          height * 0.82,
          0,
        );
    } else {
      solid(
        g,
        new T.CylinderGeometry(0.38, 0.38, 0.95, 16),
        orange,
        0,
        0.49,
        0,
      );
      for (const y of [0.3, 0.72])
        solid(g, new T.CylinderGeometry(0.39, 0.39, 0.08, 16), white, 0, y, 0);
    }
    g.rotation.y = p.angle ?? 0;
    if (p.kind === "rock" && p.size) g.scale.setScalar(p.size * 1.8);
    if (p.kind === "plant" && p.size) g.scale.set(1, p.size, 1);
    return g;
  });
}
export function colliderView(group, obstacles) {
  const mat = new T.LineBasicMaterial({ color: 0x8bffb6 });
  for (const o of obstacles) {
    const h = (o.height ?? 2) - (o.minY ?? 0),
      g = o.rectangle
        ? new T.BoxGeometry(o.rx * 2, h, o.rz * 2)
        : new T.CylinderGeometry(1, 1, h, 12);
    if (!o.rectangle) g.scale(o.rx, 1, o.rz);
    const line = new T.LineSegments(new T.EdgesGeometry(g), mat);
    g.dispose();
    line.position.set(o.x, (o.minY ?? 0) + h / 2, o.z);
    group.add(line);
  }
}
export function surfaceOverlay(group, c) {
  if (!c.config || c.config.surface === "original" || c.id === "sky") return;
  const materials = new Map();
  for (const { a, b, surface } of c.paintSections) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      len = Math.hypot(dx, dz);
    let mat = materials.get(surface.id);
    if (!mat) {
      mat = paint(surface.color, {
        transparent: true,
        opacity: 0.54,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      });
      materials.set(surface.id, mat);
    }
    const strip = box(
      group,
      mat,
      (a.x + b.x) / 2,
      0.025,
      (a.z + b.z) / 2,
      c.id === "drag" ? c.stripWidth : c.id === "city" ? 14 : 15,
      0.008,
      len + 0.05,
    );
    strip.rotation.y = Math.atan2(dx, dz);
  }
}

export function startFinish(group, course) {
  if (course.format === "free" || course.id === "sky") return;
  const white = paint("#f8f4dd"),
    black = paint("#292c31");
  for (const gate of [course.startLine, course.gates.at(-1)]) {
    if (!gate) continue;
    const stripe = new T.Group();
    group.add(stripe);
    stripe.position.set(gate.x, 0.05, gate.z);
    stripe.rotation.y = Math.atan2(-gate.dx, -gate.dz);
    const width = course.id === "drag" ? course.stripWidth : 13,
      size = width / 24;
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 24; i++)
        box(
          stripe,
          (row + i) % 2 ? white : black,
          (i - 11.5) * size,
          0,
          row * size,
          size,
          0.015,
          size,
        );
  }
}

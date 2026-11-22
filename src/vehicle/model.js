import * as T from "three";
import { box, paint, solid } from "../world/geometry.js";

import { hull, numberPlate } from "./parts.js";

export function createCar(spec) {
  const root = new T.Group(),
    body = new T.Group();
  root.add(body);

  const orange = paint("#f47a29", {
    roughness: 0.39,
    metalness: 0.16,
    side: T.DoubleSide,
  });
  const black = paint("#242728", { roughness: 0.6, side: T.DoubleSide });
  const tire = paint("#1e2021"),
    rim = paint("#a7a8a1", { metalness: 0.52, roughness: 0.36 });
  const glass = paint("#263c42", {
    metalness: 0.23,
    roughness: 0.17,
    side: T.DoubleSide,
  });
  const shade = paint("#33464b", { roughness: 0.26, side: T.DoubleSide });
  const red = paint("#bd211a", { emissive: 0xa1130b, emissiveIntensity: 0.28 });
  const amber = paint("#ef7623"),
    cream = paint("#f0deb9"),
    grille = paint("#161c1e");
  hull(
    body,
    [
      [-2.09, 0.26, 0.47, 0.51, 0.89, 0.83],
      [-1.64, 0.25, 0.61, 0.66, 0.98, 0.84],
      [-0.81, 0.27, 0.67, 0.74, 1.01, 0.87],
      [0.55, 0.29, 0.72, 0.77, 0.99, 0.87],
      [1.38, 0.28, 0.73, 0.79, 1.055, 0.91],
      [2.06, 0.31, 0.68, 0.74, 1.005, 0.89],
    ],
    orange,
  );
  hull(
    body,
    [
      [-0.91, 0.705, 0.72, 0.75, 0.86, 0.85],
      [-0.32, 0.73, 1.16, 1.24, 0.84, 0.69],
      [0.42, 0.75, 1.18, 1.25, 0.84, 0.7],
      [1.27, 0.76, 0.82, 0.83, 0.87, 0.82],
    ],
    glass,
  );
  hull(
    body,
    [
      [-0.3, 1.19, 1.225, 1.26, 0.7, 0.65],
      [0.4, 1.2, 1.24, 1.27, 0.71, 0.65],
    ],
    orange,
  );
  function beam(p, q, width, depth, mat) {
    const a = new T.Vector3(...p),
      b = new T.Vector3(...q),
      dir = b.clone().sub(a);
    const m = box(
      body,
      mat,
      ...a.clone().add(b).multiplyScalar(0.5).toArray(),
      width,
      dir.length(),
      depth,
    );
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
    return m;
  }
  for (const side of [-1, 1]) {
    beam(
      [side * 0.86, 0.73, -0.91],
      [side * 0.7, 1.245, -0.3],
      0.064,
      0.067,
      orange,
    );
    beam(
      [side * 0.85, 0.75, 0.72],
      [side * 0.705, 1.24, 0.29],
      0.067,
      0.07,
      black,
    );
    beam(
      [side * 0.89, 0.78, 1.34],
      [side * 0.71, 1.25, 0.42],
      0.125,
      0.125,
      orange,
    );
    box(body, black, side * 1.008, 0.393, 0, 0.035, 0.07, 3.89);
    box(body, black, side * 0.982, 0.27, 0.02, 0.09, 0.11, 2.26);
    box(body, black, side * 0.994, 0.625, 0.17, 0.025, 0.036, 0.18);
    beam(
      [side * 0.83, 0.806, -0.49],
      [side * 1.04, 0.85, -0.49],
      0.035,
      0.06,
      black,
    );
    box(body, orange, side * 1.07, 0.86, -0.47, 0.19, 0.11, 0.23);
    box(body, shade, side * 1.07, 0.863, -0.35, 0.15, 0.074, 0.012);
  }
  // Seven individual rear-window louvers, following the slope of the backlight.
  for (let i = 0; i < 7; i++) {
    const t = i / 7;
    const slat = box(
      body,
      black,
      0,
      1.238 - t * 0.395,
      0.53 + t * 0.78,
      1.37 + t * 0.22,
      0.037,
      0.116,
    );
    slat.rotation.x = 0.26;
  }
  for (const x of [-0.42, 0.42]) {
    const stripe = box(body, black, x, 0.792, 1.61, 0.2, 0.012, 0.55);
    stripe.rotation.x = 0.04;
    box(body, black, x, 1.269, 0.053, 0.19, 0.012, 0.67);
    const hood = box(body, black, x, 0.628, -1.47, 0.2, 0.014, 1.13);
    hood.rotation.x = -0.162;
  }
  box(body, black, 0, 0.522, 2.072, 1.98, 0.269, 0.1);
  box(body, orange, 0, 0.368, 2.09, 2.01, 0.102, 0.14);
  box(body, black, 0, 0.246, 2.07, 1.91, 0.137, 0.17);
  for (const x of [-0.72, 0.72]) {
    box(body, grille, x, 0.555, 2.124, 0.55, 0.157, 0.022);
    for (let i = 0; i < 5; i++) {
      const off = (i - 2) * 0.101;
      box(
        body,
        (i === 0 && x < 0) || (i === 4 && x > 0) ? amber : red,
        x + off,
        0.561,
        2.143,
        0.094,
        0.1,
        0.025,
      );
    }
    box(body, black, x, 0.81, 1.81, 0.081, 0.17, 0.16);
    box(body, cream, x, 0.489, -2.087, 0.35, 0.084, 0.038);
  }
  box(body, black, 0, 0.908, 1.83, 2.1, 0.061, 0.29);
  box(body, orange, 0, 0.941, 1.83, 2.12, 0.023, 0.3);
  for (const side of [-1, 1]) {
    box(body, black, side * 1.058, 0.935, 1.84, 0.038, 0.116, 0.35);
    const tail = solid(
      body,
      new T.CylinderGeometry(0.063, 0.07, 0.22, 12),
      rim,
      side * 0.75,
      0.204,
      2.12,
    );
    tail.rotation.x = Math.PI / 2;
    solid(
      body,
      new T.CircleGeometry(0.049, 12),
      grille,
      side * 0.75,
      0.204,
      2.236,
    );
  }
  numberPlate(body, spec.plate, 0.493, 2.134);
  const wheels = [];
  for (const z of [-1.31, 1.29])
    for (const side of [-1, 1]) {
      const pivot = new T.Group();
      root.add(pivot);
      pivot.position.set(side * 0.96, 0.326, z);
      const wheel = new T.Group();
      pivot.add(wheel);
      function disc(rad, len, mat, x) {
        const obj = solid(
          wheel,
          new T.CylinderGeometry(rad, rad, len, 24),
          mat,
          x,
          0,
          0,
        );
        obj.rotation.z = Math.PI / 2;
        return obj;
      }
      disc(0.324, 0.224, tire, 0);
      disc(0.221, 0.012, rim, side * 0.117);
      disc(0.17, 0.014, black, side * 0.128);
      disc(0.081, 0.021, rim, side * 0.141);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const spoke = box(
          wheel,
          rim,
          side * 0.14,
          Math.cos(a) * 0.13,
          Math.sin(a) * 0.13,
          0.014,
          0.124,
          0.043,
        );
        spoke.rotation.x = a;
      }
      wheels.push({ pivot, wheel, front: z < 0 });
    }
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d"),
    g = ctx.createRadialGradient(64, 64, 13, 64, 64, 64);
  g.addColorStop(0, "rgba(29,19,18,.65)");
  g.addColorStop(0.52, "rgba(29,19,18,.45)");
  g.addColorStop(1, "rgba(29,19,18,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const shadow = new T.Mesh(
    new T.PlaneGeometry(3.1, 5.8),
    new T.MeshBasicMaterial({
      map: new T.CanvasTexture(c),
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.009;
  root.add(shadow);
  return {
    root,
    update(state, roll, braking) {
      body.rotation.z =
        state.steer * Math.min(Math.abs(state.speed) * 0.005, 0.065);
      for (const w of wheels) {
        w.wheel.rotation.x = roll;
        if (w.front) w.pivot.rotation.y = state.steer;
      }
      red.emissiveIntensity = braking ? 1.65 : 0.28;
    },
  };
}

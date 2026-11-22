import * as T from "three";
import { box, paint, solid } from "../world/geometry.js";
import { numberPlate } from "./parts.js";
import { rearPorts, steeringPorts } from "./ports.js";
import wordmarkUrl from "./assets/tesla-wordmark.svg?url";

// Sweep a closed cross-section across the tail, including its swept-back corners.
function panel(body, material, spine, section) {
  const vertices = [],
    indices = [],
    n = section.length;
  for (const [x, y, z] of spine)
    for (const [dy, dz] of section) vertices.push(x, y + dy, z + dz);
  for (let i = 0; i < spine.length - 1; i++)
    for (let j = 0; j < n; j++) {
      const a = i * n + j,
        b = i * n + ((j + 1) % n);
      indices.push(a, b, a + n, b, b + n, a + n);
    }
  const end = (spine.length - 1) * n;
  for (let j = 1; j < n - 1; j++)
    indices.push(0, j + 1, j, end, end + j, end + j + 1);
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return solid(body, g, material);
}

export function addRoadsterRear(body, coat, brake, plate) {
  const carbon = paint("#25272a", { roughness: 0.63, metalness: 0.16 });
  const cavity = paint("#111418", { roughness: 0.88 });
  const bronze = paint("#aa8b61", { metalness: 0.42, roughness: 0.37 });
  const blade = paint("#42474c", { metalness: 0.3, roughness: 0.48 });
  const shoulder = [
    [-1.025, 0.67, 1.76],
    [-1.01, 0.74, 2.05],
    [-0.93, 0.783, 2.223],
    [-0.72, 0.795, 2.278],
    [0, 0.798, 2.29],
    [0.72, 0.795, 2.278],
    [0.93, 0.783, 2.223],
    [1.01, 0.74, 2.05],
    [1.025, 0.67, 1.76],
  ];
  panel(body, coat, shoulder, [
    [0.025, 0.013],
    [-0.089, 0.041],
    [-0.27, 0.008],
    [-0.285, -0.07],
    [0.008, -0.17],
  ]);
  panel(body, carbon, shoulder, [
    [0.043, 0.012],
    [0.036, 0.034],
    [-0.018, 0.037],
    [-0.026, 0.014],
    [-0.018, -0.015],
    [0.04, -0.017],
  ]);
  panel(body, brake, shoulder, [
    [0.022, 0.038],
    [0.002, 0.04],
    [-0.001, 0.032],
    [0.021, 0.031],
  ]);

  // A thin, raised aerofoil follows the curvature of the rear shoulders.
  const wing = [
    [-1.035, 0.965, 2.025],
    [-0.93, 1.025, 2.08],
    [-0.52, 1.049, 2.122],
    [0, 1.055, 2.14],
    [0.52, 1.049, 2.122],
    [0.93, 1.025, 2.08],
    [1.035, 0.965, 2.025],
  ];
  const wingSection = [
    [0.011, 0.095],
    [-0.017, 0.09],
    [-0.031, -0.071],
    [-0.013, -0.17],
    [0.004, -0.16],
    [0.022, -0.052],
  ];
  panel(body, carbon, wing, wingSection);
  for (const side of [-1, 1]) {
    const strut = box(
      body,
      carbon,
      side * 0.49,
      0.91,
      2.052,
      0.044,
      0.3,
      0.085,
    );
    strut.rotation.x = 0.31;
    const tip = box(
      body,
      carbon,
      side * 1.034,
      0.932,
      2.011,
      0.021,
      0.104,
      0.23,
    );
    tip.rotation.z = side * 0.13;
  }

  const bottom = [
    [-0.98, 0.43, 2.01],
    [-0.9, 0.43, 2.18],
    [-0.7, 0.43, 2.263],
    [-0.55, 0.43, 2.283],
    [0, 0.43, 2.294],
    [0.55, 0.43, 2.283],
    [0.7, 0.43, 2.263],
    [0.9, 0.43, 2.18],
    [0.98, 0.43, 2.01],
  ];
  panel(body, carbon, bottom, [
    [0.055, 0.016],
    [0.013, 0.025],
    [-0.208, 0.022],
    [-0.249, -0.053],
    [-0.235, -0.23],
    [0.034, -0.18],
  ]);
  box(body, cavity, 0, 0.282, 2.313, 1.19, 0.188, 0.02);
  for (const x of [-0.45, -0.15, 0.15, 0.45]) {
    solid(body, new T.CircleGeometry(0.081, 24), cavity, x, 0.281, 2.33);
    solid(
      body,
      new T.TorusGeometry(0.081, 0.009, 6, 24),
      blade,
      x,
      0.281,
      2.335,
    );
    for (let i = 0; i < 7; i++) {
      const a = (i * 2 * Math.PI) / 7;
      const vane = box(
        body,
        blade,
        x + 0.041 * Math.cos(a),
        0.281 + 0.041 * Math.sin(a),
        2.338,
        0.065,
        0.012,
        0.008,
      );
      vane.rotation.z = a + 0.4;
    }
    solid(body, new T.CircleGeometry(0.021, 12), carbon, x, 0.281, 2.345);
  }
  for (const x of [-0.63, -0.3, 0, 0.3, 0.63])
    box(body, carbon, x, 0.265, 2.32, 0.023, 0.16, 0.1);
  for (const p of rearPorts) {
    solid(body, new T.CircleGeometry(0.059, 24), cavity, p.x, p.y, p.z - 0.006);
    solid(
      body,
      new T.TorusGeometry(0.056, 0.008, 7, 28),
      bronze,
      p.x,
      p.y,
      p.z,
    );
  }
  for (const p of steeringPorts) {
    const surround = solid(
      body,
      new T.CylinderGeometry(0.09, 0.102, 0.045, 20),
      carbon,
      p.x - p.dx * 0.016,
      p.y,
      p.z,
    );
    surround.rotation.z = Math.PI / 2;
    const rim = solid(
      body,
      new T.TorusGeometry(0.058, 0.008, 6, 20),
      bronze,
      p.x + p.dx * 0.009,
      p.y,
      p.z,
    );
    rim.rotation.y = (p.dx * Math.PI) / 2;
    const throat = solid(
      body,
      new T.CircleGeometry(0.055, 20),
      cavity,
      p.x + p.dx * 0.007,
      p.y,
      p.z,
    );
    throat.rotation.y = rim.rotation.y;
  }
  const map = new T.TextureLoader().load(wordmarkUrl);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  const badge = solid(
    body,
    new T.PlaneGeometry(0.55, 0.073),
    paint("#25272b", {
      map,
      alphaTest: 0.36,
      metalness: 0.25,
      roughness: 0.42,
    }),
    0,
    0.688,
    2.335,
  );
  badge.castShadow = false;
  numberPlate(body, plate, 0.543, 2.333, 0.342, "#dbdbd4");
}

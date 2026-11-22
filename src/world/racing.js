import * as T from "three";
import { batchStatic, box, paint, randomSource, solid } from "./geometry.js";
import { cityCorners } from "./courses.js";
import { grainTexture } from "./road.js";

const luminous = color => new T.MeshBasicMaterial({ color });

function sign(parent, text, x, y, z, width, height, color = "#eff4ee", background = "#182529") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 62px sans-serif";
  ctx.fillText(text, 256, 51, 486);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return solid(parent, new T.PlaneGeometry(width, height),
    new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }), x, y, z);
}

function checkeredLine(group, z, width) {
  const light = paint("#f6f4dc"), dark = paint("#252930");
  const cell = width / 24;
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 24; i++)
      box(group, (row + i) % 2 ? light : dark, -width / 2 + cell * (i + 0.5), 0.045,
        z + cell * (row - 0.5), cell, 0.018, cell);
}

export function buildStrip(group, course) {
  const { length, surface } = course;
  const texture = grainTexture(218, 30, 42);
  texture.repeat.set(5, (length + 130) / 5);
  const strip = paint(surface.color, { map: texture, roughness: surface.grip < 0.75 ? 0.5 : 0.92 });
  const concrete = paint("#a5a69e"), orange = paint("#ee7838"), white = paint("#f4efe3");
  const steel = paint("#44515b"), tires = paint("#252b2d");
  const depth = length + 130, mid = 25 - depth / 2;
  box(group, paint("#b2a489"), 0, -0.55, mid, 1400, 1, depth + 1000);
  box(group, strip, 0, -0.04, mid, 22, 0.12, depth);
  for (const side of [-1, 1]) {
    box(group, white, side * 9.6, 0.034, mid, 0.15, 0.015, depth);
    box(group, concrete, side * 11.1, 0.48, mid, 0.65, 1, depth);
    for (let d = 0; d <= length + 80; d += 16)
      box(group, orange, side * 10.75, 0.52, -d, 0.09, 0.45, 3.2);
    for (let d = 4; d < length; d += 75) {
      box(group, steel, side * 15, 5, -d, 0.22, 10, 0.22);
      box(group, white, side * 14.3, 10, -d, 1.8, 0.25, 0.6);
    }
    for (let row = 0; row < 5; row++)
      box(group, row % 2 ? steel : concrete, side * (20 + row * 1.5), 0.35 + row * 0.6,
        -13, 1.7, 0.6 + row * 0.48, 52);
  }
  box(group, white, 0, 0.034, 0, 20, 0.02, 0.32);
  checkeredLine(group, -length, 20);
  for (const side of [-1, 1]) box(group, steel, side * 11.6, 4.4, -length, 0.8, 8.8, 1);
  box(group, tires, 0, 8.1, -length, 24, 1.8, 1);
  sign(group, "FINISH", 0, 8.12, -length + 0.52, 10, 1.6);
  for (let d = 100; d < length; d += 100)
    sign(group, d + " m", 10.9, 1.65, -d, 3.6, 1, "#ffbf76");
  batchStatic(group);
  return [];
}

function facade(seed) {
  const rand = randomSource(seed), c = document.createElement("canvas");
  c.width = 128; c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = ["#474e5b", "#5b6269", "#5b4944"][seed % 3];
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 3; y < 256; y += 12)
    for (let x = 2; x < 128; x += 8) {
      ctx.fillStyle = rand() > 0.65 ? "#d8bea0" : rand() > 0.4 ? "#8297a3" : "#394452";
      ctx.fillRect(x, y, 5, 7);
    }
  const map = new T.CanvasTexture(c);
  map.colorSpace = T.SRGBColorSpace;
  return paint("#ffffff", { map });
}

export function buildCity(group) {
  const obstacles = [], rand = randomSource(781), facades = [1, 2, 3, 4].map(facade);
  const curb = paint("#b6b6b2"), roof = paint("#444d54"), paintLine = paint("#e6e0be");
  const glazing = paint("#3d5362", { metalness: 0.25, roughness: 0.42 });
  const awnings = ["#8b4640", "#387063", "#c3944c"].map(c => paint(c));
  const mint = luminous("#53f3d1"), steel = paint("#3e4952");
  box(group, paint("#494f56"), 50, -0.51, -20, 1100, 1, 1100);
  const xs = [-160, -80, 0, 60, 120, 200, 280], zs = [-280, -200, -120, -60, 0, 80, 160, 240];
  for (let i = 1; i < xs.length; i++) for (let j = 1; j < zs.length; j++) {
    const x = (xs[i] + xs[i - 1]) / 2, z = (zs[j] + zs[j - 1]) / 2;
    const w = xs[i] - xs[i - 1] - 18, d = zs[j] - zs[j - 1] - 18;
    box(group, curb, x, 0.09, z, w, 0.24, d);
    for (const side of [-1, 1]) {
      const bx = x + side * w / 4, h = 11 + rand() ** 1.5 * 53, bw = w / 2 - 4, bd = d - 7;
      box(group, facades[Math.floor(rand() * 4)], bx, h / 2, z, bw, h, bd);
      box(group, roof, bx, h + 0.22, z, bw + 0.4, 0.55, bd + 0.4);
      box(group, roof, bx, h + 1.3, z, bw * 0.55, 2.5, bd * 0.5);
      const frontage = side * (bw / 2 + 0.06) + bx;
      box(group, glazing, frontage, 1.55, z, 0.2, 2.9, bd - 1);
      box(group, awnings[(i + j) % 3], frontage, 3.25, z, 1.4, 0.32, bd - 1);
      for (let offset = -bd / 2 + 2; offset < bd / 2; offset += 4)
        box(group, roof, frontage + side * 0.13, 1.5, z + offset, 0.22, 3, 0.16);
      obstacles.push({ x: bx, z, rx: bw / 2, rz: bd / 2, height: h, rectangle: true });
    }
  }
  for (const x of xs) for (const z of zs) {
    // Crosswalks sit across both approaches, just outside each junction.
    for (let i = -6; i <= 6; i += 2) {
      box(group, paintLine, x + i, 0.012, z - 9.5, 0.7, 0.015, 2);
      box(group, paintLine, x + 9.5, 0.012, z + i, 2, 0.015, 0.7);
    }
    box(group, steel, x + 10, 3.4, z + 10, 0.22, 6.8, 0.22);
    box(group, paintLine, x + 9.1, 6.8, z + 10, 2, 0.25, 0.5);
  }
  // Painted chevrons trace the racing line and point around each junction.
  cityCorners.forEach(([x, z], i) => {
    const [ex, ez] = cityCorners[(i + 1) % cityCorners.length];
    const length = Math.hypot(ex - x, ez - z), dx = (ex - x) / length, dz = (ez - z) / length;
    for (let d = 4; d < length; d += 13) for (const side of [-1, 1]) {
      const stripe = box(group, mint, x + dx * d - side * dz * 0.48, 0.034,
        z + dz * d + side * dx * 0.48, 0.25, 0.018, 1.5);
      stripe.rotation.y = Math.atan2(-dx, -dz) + side * 0.75;
    }
  });
  checkeredLine(group, 40, 16);
  sign(group, "FOUNDRY CITY", 0, 7.1, 40, 18, 1.9);
  for (const x of [-9.4, 9.4]) box(group, steel, x, 3.6, 40, 0.5, 7.2, 0.6);
  batchStatic(group);
  return obstacles;
}

export function buildSky(group, course) {
  const rand = randomSource(516);
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  for (let i = 0; i < 65; i++) {
    const x = 44 + rand() * 168, dome = Math.sin(Math.PI * (x - 44) / 168);
    const y = 80 - rand() * dome * 40, r = 10 + rand() * 31;
    const grad = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    grad.addColorStop(0, i < 25 ? "#b5c9dfee" : "#f1f6ffef");
    grad.addColorStop(0.55, i < 25 ? "#bdcee1c0" : "#f3f7ffd1");
    grad.addColorStop(1, "#ebf4ff00");
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  const clouds = new T.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: T.DoubleSide });
  const blue = paint("#8baec2"), rim = paint("#2a414e"), light = luminous("#85dcfb");
  // The start deck and cloud banks sit beneath the flight path.
  box(group, blue, 0, -98, -260, 2400, 2, 2400);
  for (let i = 0; i < 180; i++) {
    const cloud = solid(group, new T.PlaneGeometry(1, 1), clouds,
      rand() * 1100 - 550, -30 - rand() * 50, 180 - rand() * 1150);
    const width = 60 + rand() * 130;
    cloud.scale.set(width, width * 0.38, 1);
    cloud.rotation.set(-0.45, (rand() - 0.5) * Math.PI, 0, "YXZ");
    cloud.castShadow = cloud.receiveShadow = false;
  }
  box(group, rim, 0, -0.6, 7, 16, 1.2, 40);
  for (const x of [-7.5, 7.5]) box(group, light, x, 0.05, 7, 0.25, 0.1, 40);
  course.gates.forEach((g, i) => {
    const portal = new T.Group();
    portal.position.set(g.x, g.y, g.z);
    portal.rotation.y = Math.atan2(-g.dx, -g.dz);
    group.add(portal);
    solid(portal, new T.TorusGeometry(g.radius + 0.48, 0.45, 8, 64), rim);
    solid(portal, new T.TorusGeometry(g.radius + 0.12, 0.13, 8, 64), light, 0, 0, 0.27);
    sign(portal, i === course.gates.length - 1 ? "FINISH" : String(i + 1).padStart(2, "0"),
      0, g.radius + 1.2, 0.1, 3.8, 1);
  });
  batchStatic(group);
  return [];
}

export function disposeCourse(group) {
  const materials = new Set();
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    materials.add(mesh.material);
  });
  for (const material of materials) {
    material.map?.dispose();
    material.dispose();
  }
}

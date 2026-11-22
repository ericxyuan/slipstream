import * as T from "three";
import { paint, solid, randomSource } from "./geometry.js";

const path = [
  [0, 80],
  [0, 25],
  [0, -23],
  [10, -62],
  [45, -97],
  [86, -140],
  [93, -205],
  [47, -242],
  [-30, -255],
  [-103, -222],
  [-145, -155],
  [-148, -60],
  [-125, 21],
  [-106, 110],
  [-53, 151],
  [-10, 131],
];
export const road = new T.CatmullRomCurve3(
  path.map(([x, z]) => new T.Vector3(x, 0, z)),
  true,
);
const samples = road.getSpacedPoints(480);
export function roadDistance(x, z) {
  let nearest = Infinity;
  for (const p of samples)
    nearest = Math.min(nearest, (x - p.x) ** 2 + (z - p.z) ** 2);
  return Math.sqrt(nearest);
}
export function grainTexture(a, b, seed) {
  const rand = randomSource(seed),
    c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d"),
    im = ctx.createImageData(256, 256);
  for (let i = 0; i < im.data.length; i += 4) {
    const v = a + (rand() + rand() - 1) * b;
    im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
    im.data[i + 3] = 255;
  }
  ctx.putImageData(im, 0, 0);
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export function addRoad(group) {
  const len = road.getLength();
  function ribbon(l, r, y, mat) {
    const pos = [],
      uv = [],
      idx = [];
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i],
        tangent = road.getTangentAt(i / (samples.length - 1)),
        nx = -tangent.z,
        nz = tangent.x;
      for (const off of [l, r]) {
        pos.push(p.x + nx * off, y, p.z + nz * off);
        uv.push(off / 4, (len * i) / (samples.length - 1) / 4);
      }
      if (i) {
        const k = i * 2;
        idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = solid(group, geo, mat);
    m.castShadow = false;
  }
  ribbon(
    -8.5,
    8.5,
    0.016,
    paint("#c59974", { map: grainTexture(220, 32, 33) }),
  );
  ribbon(
    -7.9,
    7.9,
    0.024,
    paint("#585353", { map: grainTexture(180, 25, 22) }),
  );
  const white = paint("#e6d8bc"),
    yellow = paint("#e7ab48");
  ribbon(-7.55, -7.43, 0.037, white);
  ribbon(7.43, 7.55, 0.037, white);
  ribbon(-0.18, -0.055, 0.037, yellow);
  ribbon(0.055, 0.18, 0.037, yellow);
}

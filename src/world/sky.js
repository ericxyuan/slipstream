import * as T from "three";
import { randomSource } from "./geometry.js";

export function makeSky(scene) {
  const c = document.createElement("canvas");
  c.width = 3072;
  c.height = 1024;
  const ctx = c.getContext("2d", { willReadFrequently: true }),
    rand = randomSource(484);
  const gradient = ctx.createLinearGradient(0, 0, 0, 780);
  gradient.addColorStop(0, "#396b98");
  gradient.addColorStop(0.45, "#76a8c1");
  gradient.addColorStop(0.61, "#bad0cc");
  gradient.addColorStop(0.685, "#f2d2ab");
  gradient.addColorStop(1, "#e5b48d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, c.width, c.height);
  // Long, feathered streaks of cirrus on a seamless panoramic sky.

  for (let i = 0; i < 78; i++) {
    const x = rand() * c.width,
      y = 294 + rand() * 201,
      w = 28 + rand() * 175,
      h = 2 + rand() * 9;
    for (let j = 0; j < 34; j++) {
      const t = rand(),
        xx = x + w * t,
        yy = y - Math.sin(t * Math.PI) * h + rand() * h * 0.8;
      ctx.fillStyle = "rgba(255,242,216," + (0.045 + rand() * 0.08) + ")";
      for (const shift of [-c.width, 0, c.width]) {
        ctx.beginPath();
        ctx.ellipse(
          xx + shift,
          yy,
          5 + rand() * w * 0.34,
          1 + rand() * h * 0.28,
          -0.035,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  const sky = new T.Mesh(
    new T.SphereGeometry(1150, 40, 24),
    new T.MeshBasicMaterial({
      map: tex,
      side: T.BackSide,
      fog: false,
      depthWrite: false,
    }),
  );
  sky.renderOrder = -2;
  scene.add(sky);
  return sky;
}

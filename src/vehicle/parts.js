import * as T from "three";
import { paint, solid } from "../world/geometry.js";
// Each cross-section describes longitudinal position, base, shoulder and crown.
export function hull(body, stations, material) {
  const v = [],
    idx = [];
  for (const [z, base, shoulder, top, w, tw] of stations)
    v.push(
      -w * 0.95,
      base,
      z,
      -w,
      shoulder,
      z,
      -tw,
      top,
      z,
      tw,
      top,
      z,
      w,
      shoulder,
      z,
      w * 0.95,
      base,
      z,
    );
  for (let s = 0; s < stations.length - 1; s++)
    for (let j = 0; j < 6; j++) {
      const a = s * 6 + j,
        b = s * 6 + ((j + 1) % 6);
      idx.push(a, a + 6, b, b, a + 6, b + 6);
    }
  const k = (stations.length - 1) * 6;
  for (let i = 1; i < 5; i++) {
    idx.push(0, i, i + 1, k, k + i + 1, k + i);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  const faces = g.toNonIndexed();
  faces.computeVertexNormals();
  g.dispose();
  return solid(body, faces, material);
}

export function numberPlate(
  body,
  text,
  y,
  z,
  width = 0.47,
  background = "#e8d8b5",
) {
  const plate = document.createElement("canvas");
  plate.width = 384;
  plate.height = 112;
  const pc = plate.getContext("2d");
  pc.fillStyle = background;
  pc.fillRect(0, 0, 384, 112);
  pc.strokeStyle = "#372f29";
  pc.lineWidth = 7;
  pc.strokeRect(5, 5, 374, 102);
  pc.fillStyle = "#252624";
  pc.font = "bold 71px monospace";
  pc.textAlign = "center";
  pc.fillText(text, 192, 81);
  const pm = new T.CanvasTexture(plate);
  pm.colorSpace = T.SRGBColorSpace;
  const tag = solid(
    body,
    new T.PlaneGeometry(width, width * 0.298),
    paint("#fff", { map: pm }),
    0,
    y,
    z,
  );
  tag.castShadow = false;
}

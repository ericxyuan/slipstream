// The procedural desert uses seeded geometry. Export its physical shapes for
// the headless room simulation whenever its layout changes.
import { Group } from "three";
import { buildDesert } from "../src/world/desert.js";
import { writeFileSync } from "node:fs";
const drawing = {
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
};
globalThis.document = {
  createElement: () => ({
    getContext: () =>
      new Proxy(drawing, { get: (obj, key) => obj[key] ?? (() => {}) }),
  }),
};
const scene = new Group();
const obstacles = buildDesert(scene);
writeFileSync(
  new URL("../src/world/desert-colliders.json", import.meta.url),
  JSON.stringify(obstacles),
);
writeFileSync(
  new URL("../src/world/desert-roadside.json", import.meta.url),
  JSON.stringify(scene.userData.roadside),
);

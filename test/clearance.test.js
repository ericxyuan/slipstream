import test from "node:test";
import assert from "node:assert/strict";
import { Group, Vector3 } from "three";
import { coastSolids, clearOfCoast } from "../src/world/coast.js";
import { clearOfDesert } from "../src/world/road.js";
import { buildDesert } from "../src/world/desert.js";
import { buildCoast } from "../src/world/coast-scene.js";
import { makeCourse } from "../src/world/events.js";
import colliders from "../src/world/desert-colliders.json" with { type: "json" };

test("both loop maps keep fixed scenery beyond the one-and-a-half-vehicle shoulder margin", () => {
  // The same builders generate the browser meshes and the headless server data.
  const ctx = new Proxy(
    { createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) },
    { get: (target, k) => target[k] ?? (() => {}) },
  );
  const original = globalThis.document;
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
  try {
    for (const [id, clear] of [
      ["coast", clearOfCoast],
      ["desert", clearOfDesert],
    ]) {
      const scene = new Group();
      const obs =
        id === "coast"
          ? buildCoast(scene, makeCourse({ map: id }))
          : buildDesert(scene);
      assert.deepEqual(obs, id === "coast" ? coastSolids : colliders);
      for (const o of obs)
        assert.ok(
          clear(
            o.x,
            o.z,
            o.rectangle ? Math.hypot(o.rx, o.rz) : Math.max(o.rx, o.rz),
          ),
          id + " collider at " + o.x + "," + o.z,
        );
      scene.updateMatrixWorld(true);
      scene.traverse((mesh) => {
        if (!mesh.isMesh) return;
        // Ground and paint are flat. Check the elevated scenery vertices, including
        // signs, rocks and roof overhangs that do not have their own collider.
        const pos = mesh.geometry.attributes.position,
          point = new Vector3();
        for (let i = 0; i < pos.count; i++) {
          point.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
          if (point.y < 0.09) continue;
          assert.ok(
            clear(point.x, point.z, 0),
            id + " scenery encroached on road",
          );
        }
      });
    }
  } finally {
    if (original) globalThis.document = original;
    else delete globalThis.document;
  }
});

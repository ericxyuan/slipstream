import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export const paint = (color, options = {}) =>
  new T.MeshStandardMaterial({ color, roughness: 0.88, ...options });
export function solid(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function box(parent, material, x, y, z, w, h, d) {
  return solid(parent, new T.BoxGeometry(w, h, d), material, x, y, z);
}
export function randomSource(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
// Bake scenery into spatial batches so distant sections can be culled as a unit.
export function batchStatic(group) {
  group.updateMatrixWorld(true);
  const batches = new Map();
  const p = new T.Vector3();
  group.traverse((mesh) => {
    if (!mesh.isMesh) return;
    mesh.getWorldPosition(p);
    const key = [
      mesh.material.uuid,
      Math.floor(p.x / 80),
      Math.floor(p.z / 80),
      mesh.castShadow,
      mesh.receiveShadow,
    ].join("/");
    if (!batches.has(key))
      batches.set(key, {
        material: mesh.material,
        geometries: [],
        cast: mesh.castShadow,
        receive: mesh.receiveShadow,
      });
    const g = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry.clone();
    g.applyMatrix4(mesh.matrixWorld);
    if (!mesh.material.map) g.deleteAttribute("uv");
    batches.get(key).geometries.push(g);
    mesh.geometry.dispose();
  });
  group.clear();
  for (const { material, geometries, cast, receive } of batches.values()) {
    const g = mergeGeometries(geometries);
    const mesh = new T.Mesh(g, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    group.add(mesh);
    for (const part of geometries) part.dispose();
  }
}

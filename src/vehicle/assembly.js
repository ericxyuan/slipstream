import * as T from "three";
import { randomSource } from "../world/geometry.js";

// The same spatial threshold cuts the painted surfaces, the shadow and the fragments.
const CELL = 0.105;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const wrap = (v, m) => ((v % m) + m) % m;
function boundaryAt(p, spec) {
  const x = Math.floor(p.x / CELL),
    y = Math.floor(p.y / CELL),
    z = Math.floor(p.z / CELL);
  const hash = wrap(x * 47 + y * 71 + z * 97, 251);
  const grain = wrap(hash * hash * 13 + hash * 17, 251) / 251;
  return (
    0.05 +
    0.9 *
      (0.53 * clamp01(0.5 + p.z / spec.length) +
        0.33 * clamp01(p.y / spec.height) +
        0.14 * grain)
  );
}
function assemblySurface(material, uniforms, depth = false) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      "uniform mat4 uVehicleInverse; varying vec3 vAssembly;\n" +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\nvAssembly=(uVehicleInverse*modelMatrix*vec4(transformed,1.)).xyz;",
    );
    shader.fragmentShader =
      "uniform float uBuilt; uniform float uHeight; uniform float uLength; uniform float uReverseSweep; uniform vec3 uAccent; varying vec3 vAssembly;\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <clipping_planes_fragment>",
      `
      #include <clipping_planes_fragment>
      float boundary=0.;
      if(uBuilt<1.){
        vec3 cell=floor(vAssembly/${CELL});
        float hash=mod(dot(cell,vec3(47.,71.,97.)),251.);
        float grain=mod(hash*hash*13.+hash*17.,251.)/251.;
        boundary=.05+.9*(.53*clamp(.5+vAssembly.z/uLength,0.,1.)+.33*clamp(vAssembly.y/uHeight,0.,1.)+.14*grain);
        boundary=mix(boundary,1.-boundary,uReverseSweep);
        if(boundary>uBuilt)discard;
      }`,
    );
    if (!depth)
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "if(uBuilt<1.) outgoingLight=mix(outgoingLight,uAccent*2.2,1.-smoothstep(.002,.028,uBuilt-boundary));\n#include <opaque_fragment>",
      );
  };
  material.customProgramCacheKey = () =>
    depth ? "vehicle-build-depth" : "vehicle-build-surface";
}
function surfaceSamples(root, spec, rand, count) {
  root.updateMatrixWorld(true);
  const triangles = [],
    a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3(),
    tri = new T.Triangle();
  let area = 0;
  root.traverse((mesh) => {
    if (!mesh.isMesh || mesh.material.transparent) return;
    const geo = mesh.geometry,
      pos = geo.attributes.position,
      index = geo.index;
    for (let i = 0; i < (index?.count ?? pos.count); i += 3) {
      for (const [v, j] of [
        [a, 0],
        [b, 1],
        [c, 2],
      ])
        v.fromBufferAttribute(
          pos,
          index ? index.getX(i + j) : i + j,
        ).applyMatrix4(mesh.matrixWorld);
      const weight = tri.set(a, b, c).getArea();
      if (weight < 1e-7) continue;
      area += weight;
      triangles.push({
        a: a.clone(),
        b: b.clone(),
        c: c.clone(),
        end: area,
        color: mesh.material.color,
        normal: tri.getNormal(new T.Vector3()),
      });
    }
  });
  return Array.from({ length: count }, () => {
    const pick = rand() * area;
    let lo = 0,
      hi = triangles.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (triangles[mid].end < pick) lo = mid + 1;
      else hi = mid;
    }
    const t = triangles[lo],
      r = Math.sqrt(rand()),
      v = rand();
    const p = t.a
      .clone()
      .multiplyScalar(1 - r)
      .addScaledVector(t.b, r * (1 - v))
      .addScaledVector(t.c, r * v);
    const noise = rand();
    const outward = new T.Vector3(
      p.x,
      p.y * 0.45 + 0.25,
      p.z * 0.38,
    ).normalize();
    const normal = t.normal.clone();
    if (normal.dot(outward) < 0) normal.negate();
    const drift = outward
      .multiplyScalar(0.8 + 1.65 * rand())
      .addScaledVector(normal, 0.65 + rand());
    drift.y += 0.45 + rand() * 0.7;
    return {
      p,
      color: t.color,
      threshold: boundaryAt(p, spec),
      noise,
      drift,
      alignment: new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        normal,
      ),
      size: 0.045 + rand() * 0.096,
    };
  });
}
export class Assembly {
  constructor(model, spec) {
    this.root = model.root;
    this.model = model;
    this.spec = spec;
    this.level = 0;
    this.uniforms = {
      uVehicleInverse: { value: new T.Matrix4() },
      uBuilt: { value: 1 },
      uReverseSweep: { value: 0 },
      uHeight: { value: spec.height },
      uLength: { value: spec.length },
      uAccent: { value: new T.Color(spec.color) },
    };
    const depth = new T.MeshDepthMaterial({
      depthPacking: T.RGBADepthPacking,
      side: T.DoubleSide,
    });
    assemblySurface(depth, this.uniforms, true);
    const materials = new Set();
    this.shadow = null;
    this.root.traverse((mesh) => {
      if (!mesh.isMesh) return;
      if (mesh.material.transparent) {
        this.shadow = mesh;
        return;
      }
      if (!materials.has(mesh.material)) {
        assemblySurface(mesh.material, this.uniforms);
        materials.add(mesh.material);
      }
      mesh.customDepthMaterial = depth;
    });
    const rand = randomSource(238 + spec.length * 100);
    this.samples = surfaceSamples(
      this.root,
      spec,
      rand,
      spec.length > 6 ? 820 : 520,
    );
    this.bits = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.68, 0),
      new T.MeshStandardMaterial({ roughness: 0.65 }),
      this.samples.length,
    );
    this.bits.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.bits.frustumCulled = false;
    this.bits.visible = false;
    this.root.add(this.bits);
    this.dummy = new T.Object3D();
    this.spin = new T.Quaternion();
    this.root.visible = false;
  }
  update(target, dt, s, roll, braking) {
    // Sweep away the outgoing nose first while the new nose forms in its place.
    // Keep the sweep orientation when a rapid scroll reverses a partial build.
    if (this.level === 1 && !target) this.uniforms.uReverseSweep.value = 1;
    if (this.level === 0 && target) this.uniforms.uReverseSweep.value = 0;
    this.level = T.MathUtils.clamp(
      this.level + ((target ? 1 : -1) * dt) / 1.22,
      0,
      1,
    );
    this.root.visible = this.level > 0;
    if (!this.root.visible) return;
    this.root.position.set(s.x, 0.04 + s.altitude, s.z);
    this.root.rotation.y = s.heading;
    this.root.updateMatrix();
    this.uniforms.uVehicleInverse.value.copy(this.root.matrix).invert();
    const build = this.level * this.level * (3 - 2 * this.level);
    this.uniforms.uBuilt.value = build;
    this.model.update(s, roll, braking);
    if (this.shadow) {
      this.shadow.material.opacity = this.level;
      this.shadow.position.y = 0.009 - s.altitude;
    }
    this.bits.visible = this.level < 1;
    if (!this.bits.visible) return;
    let count = 0;
    for (const bit of this.samples) {
      const threshold = this.uniforms.uReverseSweep.value
        ? 1 - bit.threshold
        : bit.threshold;
      const age = (threshold - build) / 0.41;
      if (age <= 0 || age >= 1) continue;
      const d = this.dummy,
        arc = age * age * (3 - 2 * age);
      d.position.copy(bit.p).addScaledVector(bit.drift, arc);
      const swirl = Math.sin(Math.PI * age) * (0.22 + 0.35 * bit.noise);
      d.position.x += bit.p.z * swirl * 0.37;
      d.position.z -= bit.p.x * swirl;
      d.position.y += Math.sin(Math.PI * age) * 0.49;
      d.rotation.set(
        age * (3 + bit.noise),
        age * (bit.noise - 0.5) * 7,
        age * 2.5,
      );
      this.spin.copy(d.quaternion);
      d.quaternion.copy(bit.alignment).multiply(this.spin);
      const scale = bit.size * (1 - arc) * Math.min(1, this.level * 12);
      d.scale.set(scale * (1.25 + bit.noise), scale * 0.39, scale * 0.92);
      d.updateMatrix();
      this.bits.setMatrixAt(count, d.matrix);
      this.bits.setColorAt(
        count,
        bit.noise > 0.86 ? this.uniforms.uAccent.value : bit.color,
      );
      count++;
    }
    this.bits.count = count;
    this.bits.instanceMatrix.needsUpdate = true;
    if (this.bits.instanceColor) this.bits.instanceColor.needsUpdate = true;
  }
}

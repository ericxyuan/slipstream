import * as T from "three";
import { randomSource } from "./geometry.js";

// Wrap a fixed field of streaks around the camera so rain stays in world space as the car moves.
export function makeRain(scene) {
  const count = 1100,
    random = randomSource(2193);
  const starts = new Float32Array(count * 6),
    tips = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = random() * 36,
      y = random() * 22,
      z = random() * 36;
    starts.set([x, y, z, x, y, z], i * 6);
    tips[i * 2 + 1] = 1;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(starts, 3));
  geometry.setAttribute("tip", new T.BufferAttribute(tips, 1));
  const uniforms = {
    offset: { value: new T.Vector3() },
    strength: { value: 0 },
  };
  const material = new T.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      uniform vec3 offset;
      attribute float tip;
      varying float fade;
      void main() {
        vec3 span = vec3(36.,22.,36.);
        vec3 p = mod(position + offset, span) - span * .5;
        fade = (1.-smoothstep(12.,18.,length(p.xz))) * smoothstep(.35,2.,length(p));
        p += tip * vec3(.055,-.48,.014);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.);
      }`,
    fragmentShader: `
      uniform float strength;
      varying float fade;
      void main() {
        gl_FragColor = vec4(.60,.74,.82, strength * fade);
        #include <colorspace_fragment>
      }`,
  });
  const rain = new T.LineSegments(geometry, material);
  rain.frustumCulled = false;
  scene.add(rain);
  const wind = new T.Vector3(0, 0, 0);
  return function update(camera, weather, dt) {
    const level = T.MathUtils.smoothstep(weather, 0.55, 1);
    rain.visible = level > 0;
    if (!rain.visible) return;
    wind.x = (wind.x + dt * 1.8) % 36;
    wind.y = (wind.y - dt * 15) % 22;
    wind.z = (wind.z + dt * 0.45) % 36;
    rain.position.copy(camera.position);
    uniforms.offset.value.copy(wind).sub(camera.position);
    uniforms.strength.value = 0.12 + level * 0.39;
    geometry.setDrawRange(0, 2 * Math.ceil(count * level));
  };
}

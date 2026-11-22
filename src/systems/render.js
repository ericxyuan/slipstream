import * as T from "three";
import { makeSky } from "../world/sky.js";
export function initRenderer(canvas) {
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  const scene = new T.Scene();
  scene.background = new T.Color("#a8c7cc");
  scene.fog = new T.FogExp2("#dabba1", 0.00255);
  const sky = makeSky(scene);
  const ambient = new T.HemisphereLight(0xfff2df, 0xd3a080, 1.52);
  scene.add(ambient);
  const sun = new T.DirectionalLight(0xffe0b2, 2.25);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -26,
    right: 26,
    top: 26,
    bottom: -26,
    near: 0.5,
    far: 170,
  });
  sun.shadow.normalBias = 0.018;
  sun.shadow.bias = -0.0003;
  scene.add(sun, sun.target);
  return {
    scene,
    renderer,
    atmosphere(id) {
      const tint = { desert: "#ffffff", drag: "#f0f5ff", city: "#bfd6ea", sky: "#d2e8ff" };
      const fog = { desert: "#dabba1", drag: "#b6bfc5", city: "#a7b7c6", sky: "#c9e2f4" };
      sky.material.color.set(tint[id]);
      scene.fog.color.set(fog[id]);
      const cool = id === "sky" || id === "city";
      ambient.groundColor.set(cool ? "#acbbca" : "#d3a080");
      sun.color.set(cool ? "#fff3e4" : "#ffe0b2");
      scene.fog.density = id === "drag" ? 0.0015 : 0.00255;
    },
    draw(camera, state) {
      sky.position.copy(camera.position);
      const x = Math.round(state.x / 2) * 2,
        z = Math.round(state.z / 2) * 2;
      sun.position.set(x - 48, 57, z + 33);
      sun.target.position.set(x, 0, z);
      renderer.render(scene, camera);
    },
  };
}

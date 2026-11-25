import * as T from "three";
import { makeSky } from "../world/sky.js";
import { makeRain } from "../world/rain.js";

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
  const rain = makeRain(scene);
  const uniforms = sky.material.uniforms;
  const daylightFog = new T.Color(),
    ground = new T.Color(),
    sunshine = new T.Color();
  const midnight = new T.Color("#27374c"),
    storm = new T.Color("#838f9b");
  const twilight = new T.Color("#eda77c"),
    moon = new T.Color("#a7bfe8");
  const skyLight = new T.Color("#fff2df"),
    nightGround = new T.Color("#687993");
  const sunrise = new T.Color("#ffbb89");
  let baseDensity = 0.00255;
  return {
    scene,
    renderer,
    atmosphere(id) {
      const tint = {
        coast: "#e3f5fb",
        desert: "#ffffff",
        drag: "#f0f5ff",
        city: "#bfd6ea",
        sky: "#d2e8ff",
      };
      const fog = {
        coast: "#bbd3d3",
        desert: "#dabba1",
        drag: "#b6bfc5",
        city: "#a7b7c6",
        sky: "#c9e2f4",
      };
      uniforms.tint.value.set(tint[id]);
      daylightFog.set(fog[id]);
      const cool = id === "sky" || id === "city" || id === "coast";
      ground.set(cool ? "#acbbca" : "#d3a080");
      sunshine.set(cool ? "#fff3e4" : "#ffe0b2");
      baseDensity = id === "drag" ? 0.0015 : 0.00255;
    },
    draw(camera, state, { minutes, weather }, dt) {
      const phase = (minutes / 1440 - 0.25) * 2 * Math.PI;
      const height = Math.sin(phase),
        east = Math.cos(phase);
      const daylight = T.MathUtils.smoothstep(height, -0.19, 0.34);
      const warmth =
        (1 - T.MathUtils.smoothstep(Math.abs(height), 0.025, 0.38)) *
        (1 - weather);
      const direction = uniforms.sunDir.value
        .set(east * 0.88, height, east * 0.475)
        .normalize();
      uniforms.daylight.value = daylight;
      uniforms.warmth.value = warmth;
      uniforms.weather.value = weather;
      uniforms.drift.value = (uniforms.drift.value + dt * 0.00072) % 100;
      sky.position.copy(camera.position);
      scene.fog.color
        .copy(daylightFog)
        .lerp(storm, weather)
        .lerp(midnight, 1 - daylight)
        .lerp(twilight, warmth * 0.62);
      scene.fog.density = baseDensity + weather * weather * 0.009;
      uniforms.horizon.value.copy(scene.fog.color);
      ambient.color.copy(moon).lerp(skyLight, daylight * (1 - 0.55 * weather));
      ambient.groundColor.copy(nightGround).lerp(ground, daylight);
      ambient.intensity = 0.64 + daylight * (0.9 - 0.26 * weather);
      sun.color.copy(moon).lerp(sunshine, daylight).lerp(sunrise, warmth);
      sun.intensity = (0.28 + 1.97 * daylight) * (1 - weather * 0.9);
      const x = Math.round(state.x / 2) * 2,
        z = Math.round(state.z / 2) * 2;
      sun.target.position.set(x, 0, z);
      // The moon lights the road after sunset. Crossfade its direction through twilight.
      const sunWeight = 2 * daylight - 1;
      sun.position.set(
        x + 67 * direction.x * sunWeight,
        10 + 57 * Math.abs(height),
        z + 67 * direction.z * sunWeight,
      );
      rain(camera, weather, dt);
      renderer.render(scene, camera);
    },
  };
}

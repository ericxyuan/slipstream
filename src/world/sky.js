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
  const noise = new Uint8Array(64 * 64);
  for (let i = 0; i < noise.length; i++) noise[i] = rand() * 256;
  const clouds = new T.DataTexture(noise, 64, 64, T.RedFormat);
  clouds.wrapS = clouds.wrapT = T.RepeatWrapping;
  clouds.magFilter = clouds.minFilter = T.LinearFilter;
  clouds.needsUpdate = true;
  const material = new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    uniforms: {
      panorama: { value: tex },
      clouds: { value: clouds },
      tint: { value: new T.Color(0xffffff) },
      horizon: { value: new T.Color() },
      sunDir: { value: new T.Vector3() },
      daylight: { value: 1 },
      warmth: { value: 0 },
      weather: { value: 0 },
      drift: { value: 0 },
    },
    vertexShader: `
      varying vec2 skyUv;
      varying vec3 direction;
      void main() {
        skyUv = uv;
        direction = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
      }`,
    fragmentShader: `
      uniform sampler2D panorama, clouds;
      uniform vec3 tint, horizon, sunDir;
      uniform float daylight, warmth, weather, drift;
      varying vec2 skyUv;
      varying vec3 direction;
      void main() {
        vec3 dir = normalize(direction);
        float height = max(0., dir.y);
        vec3 night = mix(vec3(.027,.042,.078), vec3(.004,.009,.032), smoothstep(0., .72, height));
        vec3 day = texture2D(panorama, skyUv).rgb * tint;
        vec3 sky = mix(night, day, daylight);
        float solar = max(0., dot(dir, sunDir));
        sky = mix(sky, vec3(.99,.33,.105), warmth * (.35 + .48*pow(solar, 5.)) * exp(-2.*height));
        float lunar = max(0., dot(dir, -sunDir));
        sky += daylight * vec3(1.,.79,.53) * (.27*pow(solar,60.) + smoothstep(.99978,.99992,solar));
        sky += (1.-daylight) * vec3(.66,.77,.94) * (.12*pow(lunar,90.) + smoothstep(.99982,.99993,lunar));
        vec2 uv = dir.xz / (.30 + height) * .088 + vec2(drift, drift*.31);
        float noise = texture2D(clouds, uv).r * .62 + texture2D(clouds, uv*2.1).r * .26 + texture2D(clouds, uv*5.3).r * .12;
        float cover = smoothstep(.81 - weather*.75, .99 - weather*.75, noise) * smoothstep(.10,.79,weather);
        vec3 cloud = mix(vec3(.037,.046,.066), vec3(.39,.43,.48), daylight) * (.7 + noise*.5 - weather*.35);
        sky = mix(sky, cloud, cover);
        sky = mix(sky, horizon, (1. - smoothstep(-.04,.16,dir.y)) * (.7 + weather*.3));
        gl_FragColor = vec4(sky, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new T.Mesh(new T.SphereGeometry(1150, 40, 24), material);
  sky.renderOrder = -2;
  scene.add(sky);
  return sky;
}

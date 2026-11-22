import * as T from "three";
import { box, paint, solid } from "../world/geometry.js";
import { addRoadsterRear } from "./roadster-rear.js";
import { hull, numberPlate } from "./parts.js";

function label(
  parent,
  text,
  w,
  h,
  x,
  y,
  z,
  background = "#efbd28",
  ink = "#202226",
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.font = "bold 73px sans-serif";
  ctx.fillText(text, 256, 72, 495);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  return solid(
    parent,
    new T.PlaneGeometry(w, h),
    paint("#ffffff", { map, side: T.DoubleSide }),
    x,
    y,
    z,
  );
}

export function buildVariant(spec) {
  const root = new T.Group(),
    body = new T.Group();
  root.add(body);
  const coat = paint(spec.paint??spec.color, {
    roughness: 0.36,
    metalness: 0.19,
    side: T.DoubleSide,
  });
  const trim = paint("#20262a", { side: T.DoubleSide }),
    rubber = paint("#191c1e"),
    silver = paint("#b7c2c5", { metalness: 0.48, roughness: 0.34 });
  const window = paint("#2a414c", {
    metalness: 0.28,
    roughness: 0.19,
    side: T.DoubleSide,
  });
  const brake = paint("#be2028", {
    emissive: 0xc51a28,
    emissiveIntensity: 0.35,
  });
  const light = paint("#f7f2cc", {
    emissive: 0xd8e9ef,
    emissiveIntensity: 0.5,
  });
  const gold = paint("#ffa132", { emissive: 0xfd7000, emissiveIntensity: 0.2 });
  const wheels = [];
  const block = (mat, x, y, z, w, h, d) => box(body, mat, x, y, z, w, h, d);
  function cylinder(mat, x, y, z, r1, r2, height, axis = "y") {
    const mesh = solid(
      body,
      new T.CylinderGeometry(r1, r2, height, 24),
      mat,
      x,
      y,
      z,
    );
    if (axis === "z") mesh.rotation.x = Math.PI / 2;
    if (axis === "x") mesh.rotation.z = Math.PI / 2;
    return mesh;
  }
  function axle(z, r, track, steering = false) {
    for (const side of [-1, 1]) {
      const pivot = new T.Group(),
        wheel = new T.Group();
      root.add(pivot);
      pivot.add(wheel);
      pivot.position.set(side * track, r, z);
      const thickness = r * 0.68;
      function disc(rad, depth, x, mat) {
        const m = solid(
          wheel,
          new T.CylinderGeometry(rad, rad, depth, 24),
          mat,
          x,
          0,
          0,
        );
        m.rotation.z = Math.PI / 2;
      }
      disc(r, thickness, 0, rubber);
      const face = side * (thickness * 0.5 + 0.01);
      disc(r * 0.68, 0.023, face, silver);
      disc(r * 0.51, 0.028, face + side * 0.013, trim);
      for (let j = 0; j < 7; j++) {
        const a = (j * Math.PI * 2) / 7;
        const spoke = box(
          wheel,
          silver,
          face + side * 0.031,
          Math.cos(a) * r * 0.32,
          Math.sin(a) * r * 0.32,
          0.023,
          r * 0.61,
          r * 0.12,
        );
        spoke.rotation.x = a;
      }
      disc(r * 0.21, 0.07, face + side * 0.04, silver);
      wheels.push({ pivot, wheel, r, steering });
    }
  }
  function mirror(x, y, z) {
    const side = Math.sign(x);
    block(trim, x, y, z, 0.29, 0.055, 0.07);
    block(coat, x + side * 0.12, y + 0.06, z, 0.16, 0.16, 0.21);
    block(window, x + side * 0.12, y + 0.06, z + 0.111, 0.13, 0.13, 0.012);
  }
  function sport() {
    const air = !!spec.flying;
    if (air) {
      hull(
        body,
        [
          [-2.31, 0.29, 0.38, 0.46, 0.72, 0.6],
          [-1.95, 0.23, 0.51, 0.61, 0.98, 0.76],
          [-1.34, 0.2, 0.58, 0.69, 1.07, 0.84],
          [-0.48, 0.22, 0.54, 0.64, 0.99, 0.81],
          [0.46, 0.23, 0.56, 0.7, 1.02, 0.8],
          [1.37, 0.24, 0.71, 0.82, 1.08, 0.85],
          [1.91, 0.3, 0.73, 0.79, 1.01, 0.92],
          [2.19, 0.39, 0.7, 0.785, 0.91, 0.83],
        ],
        coat,
      );
      hull(
        body,
        [
          [-1.14, 0.62, 0.63, 0.65, 0.8, 0.76],
          [-0.38, 0.65, 1.05, 1.11, 0.83, 0.64],
          [0.37, 0.68, 1.03, 1.13, 0.82, 0.62],
          [0.87, 0.72, 0.9, 1.01, 0.77, 0.6],
          [1.43, 0.74, 0.79, 0.82, 0.68, 0.59],
        ],
        window,
      );
    } else {
      hull(
        body,
        [
          [-2.29, 0.26, 0.38, 0.45, 0.79, 0.66],
          [-1.85, 0.22, 0.53, 0.64, 1, 0.78],
          [-0.94, 0.22, 0.59, 0.68, 1.01, 0.83],
          [0.26, 0.22, 0.57, 0.64, 0.96, 0.81],
          [1.13, 0.24, 0.7, 0.8, 1.055, 0.85],
          [1.94, 0.28, 0.71, 0.73, 1, 0.85],
          [2.23, 0.32, 0.55, 0.62, 0.87, 0.77],
        ],
        coat,
      );
      hull(
        body,
        [
          [-1.08, 0.635, 0.65, 0.68, 0.83, 0.79],
          [-0.43, 0.65, 1.02, 1.11, 0.85, 0.67],
          [0.25, 0.66, 1.06, 1.17, 0.86, 0.69],
          [0.64, 0.67, 0.99, 1.07, 0.85, 0.7],
          [1.28, 0.73, 0.78, 0.81, 0.79, 0.69],
        ],
        window,
      );
    }
    for (const side of [-1, 1]) {
      mirror(side * 0.92, 0.77, -0.57);
      block(trim, side * 0.992, 0.32, -0.04, 0.07, 0.1, 1.66);
      const intake = block(trim, side * 0.991, 0.53, 0.61, 0.033, 0.19, 0.48);
      intake.rotation.x = -0.16;
      const lamp = block(light, side * 0.65, 0.482, -2.12, 0.37, 0.042, 0.14);
      lamp.rotation.y = -side * 0.24;
      if (!air) {
        const tail = block(brake, side * 0.66, 0.58, 2.185, 0.44, 0.062, 0.065);
        tail.rotation.y = side * 0.28;
        block(trim, side * 0.56, 0.77, 1.61, 0.065, 0.18, 0.12);
        const fin = block(coat, side * 0.94, 0.77, 1.16, 0.09, 0.14, 0.82);
        fin.rotation.x = 0.05;
      }
    }
    if (!air) {
      block(trim, 0, 0.422, 2.205, 1.65, 0.19, 0.08);
      block(trim, 0, 0.29, 2.11, 1.78, 0.1, 0.22);
      for (const x of [-0.7, -0.45, 0.45, 0.7])
        block(trim, x, 0.246, 2.12, 0.047, 0.15, 0.32);
      block(trim, 0, 0.88, 1.7, 1.92, 0.045, 0.21);
      for (const x of [-0.74, 0.74])
        cylinder(silver, x, 0.347, 2.22, 0.081, 0.09, 0.18, "z");
    } else {
      addRoadsterRear(body, coat, brake, spec.plate);
      for (const side of [-1, 1]) {
        const pillar = block(
          coat,
          side * 0.72,
          0.909,
          0.88,
          0.105,
          0.083,
          1.15,
        );
        pillar.rotation.x = 0.27;
        const shoulder = block(coat, side * 0.87, 0.752, 1.7, 0.17, 0.08, 0.61);
        shoulder.rotation.x = 0.12;
      }
      const nozzle = paint("#38414a", { metalness: 0.68, roughness: 0.39 });
      for (const x of [-0.86, 0.86])
        for (const z of [-1.36, 1.36]) {
          cylinder(trim, x, 0.295, z, 0.3, 0.25, 0.21);
          cylinder(silver, x, 0.193, z, 0.27, 0.24, 0.055);
          cylinder(nozzle, x, 0.157, z, 0.205, 0.18, 0.041);
        }
    }
    if (!air) numberPlate(body, spec.plate, 0.422, 2.261, 0.45);
    axle(-1.41, 0.323, 0.975, true);
    axle(1.38, 0.339, 0.98);
  }
  function bus() {
    hull(
      body,
      [
        [-4.62, 0.56, 1.32, 1.45, 0.86, 0.76],
        [-4.2, 0.57, 1.47, 1.59, 0.96, 0.86],
        [-3.33, 0.57, 1.48, 1.64, 1.03, 0.92],
      ],
      coat,
    );
    hull(
      body,
      [
        [-3.42, 0.64, 2.75, 2.96, 1.2, 1.1],
        [-3.13, 0.62, 2.88, 3.08, 1.24, 1.1],
        [4.23, 0.62, 2.88, 3.08, 1.24, 1.1],
        [4.55, 0.68, 2.77, 2.97, 1.19, 1.05],
      ],
      coat,
    );
    for (const z of [-2.54, 0.12, 2.83]) {
      block(trim, 0, 3.087, z, 0.73, 0.037, 0.74);
      block(coat, 0, 3.115, z, 0.68, 0.054, 0.69);
    }
    for (const side of [-1, 1])
      for (const x of [0.57, 0.81])
        block(coat, side * x, 3.087, 0.54, 0.032, 0.032, 7.18);
    block(window, 0, 2.14, -3.43, 2.25, 0.91, 0.025);
    block(trim, 0, 2.14, -3.45, 0.052, 0.92, 0.022);
    block(trim, 0, 1.13, -4.615, 1.02, 0.4, 0.04);
    for (let i = 0; i < 6; i++)
      block(silver, 0, 0.975 + i * 0.054, -4.645, 0.93, 0.019, 0.018);
    block(trim, 0, 0.59, -4.59, 2.17, 0.18, 0.18);
    block(trim, 0, 0.58, 4.56, 2.43, 0.2, 0.19);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const z = -2.85 + i * 0.81;
        block(trim, side * 1.245, 2.18, z, 0.022, 0.84, 0.75);
        block(window, side * 1.261, 2.18, z, 0.018, 0.76, 0.67);
        block(silver, side * 1.271, 2.22, z, 0.016, 0.026, 0.67);
      }
      for (const y of [0.94, 1.19, 1.55])
        block(trim, side * 1.247, y, 0.48, 0.045, 0.069, 7.52);
      block(window, side * 0.65, 2.14, 4.563, 0.83, 0.7, 0.022);
      for (const y of [1.02, 1.3])
        cylinder(brake, side * 1.01, y, 4.59, 0.096, 0.096, 0.04, "z");
      for (const [j, mat] of [
        [0, brake],
        [1, gold],
      ])
        cylinder(
          mat,
          side * (0.99 - j * 0.22),
          2.77,
          4.535,
          0.09,
          0.09,
          0.07,
          "z",
        );
      block(light, side * 0.71, 1.26, -4.622, 0.31, 0.17, 0.06);
      mirror(side * 1.3, 2.12, -3.21);
    }
    block(trim, 0, 1.67, 4.572, 0.94, 1.84, 0.025);
    block(coat, 0, 1.67, 4.59, 0.88, 1.77, 0.021);
    block(window, 0, 2.12, 4.606, 0.69, 0.65, 0.017);
    block(trim, 0.31, 1.51, 4.61, 0.12, 0.038, 0.02);
    label(body, "SCHOOL BUS", 1.17, 0.25, 0, 2.74, 4.57);
    const front = label(body, "SCHOOL BUS", 1.3, 0.24, 0, 2.8, -3.44);
    front.rotation.y = Math.PI;
    numberPlate(body, spec.plate, 0.84, 4.611, 0.51);
    axle(-3.1, 0.56, 1.095, true);
    axle(2.6, 0.56, 1.095);
  }
  function semi() {
    block(trim, 0, 0.61, 0.2, 1.04, 0.38, 6.82);
    hull(
      body,
      [
        [-3.73, 0.72, 1.54, 1.71, 0.84, 0.71],
        [-3.36, 0.7, 1.58, 1.78, 0.9, 0.77],
        [-1.56, 0.71, 1.73, 1.89, 0.96, 0.82],
      ],
      coat,
    );
    hull(
      body,
      [
        [-1.65, 0.78, 2.57, 2.74, 1.15, 0.99],
        [-1.22, 0.77, 2.87, 3.04, 1.19, 1.05],
        [0.15, 0.77, 2.88, 3.05, 1.19, 1.05],
        [0.45, 0.77, 3.18, 3.4, 1.19, 1.0],
        [1.26, 0.77, 3.18, 3.36, 1.17, 1],
      ],
      coat,
    );
    const wind = block(window, 0, 2.32, -1.65, 2.11, 0.59, 0.04);
    wind.rotation.x = 0.04;
    block(silver, 0, 1.23, -3.746, 1.26, 0.88, 0.08);
    block(trim, 0, 1.24, -3.796, 1.13, 0.77, 0.03);
    for (let i = 0; i < 12; i++)
      block(silver, -0.51 + i * 0.093, 1.24, -3.815, 0.035, 0.74, 0.021);
    block(silver, 0, 0.6, -3.71, 2.48, 0.26, 0.2);
    block(silver, 0, 0.91, 1.49, 1.64, 0.07, 0.51);
    for (const x of [-0.6, -0.3, 0, 0.3, 0.6])
      block(trim, x, 0.953, 1.5, 0.09, 0.012, 0.4);
    block(trim, 0, 2.31, 1.269, 1.03, 0.52, 0.031);
    block(window, 0, 2.31, 1.292, 0.94, 0.44, 0.021);
    for (const side of [-1, 1]) {
      block(silver, side * 0.85, 1.83, 1.284, 0.055, 1.54, 0.055);
      for (const y of [1.13, 2.51])
        block(trim, side * 0.85, y, 1.276, 0.1, 0.06, 0.09);
    }
    for (const [x, col] of [
      [-0.26, "#9a2921"],
      [0.01, "#494747"],
      [0.27, "#aa8535"],
    ]) {
      const points = [];
      for (let i = 0; i <= 50; i++) {
        const t = i / 50;
        points.push(
          new T.Vector3(
            x + Math.sin(t * Math.PI * 14) * 0.05,
            1.57 -
              0.38 * t -
              0.16 * Math.sin(Math.PI * t) +
              Math.cos(t * 14 * Math.PI) * 0.05,
            1.29 + t * 0.54,
          ),
        );
      }
      solid(
        body,
        new T.TubeGeometry(new T.CatmullRomCurve3(points), 58, 0.023, 6, false),
        paint(col),
      );
    }
    cylinder(trim, 0, 0.94, 2.12, 0.59, 0.65, 0.18);
    for (const side of [-1, 1]) {
      block(window, side * 1.197, 2.33, -0.8, 0.019, 0.65, 0.86);
      block(trim, side * 1.196, 2.4, 0.7, 0.021, 0.35, 0.46);
      cylinder(silver, side * 1.16, 0.68, 0.05, 0.3, 0.3, 1.47, "z");
      block(silver, side * 1.15, 0.86, -1.13, 0.34, 0.12, 0.65);
      cylinder(silver, side * 1.26, 2.09, 0.98, 0.095, 0.095, 2.53);
      cylinder(trim, side * 1.26, 3.36, 0.98, 0.075, 0.075, 0.012);
      block(coat, side * 1.04, 1.15, -2.76, 0.5, 0.19, 1.49);
      block(light, side * 0.97, 1.11, -3.52, 0.4, 0.17, 0.07);
      block(trim, side * 1.04, 1.16, 2.4, 0.51, 0.12, 2.28);
      block(rubber, side * 1.06, 0.65, 3.56, 0.49, 0.68, 0.06);
      mirror(side * 1.26, 2.25, -1.48);
    }
    for (let i = 0; i < 5; i++)
      block(gold, (i - 2) * 0.43, 2.81, -1.55, 0.11, 0.071, 0.07);
    block(silver, 0, 0.67, 3.71, 2.43, 0.23, 0.12);
    for (const side of [-1, 1])
      block(brake, side * 0.92, 0.69, 3.79, 0.41, 0.12, 0.025);
    numberPlate(body, spec.plate, 0.67, 3.783, 0.5);
    axle(-2.77, 0.56, 1.1, true);
    axle(1.78, 0.53, 1.12);
    axle(2.94, 0.53, 1.12);
  }
  if (spec.id === "bus") bus();
  else if (spec.id === "semi") semi();
  else {
    sport();
    if(spec.id==="u9"){
      const satin=paint("#a68747",{metalness:.69,roughness:.54});
      for(const side of [-1,1]){
        block(satin,side*.91,.34,-.25,.11,.08,2.9);
        block(satin,side*.68,.72,-1.03,.035,.025,.97);
        block(trim,side*.63,.91,1.74,.085,.49,.27);
      }
      block(trim,0,1.16,1.78,2.12,.065,.42);
      block(satin,0,1.20,1.94,2.12,.02,.045);
      block(trim,0,.78,-1.46,.6,.04,.51);
    }
    if(spec.id==="i8"){
      const blue=paint("#369dca");
      for(const side of [-1,1]){
        block(trim,side*.27,.44,-2.24,.44,.15,.045);
        block(blue,side*.27,.52,-2.25,.44,.024,.045);
        const blade=block(coat,side*.86,.83,.85,.12,.17,1.3); blade.rotation.x=.36;
        block(blue,side*.98,.35,.14,.08,.05,1.8);
        block(brake,side*.84,.64,2.14,.053,.21,.08);
      }
    }
  }
  return {
    root,
    update(state, roll, braking) {
      body.rotation.z =
        (state.bank??0) + state.steer * Math.min(0.05, Math.abs(state.speed) * 0.004);
      body.rotation.x=state.pitch??0;
      body.position.y=-(state.compression??0)*.09;
      for (const w of wheels) {
        w.wheel.rotation.x = (roll * 0.324) / w.r;
        if (w.steering) w.pivot.rotation.y = state.steer;
      }
      brake.emissiveIntensity = braking ? 1.8 : 0.35;
    },
  };
}

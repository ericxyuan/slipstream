import * as T from "three";
import { box, paint, solid, batchStatic, randomSource } from "./geometry.js";
import { road, addRoad, roadDistance, grainTexture } from "./road.js";

export function buildDesert(scene) {
  const props = new T.Group(),
    collisions = [],
    rand = randomSource(48163);
  scene.add(props);
  const loose = (scene.userData.roadside = []);
  function roadside(kind, x, z, size = 1, angle = 0) {
    loose.push({ kind, x, z, size, angle });
  }
  const terrain = paint("#cf9a6c", { map: grainTexture(224, 28, 58) });
  terrain.map.repeat.set(350, 350);
  const ground = solid(scene, new T.PlaneGeometry(2000, 2000), terrain);
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  addRoad(scene);
  const stone = paint(0xffffff, { vertexColors: true, flatShading: true });
  const strata = [
    "#bb825f",
    "#c78b68",
    "#ba7857",
    "#c9825b",
    "#c98b66",
    "#b67857",
    "#ca926d",
    "#cf9874",
    "#c18b64",
    "#dfaa80",
  ];
  function mesa(x, z, rx, rz, h, far = false) {
    const n = 18 + Math.floor(rand() * 8),
      theta = rand() * 6,
      shoulder = 0.68 + rand() * 0.13;
    const profile = [
      [0, 1.22],
      [0.13, 1.06],
      [0.23, 0.93],
      [0.28, 0.91],
      [0.32, 0.82],
      [0.48, 0.79],
      [0.52, 0.81],
      [0.56, 0.765],
      [0.82, shoulder],
      [0.88, shoulder - 0.04],
      [0.95, shoulder - 0.05],
      [1, shoulder - 0.12],
    ];
    const rim = Array.from({ length: n }, (_, i) => ({
      a: (i / n) * Math.PI * 2 + theta,
      s: 0.86 + rand() * 0.25,
      top: 0.95 + rand() * 0.07,
      tone: rand(),
    }));
    const rings = profile.map(([v, r]) =>
      rim.map(({ a, s, top }) => [
        Math.cos(a) * rx * s * r,
        h * v * (top + 0.035 * Math.sin(a * 2)),
        Math.sin(a) * rz * s * r,
      ]),
    );
    const pos = [],
      col = [];
    function triangle(a, b, c, color) {
      pos.push(...a, ...b, ...c);
      for (let k = 0; k < 3; k++) col.push(color.r, color.g, color.b);
    }
    for (let j = 0; j < rings.length - 1; j++)
      for (let i = 0; i < n; i++) {
        const next = (i + 1) % n,
          tone = 0.87 + rim[i].tone * 0.22 + rand() * 0.04;
        const color = new T.Color(
          strata[Math.min(j, strata.length - 1)],
        ).multiplyScalar(tone);
        const a = rings[j][i],
          b = rings[j + 1][i],
          c = rings[j][next],
          d = rings[j + 1][next];
        triangle(a, b, c, color);
        triangle(b, d, c, color);
      }
    const top = rings.at(-1);
    for (let i = 0; i < n; i++)
      triangle([0, h, 0], top[(i + 1) % n], top[i], new T.Color("#d39d70"));
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const m = solid(props, g, stone, x, -0.2, z);
    m.castShadow = false;
    if (!far)
      collisions.push({ x, z, rx: rx * 1.18, rz: rz * 1.18, height: h });
  }
  // Scattered buttes and broader stratified walls frame the driving area.
  for (let i = 0; i < 58; i++) {
    const a = (i / 58) * 2 * Math.PI,
      dist = 355 + rand() * 205;
    mesa(
      -24 + Math.cos(a) * dist,
      -50 + Math.sin(a) * dist,
      29 + rand() * 74,
      25 + rand() * 49,
      20 + rand() * 52,
      true,
    );
  }
  for (const a of [
    [-101, -88, 35, 24, 36],
    [-83, -103, 19, 17, 43],
    [-65, -107, 11, 13, 33],
    [-88, -68, 16, 15, 20],
    [94, -65, 25, 31, 47],
    [110, -93, 26, 25, 39],
    [73, -77, 10, 15, 22],
    [136, -58, 30, 37, 50],
    [-34, -172, 12, 13, 31],
    [-22, -177, 8, 9, 23],
    [-45, -180, 17, 19, 19],
    [25, -333, 75, 42, 63],
    [66, -320, 23, 23, 74],
    [86, -325, 18, 21, 54],
    [-203, 19, 31, 37, 36],
    [122, 65, 34, 36, 34],
    [-17, 204, 54, 27, 36],
  ])
    mesa(...a);
  const greens = ["#476044", "#596a44", "#697848"].map((c) =>
    paint(c, { flatShading: true }),
  );
  const rockMat = ["#996948", "#af7850", "#c18a61", "#c6986f"].map((c) =>
    paint(c, { flatShading: true }),
  );
  const grassMat = ["#93814d", "#b29962", "#796e42"].map((c) =>
    paint(c, { side: T.DoubleSide, flatShading: true }),
  );
  function rock(x, z, size) {
    const g = new T.IcosahedronGeometry(1, 0),
      m = solid(props, g, rockMat[Math.floor(rand() * 4)], x, 0.13 * size, z);
    m.rotation.set(rand(), rand() * 6, rand() * 0.7);
    m.scale.set(
      size * (0.9 + rand() * 0.6),
      size * (0.35 + rand() * 0.42),
      size,
    );
    if (size > 0.28 && size < 1.3 && roadDistance(x, z) < 24) {
      props.remove(m);
      g.dispose();
      roadside("rock", x, z, size);
      return;
    }
    if (size > 0.65)
      collisions.push({ x, z, rx: size * 1.18, rz: size, height: size });
  }
  function cactus(x, z, h) {
    const mat = greens[Math.floor(rand() * 3)],
      r = h * 0.055;
    const loosePlant = roadDistance(x, z) < 23;
    function limb(points, rad) {
      if (loosePlant) return;
      const curve = new T.CatmullRomCurve3(
        points.map((p) => new T.Vector3(...p)),
      );
      solid(props, new T.TubeGeometry(curve, 12, rad, 8, false), mat, x, 0, z);
      const tip = points.at(-1);
      const cap = solid(
        props,
        new T.SphereGeometry(rad, 8, 5),
        mat,
        x + tip[0],
        tip[1],
        z + tip[2],
      );
      cap.scale.y = 1.35;
    }
    limb(
      [
        [0, 0, 0],
        [0.01, h * 0.55, 0],
        [0.02, h, 0],
      ],
      r,
    );
    const ang = rand() * Math.PI * 0.5 - 0.7;
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1,
        dx = side * Math.cos(ang) * h * (0.17 + rand() * 0.1),
        dz = side * Math.sin(ang) * h * 0.17,
        y = h * (0.28 + rand() * 0.24);
      limb(
        [
          [0, y, 0],
          [dx * 0.66, y + 0.02, dz * 0.66],
          [dx, y + h * 0.08, dz],
          [dx * 1.02, y + h * (0.27 + rand() * 0.15), dz],
        ],
        r * 0.72,
      );
    }
    if (loosePlant) {
      roadside("plant", x, z, h);
      return;
    }
    collisions.push({ x, z, rx: r * 1.3, rz: r * 1.3, height: h });
  }
  function tuft(x, z, s) {
    const pos = [];
    for (let j = 0; j < 13; j++) {
      const a = rand() * Math.PI * 2,
        r = s * (0.3 + rand() * 0.85),
        bx = Math.cos(a) * s * 0.17,
        bz = Math.sin(a) * s * 0.17;
      pos.push(
        bx - 0.06 * s,
        0.014,
        bz - 0.05 * s,
        bx + 0.06 * s,
        0.014,
        bz + 0.05 * s,
        bx + Math.cos(a) * r,
        s * (0.24 + rand() * 0.8),
        bz + Math.sin(a) * r,
      );
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    solid(props, g, grassMat[Math.floor(rand() * 3)], x, 0, z);
  }
  for (let i = 0; i < 2200; i++) {
    const x = rand() * 490 - 250,
      z = rand() * 560 - 320;
    if (roadDistance(x, z) < 9.6) continue;
    if (i < 90) cactus(x, z, 1.4 + rand() * 3.8);
    else if (i < 560) rock(x, z, 0.15 + rand() ** 2 * 2.5);
    else tuft(x, z, 0.25 + rand() * 0.8);
  }
  // Fractured talus gathers beneath the closest cliff faces.
  for (const [cx, cz, rx, rz] of [
    [-83, -92, 32, 23],
    [100, -74, 32, 26],
    [-32, -175, 22, 16],
    [124, 65, 27, 32],
  ]) {
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2,
        d = 0.95 + rand() * 0.62;
      const x = cx + Math.cos(a) * rx * d,
        z = cz + Math.sin(a) * rz * d;
      if (roadDistance(x, z) > 11) rock(x, z, 0.5 + rand() ** 1.6 * 4.3);
    }
  }
  for (const [x, z, h] of [
    [-17, 0, 3.8],
    [16, -12, 4.6],
    [-23, -33, 2.8],
    [24, -53, 3.1],
    [29, 14, 2.3],
  ])
    cactus(x, z, h);
  const post = paint("#d6c9a9"),
    black = paint("#302d2b"),
    reflector = paint("#c58136");
  function marker(x, z) {
    if (Math.abs(z) < 55) {
      roadside("post", x, z);
      return;
    }
    box(props, post, x, 0.48, z, 0.105, 0.96, 0.12);
    box(props, black, x, 0.8, z, 0.11, 0.21, 0.126);
    box(props, reflector, x, 0.81, z + 0.066, 0.075, 0.055, 0.008);
  }
  for (let i = 0; i < 80; i++) {
    const t = i / 80,
      p = road.getPointAt(t),
      d = road.getTangentAt(t);
    for (const side of [-1, 1])
      marker(p.x - d.z * 8.7 * side, p.z + d.x * 8.7 * side);
  }
  // Diamond bend signs are visible from both directions.
  function sign(x, z, angle) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#282a29";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#efad39";
    ctx.fillRect(4, 4, 120, 120);
    ctx.translate(64, 64);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = "#292a26";
    ctx.beginPath();
    ctx.moveTo(-25, 32);
    ctx.lineTo(-14, -1);
    ctx.lineTo(7, -13);
    ctx.lineTo(1, -22);
    ctx.lineTo(28, -19);
    ctx.lineTo(19, 7);
    ctx.lineTo(13, -3);
    ctx.lineTo(-4, 7);
    ctx.lineTo(-10, 33);
    ctx.fill();
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    const obj = new T.Group();
    props.add(obj);
    obj.position.set(x, 0, z);
    obj.rotation.y = angle;
    box(obj, post, 0, 1.05, 0, 0.1, 2.1, 0.1);
    const panel = box(
      obj,
      paint("#fff", { map: tex }),
      0,
      2.08,
      0,
      0.86,
      0.86,
      0.065,
    );
    panel.rotation.z = Math.PI / 4;
    roadside("sign", x, z, 1, angle);
    props.remove(obj);
    obj.traverse((o) => o.geometry?.dispose());
    tex.dispose();
    panel.material.dispose();
  }
  sign(9.7, -15, 0.04);
  sign(-116, 62, Math.PI);
  batchStatic(props);
  return collisions;
}

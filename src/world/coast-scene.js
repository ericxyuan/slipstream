import { clearPosition, roadsideMargin } from "./clearance.js";
import * as T from "three";
import { batchStatic, box, paint, randomSource, solid } from "./geometry.js";
import { grainTexture } from "./road.js";
import {
  coastLoop,
  coastBranches,
  coastRoads,
  coastPools,
  coastSolids,
  clearOfCoast,
} from "./coast.js";

function ribbon(group, points, left, right, y, material, visible = () => true) {
  const pos = [],
    uv = [],
    indices = [];
  const loop = points === coastLoop;
  let distance = 0;
  points.forEach((p, i) => {
    const prev = points[i - 1] ?? (loop ? points.at(-2) : p);
    const next = points[i + 1] ?? (loop ? points[1] : p);
    const dx = next.x - prev.x,
      dz = next.z - prev.z,
      len = Math.hypot(dx, dz);
    if (i) distance += Math.hypot(p.x - prev.x, p.z - prev.z);
    for (const offset of [left, right]) {
      pos.push(p.x - (dz / len) * offset, y, p.z + (dx / len) * offset);
      uv.push(offset / 5, distance / 5);
    }
    if (i && visible(i)) {
      const k = i * 2;
      indices.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  });
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  solid(group, geo, material).castShadow = false;
}

function routeSign(group, name, p, next, branchPoint, post, board) {
  const dx = next.x - p.x,
    dz = next.z - p.z,
    len = Math.hypot(dx, dz);
  const sign = new T.Group();
  const offset = 8.7 + roadsideMargin + 3.3;
  const at = clearPosition(clearOfCoast, p.x - (dz / len) * offset, p.z + (dx / len) * offset, 3.2);
  sign.position.set(at.x, 0, at.z);
  sign.rotation.y = Math.atan2(-dx, -dz);
  group.add(sign);
  for (const x of [-2.1, 2.1]) box(sign, post, x, 1.6, 0, 0.17, 3.2, 0.17);
  box(sign, board, 0, 3.15, 0, 6.2, 1.6, 0.14);
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#185756";
  ctx.fillRect(0, 0, 768, 192);
  ctx.strokeStyle = "#dfe7ce";
  ctx.lineWidth = 5;
  ctx.strokeRect(8, 8, 752, 176);
  ctx.fillStyle = "#fff6de";
  ctx.font = "bold 67px sans-serif";
  ctx.textBaseline = "middle";
  const side =
    -dz * (branchPoint.x - next.x) + dx * (branchPoint.z - next.z) > 0
      ? "↗"
      : "↖";
  ctx.fillText(side + "  " + name, 27, 99, 710);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  solid(
    sign,
    new T.PlaneGeometry(6.1, 1.53),
    paint("white", { map }),
    0,
    3.15,
    0.08,
  );
}

export function buildCoast(group, course) {
  const rand = randomSource(71053);
  const asphalt = paint(
    course.format === "drag" ? "#52595b" : course.surface.color,
    { map: grainTexture(218, 34, 13) },
  );
  const shell = paint("#c9bd98"),
    white = paint("#f5efda"),
    gold = paint("#eec56d");
  const grass = paint("#9aab84", { map: grainTexture(232, 24, 340) });
  grass.map.repeat.set(100, 100);
  const slate = paint("#394f51"),
    red = paint("#be503a"),
    timber = paint("#84735e");
  const sea = paint("#4e9296"),
    foam = paint("#c2dcce"),
    mud = paint("#798c70");
  const reeds = [paint("#9e9b56"), paint("#b7ab71"), paint("#7c8a59")];
  const cylinder = (mat, x, y, z, top, base, h, n = 16) =>
    solid(group, new T.CylinderGeometry(top, base, h, n), mat, x, y, z);
  // The deep-water shoreline sits outside the driveable bounds. Shallow pools sit in the flats.
  box(group, sea, 0, -1.8, 0, 3000, 1, 3000);
  box(group, shell, -294, -0.81, 0, 1006, 1.45, 1040);
  box(group, grass, -300, -0.22, 0, 1004, 0.42, 1020);
  for (let i = 0; i < 210; i++) {
    const x = 214 + rand() * 560,
      z = rand() * 1100 - 550;
    box(group, foam, x, -1.26, z, 1 + rand() * 13, 0.025, 0.16 + rand() * 0.5);
  }
  // Low blades catch the light above the tideline; cluster them around the pools.
  function tussock(x, z, size) {
    const color = reeds[Math.floor(rand() * reeds.length)];
    for (let i = 0; i < 4; i++) {
      const angle = rand() * Math.PI * 2,
        h = size * (0.65 + rand() * 0.7);
      const blade = solid(
        group,
        new T.ConeGeometry(0.12 * size, h, 3),
        color,
        x + Math.cos(angle) * 0.25 * size,
        h * 0.45,
        z + Math.sin(angle) * 0.25 * size,
      );
      blade.rotation.z = Math.cos(angle) * 0.45;
      blade.rotation.x = Math.sin(angle) * 0.45;
    }
  }
  for (const [x, z, w, d] of coastPools) {
    const bank = cylinder(mud, x, 0, z, 1, 1, 0.04, 30);
    bank.scale.set(w + 2, 1, d + 2);
    cylinder(sea, x, 0.034, z, 1, 1, 0.025, 30).scale.set(w, 1, d);
    for (let i = 0; i < 22; i++) {
      const angle = rand() * Math.PI * 2;
      const px = x + Math.cos(angle) * w,
        pz = z + Math.sin(angle) * d;
      if (clearOfCoast(px, pz, 1.8)) tussock(px, pz, 1 + rand() * 0.8);
      const r = rand() * 0.8;
      box(
        group,
        foam,
        x + Math.cos(angle) * w * r,
        0.05,
        z + Math.sin(angle) * d * r,
        1 + rand() * 2.8,
        0.008,
        0.09,
      );
    }
  }
  for (const [r, points] of coastRoads.entries()) {
    const layer = r ? 0.002 : 0;
    ribbon(group, points, -8.7, 8.7, 0.009 + layer, shell);
    ribbon(group, points, -8, 8, 0.018 + layer, asphalt);
    // Leave paint gaps at the mouths so the through road doesn't stripe across the fork.
    const clear = (i) =>
      coastRoads.every(
        (other) =>
          other === points ||
          !other.some(
            (q) => Math.hypot(q.x - points[i].x, q.z - points[i].z) < 17,
          ),
      );
    for (const side of [-1, 1]) {
      ribbon(
        group,
        points,
        side * 7.5 - 0.09,
        side * 7.5 + 0.09,
        0.037,
        white,
        clear,
      );
    }
    ribbon(
      group,
      points,
      -0.1,
      0.1,
      0.038,
      r ? white : gold,
      (i) => i % 4 < 2 && clear(i),
    );
  }
  for (const b of coastBranches) {
    routeSign(
      group,
      b.name,
      coastLoop[b.start - 4],
      coastLoop[b.start],
      b.points[6],
      timber,
      slate,
    );
    routeSign(
      group,
      b.name,
      coastLoop[b.end + 4],
      coastLoop[b.end],
      b.points.at(-7),
      timber,
      slate,
    );
  }

  const pointRoad = coastBranches[0].points;
  for (let i = 7; i < pointRoad.length - 6; i += 3) {
    const p = pointRoad[i],
      q = pointRoad[i + 1],
      len = Math.hypot(q.x - p.x, q.z - p.z);
    const x = p.x - ((q.z - p.z) / len) * (9.1 + roadsideMargin),
      z = p.z + ((q.x - p.x) / len) * (9.1 + roadsideMargin);
    if (!clearOfCoast(x, z, 0.21)) continue;
    box(group, white, x, 0.82, z, 0.27, 1.64, 0.27);
    box(group, red, x, 1.22, z, 0.29, 0.3, 0.29);
  }
  const [tower, ...buildings] = coastSolids;
  const { x, z } = tower;
  cylinder(slate, x, 0.45, z, 5.1, 5.6, 0.9);
  for (let i = 0; i < 5; i++)
    cylinder(
      i % 2 ? red : white,
      x,
      0.9 + (i + 0.5) * 4.8,
      z,
      4.3 - (i + 1) * 0.35,
      4.3 - i * 0.35,
      4.8,
      24,
    );
  cylinder(slate, x, 25.2, z, 3.8, 3.1, 0.6, 24);
  cylinder(
    paint("#ffe5a0", { emissive: "#f6bc57", emissiveIntensity: 0.65 }),
    x,
    27.35,
    z,
    2.5,
    2.5,
    3.7,
    12,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    cylinder(
      slate,
      x + 2.54 * Math.cos(a),
      27.35,
      z + 2.54 * Math.sin(a),
      0.13,
      0.13,
      3.7,
      6,
    );
  }
  cylinder(red, x, 30.7, z, 0.2, 3.45, 3.15);
  cylinder(slate, x, 32.6, z, 0.06, 0.13, 1.1);
  for (const [i, b] of buildings.entries()) {
    box(
      group,
      i === 0 ? white : i === 3 ? timber : paint("#9ab9b5"),
      b.x,
      (b.height - 1.6) / 2,
      b.z,
      2 * b.rx,
      b.height - 1.6,
      2 * b.rz,
    );
    const roof = solid(
      group,
      new T.ConeGeometry(1, 1.8, 4),
      i === 0 ? red : slate,
      b.x,
      b.height - 0.7,
      b.z,
    );
    roof.geometry.rotateY(Math.PI / 4);
    roof.scale.set((b.rx + 0.5) * Math.SQRT2, 1, (b.rz + 0.5) * Math.SQRT2);
    for (const side of [-1, 1])
      box(
        group,
        slate,
        b.x + side * b.rx * 0.5,
        b.height * 0.5,
        b.z + b.rz + 0.03,
        1.3,
        1.2,
        0.1,
      );
  }
  for (const x of [-18, 3])
    for (let k = 0; k < 4; k++) {
      const pile = solid(
        group,
        new T.ConeGeometry(2 + rand() * 0.6, 1.9, 9),
        white,
        x - 5 + k * 3,
        0.92,
        -197,
      );
      pile.scale.z = 0.75;
      const safe = clearPosition(clearOfCoast, pile.position.x, pile.position.z, 2.6);
      pile.position.set(safe.x, pile.position.y, safe.z);
    }

  // Fescue clumps and distant island silhouettes give scale between junctions.
  for (let i = 0; i < 260; i++) {
    const x = rand() * 410 - 210,
      z = rand() * 430 - 245;
    if (!clearOfCoast(x, z, 1.4)) continue;
    tussock(x, z, 0.65 + rand() * 0.65);
  }
  for (let i = 0; i < 16; i++) {
    const rock = solid(
      group,
      new T.IcosahedronGeometry(1, 0),
      slate,
      340 + rand() * 350,
      -3,
      rand() * 680 - 390,
    );
    rock.scale.set(12 + rand() * 34, 4 + rand() * 9, 15 + rand() * 28);
  }
  for (let i = 0; i < 5; i++) {
    const x = 395 + i * 24,
      z = -310 + i * 102,
      h = 35 + (i % 3) * 3;
    cylinder(white, x, h / 2 - 1, z, 0.8, 1.75, h);
    for (let j = 0; j < 3; j++) {
      const a = (j * 2 * Math.PI) / 3 + i;
      const blade = box(
        group,
        white,
        x - 8 * Math.sin(a),
        h - 1 + 8 * Math.cos(a),
        z + 1.1,
        1.1,
        16,
        0.35,
      );
      blade.rotation.z = a;
    }
  }
  batchStatic(group);
  return coastSolids;
}

import { classes } from "../vehicle/classes.js";
import { courseLayout, courses, surfaces } from "./courses.js";
export const formats = {
  free: "Free drive",
  circuit: "Circuit",
  sprint: "Sprint",
  drag: "Drag",
  trial: "Time trial",
};
export const defaults = {
  route: "main",
  vehicleClass: "all",
  map: "desert",
  format: "free",
  surface: "original",
  collision: "ghost",
  laps: 1,
  dnf: 30,
  players: 8,
  rules: "authentic",
  reverse: false,
  start: 0,
  end: 100,
  checkpoints: 8,
  distance: 402,
  countdown: 3,
  sections: "prepared,gravel,wet",
};
export function eventOptions(map, format, surface, multiplayer) {
  const racing = format !== "free", drag = format === "drag", sky = map === "sky";
  return {
    surface: !sky, sections: !sky && surface === "custom",
    route: racing && !drag && map !== "coast" && map !== "drag" && (map === "city" || format !== "circuit"),
    reverse: racing, distance: drag || map === "drag",
    start: racing && !drag, end: ["sprint", "trial"].includes(format),
    checkpoints: racing && !drag, laps: format === "circuit",
    vehicleClass: !sky, rules: racing, players: multiplayer,
    collision: multiplayer, dnf: racing && multiplayer, countdown: racing,
  };
}
export function validate(raw = {}) {
  const c = { ...defaults, ...raw };
  if (
    !Object.hasOwn(courses, c.map) ||
    !Object.hasOwn(classes, c.vehicleClass) ||
    !Object.hasOwn(formats, c.format) ||
    !["original", "mixed", "custom", ...Object.keys(surfaces)].includes(
      c.surface,
    ) ||
    !["real", "ghost"].includes(c.collision) ||
    !["balanced", "authentic"].includes(c.rules)
  )
    throw Error("Choose a valid map, format and rule set.");
  for (const [key, min, max] of [
    ["laps", 1, 99],
    ["dnf", 0, 3600],
    ["players", 1, 12],
    ["start", 0, 90],
    ["end", 10, 100],
    ["checkpoints", c.format === "drag" ? 1 : 2, 32],
    ["countdown", 1, 15],
  ]) {
    if (!Number.isInteger(c[key]) || c[key] < min || c[key] > max)
      throw Error("Invalid " + key + ".");
  }
  if (!Number.isSafeInteger(c.distance) || c.distance < 1)
    throw Error("Enter a positive whole distance in metres.");
  if (c.format === "drag") Object.assign(c, { start: 0, end: 100, route: "main", checkpoints: 1 });
  if (c.format === "circuit") c.end = 100;
  if (!["main", "short", "outer"].includes(c.route))
    throw Error("Unknown route preset.");
  if (c.end <= c.start) throw Error("Finish must follow the start.");
  if (
    typeof c.sections !== "string" ||
    c.sections.length > 300 ||
    c.sections.split(",").some((key) => !Object.hasOwn(surfaces, key.trim()))
  )
    throw Error("Use valid surface names for custom sections.");
  if (c.map === "sky" && ["original", "heavy"].includes(c.vehicleClass))
    throw Error("Skyway requires a flight-capable Roadster.");
  c.reverse = c.reverse === true;
  if (c.map === "coast") c.route = "main";
  if (c.format !== "circuit") c.laps = 1;
  return c;
}
export function makeCourse(raw, count = 1, lane = 0) {
  const config = validate(raw),
    { map, format } = config;
  const c = courseLayout(map, config.distance);
  const stripWidth = Math.max(12, count * 4.5 + 3);
  if (map === "city") c.bounds = [-166, 286, -286, 246];
  if (format === "drag" || map === "drag") {
    // Keep the straight clear of permanent scenery, including a twelve-car grid.
    const x = { city: 320, coast: 280, desert: 275, drag: 0, sky: 0 }[map];
    c.stripX = x;
    c.length = config.distance;
    c.lanes = count;
    c.stripWidth = stripWidth;
    const edge = map === "sky" ? Math.max(40, stripWidth / 2) : stripWidth / 2;
    c.bounds = [x - edge, x + edge, -c.length - 100, 100];
  }
  let p = c.points.map((v) => ({ ...v, y: v.y ?? 0 }));
  const network = [...p];
  if (map === "desert" || map === "coast") p.pop();
  if (map === "city" && config.route !== "main") {
    const coords =
      config.route === "outer"
        ? [
            [0, 80],
            [0, -200],
            [200, -200],
            [200, 160],
            [0, 160],
          ]
        : [
            [0, 0],
            [0, -60],
            [60, -60],
            [60, 0],
          ];
    p = coords.map(([x, z]) => ({ x, y: 0, z }));
  } else if (config.route === "short" && format !== "circuit")
    p = p.slice(0, Math.max(2, Math.ceil(p.length * 0.62)));
  if (map === "sky") p[0].y = 8;
  if (format === "drag" && map !== "drag") {
    const x = c.stripX, y = map === "sky" ? 8 : 0;
    p = [{ x, y, z: 0 }, { x, y, z: -c.length }];
    c.points = p;
  } else if (format === "circuit" && !c.closed) {
    p = [
      ...p,
      ...p
        .slice()
        .reverse()
        .map((v) => ({ ...v, x: v.x + (map === "drag" ? 4 : 24) })),
    ];
  }
  if (config.reverse) p.reverse();
  if ((c.closed && format !== "drag") || format === "circuit")
    p.push({ ...p[0] });
  const lengths = [0];
  for (let i = 1; i < p.length; i++)
    lengths.push(
      lengths[i - 1] + Math.hypot(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z),
    );
  const full = lengths.at(-1);
  function at(d) {
    d = Math.max(0, Math.min(full, d));
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] < d) i++;
    const a = p[i - 1],
      b = p[i],
      span = lengths[i] - lengths[i - 1] || 1,
      t = (d - lengths[i - 1]) / span;
    const gate = {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
      dx: (b.x - a.x) / span,
      dz: (b.z - a.z) / span,
      radius: map === "sky" && format !== "drag" ? 6 : Math.max(9, stripWidth / 2 + 1),
    };
    if (a.alternate && b.alternate) {
      const u = a.alternate, v = b.alternate;
      const len = Math.hypot(v.x - u.x, v.z - u.z);
      gate.alternate = { x: u.x + (v.x - u.x)*t, y: 0, z: u.z + (v.z - u.z)*t,
        dx: (v.x - u.x)/len, dz: (v.z - u.z)/len, radius: gate.radius };
    }
    return gate;
  }
  const from = (full * config.start) / 100,
    distance = format === "circuit" ? full : (full * config.end) / 100 - from;
  function sample(t) {
    const d = from + distance * t;
    return at(d > full ? d - full : d);
  }
  const route = [
    sample(0),
    ...p.flatMap((v, i) =>
      lengths[i] > from && lengths[i] < Math.min(full, from + distance)
        ? [v]
        : [],
    ),
    ...(from + distance > full ? p.filter((v, i) => lengths[i] < from) : []),
    sample(1),
  ];
  const matrix =
    format === "drag" ? count : Math.min(count, 2);
  const direction = at(from + 0.001);
  const a = { ...sample(0), dx: direction.dx, dz: direction.dz },
    offset =
      ((lane % matrix) - (matrix - 1) / 2) * (format === "drag" ? 4.5 : 3.2);
  const back =
    format === "free"
      ? Math.floor(lane / matrix) * 11
      : 0.35 + Math.floor(lane / matrix) * 11;
  const spawn = {
    x: a.x - a.dz * offset - a.dx * back,
    z: a.z + a.dx * offset - a.dz * back,
    heading: Math.atan2(-a.dx, -a.dz),
    altitude: a.y,
  };
  const surface =
    surfaces[config.surface] ??
    surfaces[map === "drag" ? "prepared" : "asphalt"];
  const palette =
    config.surface === "mixed"
      ? ["asphalt", "gravel", "wet"]
      : config.sections.split(",").map((k) => k.trim());
  const cuts = [0, 1];
  let traversed = 0;
  for (let i = 1; i < route.length; i++) {
    traversed += Math.hypot(
      route[i].x - route[i - 1].x,
      route[i].z - route[i - 1].z,
    );
    cuts.push(Math.min(1, traversed / distance));
  }
  const segmented = ["mixed", "custom"].includes(config.surface);
  if (segmented)
    for (let i = 1; i < palette.length; i++) cuts.push(i / palette.length);
  const sorted = [...new Set(cuts)].sort((a, b) => a - b),
    sections = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] < 1e-7) continue;
    const mid = (sorted[i] + sorted[i - 1]) / 2;
    const section = {
      a: sample(sorted[i - 1]),
      b: sample(sorted[i]),
      surface: segmented
        ? surfaces[
            palette[
              Math.min(palette.length - 1, Math.floor(mid * palette.length))
            ]
          ]
        : surface,
    };
    sections.push(section);
    if (section.a.alternate && section.b.alternate)
      sections.push({ a: section.a.alternate, b: section.b.alternate, surface: section.surface });
  }
  return {
    ...c,
    config,
    network,
    route,
    sections: segmented ? sections : null,
    paintSections: sections,
    startLine: a,
    surface,
    routeLength: distance,
    format,
    type: formats[format],
    closed: format === "circuit",
    spawn: format === "free" && map === "desert" ? undefined : spawn,
    gates:
      format === "free"
        ? []
        : Array.from(
            { length: format === "drag" ? 1 : config.checkpoints },
            (_, i) =>
              sample((i + 1) / (format === "drag" ? 1 : config.checkpoints)),
          ),
  };
}

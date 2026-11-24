import { streetsX, streetsZ, roadWidth } from "../world/city.js";
const SVG = "http://www.w3.org/2000/svg";
function element(tag, attributes, parent) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attributes)) el.setAttribute(k, v);
  parent.append(el);
  return el;
}
export class Minimap {
  constructor(svg) {
    this.svg = svg;
    this.zoom = Number(localStorage.getItem("slipstream.zoom")) || 1;
    this.last = 0;
  }
  configure(course, obstacles) {
    const svg = this.svg;
    svg.replaceChildren();
    svg.setAttribute("aria-label", course.name + " route and vehicle position");
    const xs = course.points.map((p) => p.x),
      zs = course.points.map((p) => p.z);
    const size =
      Math.max(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...zs) - Math.min(...zs),
        60,
      ) * 1.24;
    const bounds =
      course.id === "desert"
        ? { x: -267, z: -333, w: 530, h: 570 }
        : {
            x: (Math.min(...xs) + Math.max(...xs) - size) / 2,
            z: (Math.min(...zs) + Math.max(...zs) - size) / 2,
            w: size,
            h: size,
          };
    svg.setAttribute(
      "viewBox",
      [bounds.x, bounds.z, bounds.w, bounds.h].join(" "),
    );
    const ridges = element("g", { class: "map-ridges" }, svg);
    for (const o of obstacles) {
      if (o.rx < 8 || o.rz < 8) continue;
      if (o.rectangle) {
        element(
          "rect",
          {
            x: o.x - o.rx,
            y: o.z - o.rz,
            width: 2 * o.rx,
            height: 2 * o.rz,
            "stroke-width": 0.8,
          },
          ridges,
        );
        continue;
      }
      for (const scale of [1, 0.72])
        element(
          "ellipse",
          { cx: o.x, cy: o.z, rx: o.rx * scale, ry: o.rz * scale },
          ridges,
        );
    }
    const path = (pts) =>
      pts
        .map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.z.toFixed(1))
        .join(" ");
    if (course.id === "city") {
      for (const x of streetsX)
        element(
          "path",
          {
            d: "M" + x + " -280V240",
            stroke: "#a8b1b799",
            "stroke-width": roadWidth("x", x) * 0.59,
          },
          svg,
        );
      for (const z of streetsZ)
        element(
          "path",
          {
            d: "M-160 " + z + "H280",
            stroke: "#a8b1b799",
            "stroke-width": roadWidth("z", z) * 0.59,
          },
          svg,
        );
    } else
      element(
        "path",
        {
          d: path(course.network ?? course.points),
          class: "map-road",
          style: "stroke-width:6",
        },
        svg,
      );
    for (const branch of course.branches ?? [])
      element("path", { d: path(branch.points), class: "map-road", style: "stroke-width:6" }, svg);
    if (course.format !== "free")
      element(
        "path",
        {
          d: path(course.route ?? course.points),
          stroke: "#7ce8c5",
          "stroke-width": 2,
        },
        svg,
      );
    for (const g of course.gates.flatMap(g => g.alternate ? [g, g.alternate] : [g]))
      element("circle", { cx: g.x, cy: g.z, r: 1.7, fill: "#eee" }, svg);
    if (course.format !== "free" && course.startLine) {
      for (const [g, color] of [
        [course.startLine, "#ffdf91"],
        [course.gates.at(-1), "white"],
      ]) {
        element(
          "line",
          {
            x1: g.x - g.dz * 5,
            y1: g.z + g.dx * 5,
            x2: g.x + g.dz * 5,
            y2: g.z - g.dx * 5,
            stroke: color,
            "stroke-width": 2.1,
          },
          svg,
        );
      }
    }
    this.goal = element("circle", { r: 3.2, fill: "#87ffd2" }, svg);
    this.peers = element("g", {}, svg);
    this.peerDots = new Map();
    this.scale = 0.19;
    this.marker = element("g", { class: "map-marker" }, svg);
    element("circle", { r: 31, class: "marker-halo" }, this.marker);
    element("path", { d: "M0 -23 L16 16 L0 9 L-16 16 Z" }, this.marker);
  }
  target(gate) {
    this.goal.style.display = gate ? "" : "none";
    if (gate) {
      this.goal.setAttribute("cx", gate.x);
      this.goal.setAttribute("cy", gate.z);
    }
  }
  update(s) {
    const now = performance.now();
    if (now - this.last < 40) return;
    this.last = now;
    const span = (115 + Math.min(s.groundSpeed, 80) * 1.5) * this.zoom;
    this.svg.setAttribute(
      "viewBox",
      [s.x - span / 2, s.z - span / 2, span, span].join(" "),
    );
    this.scale = span / 590;
    const ids = new Set();
    for (const p of this.players ?? []) {
      ids.add(p.id);
      let dot = this.peerDots.get(p.id);
      if (!dot) {
        dot = element("circle", { fill: p.color, r: 2.5 }, this.peers);
        this.peerDots.set(p.id, dot);
      }
      dot.setAttribute("cx", p.state.x);
      dot.setAttribute("cy", p.state.z);
    }
    for (const [id, dot] of this.peerDots)
      if (!ids.has(id)) {
        dot.remove();
        this.peerDots.delete(id);
      }

    this.marker.setAttribute(
      "transform",
      `translate(${s.x.toFixed(2)} ${s.z.toFixed(2)}) rotate(${((-s.heading * 180) / Math.PI).toFixed(1)}) scale(${this.scale})`,
    );
  }
}

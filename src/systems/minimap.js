const SVG = "http://www.w3.org/2000/svg";
function element(tag, attributes, parent) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attributes)) el.setAttribute(k, v);
  parent.append(el);
  return el;
}
export class Minimap {
  constructor(svg) { this.svg = svg; }
  configure(course, obstacles) {
    const svg = this.svg;
    svg.replaceChildren();
    svg.setAttribute("aria-label", course.name + " route and vehicle position");
    const xs = course.points.map(p => p.x), zs = course.points.map(p => p.z);
    const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 60) * 1.24;
    const bounds = course.id === "desert" ? { x: -267, z: -333, w: 530, h: 570 } : { x: (Math.min(...xs) + Math.max(...xs) - size) / 2,
      z: (Math.min(...zs) + Math.max(...zs) - size) / 2, w: size, h: size };
    svg.setAttribute(
      "viewBox",
      [bounds.x, bounds.z, bounds.w, bounds.h].join(" "),
    );
    const ridges = element("g", { class: "map-ridges" }, svg);
    for (const o of obstacles) {
      if (o.rx < 8 || o.rz < 8) continue;
      if (o.rectangle) {
        element("rect", { x: o.x - o.rx, y: o.z - o.rz, width: 2 * o.rx, height: 2 * o.rz, "stroke-width": 0.8 }, ridges);
        continue;
      }
      for (const scale of [1, 0.72])
        element(
          "ellipse",
          { cx: o.x, cy: o.z, rx: o.rx * scale, ry: o.rz * scale },
          ridges,
        );
    }
    const path =
      course.points
        .map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.z.toFixed(1))
        .join(" ") + (course.closed ? "Z" : "");
    element("path", { d: path, class: "map-road", style: "stroke-width:" + size * 0.016 }, svg);
    this.goal = element("circle", { r: size * 0.027, fill: "#85f4cc" }, svg);
    this.scale = size / 550;
    this.marker = element("g", { class: "map-marker" }, svg);
    element("circle", { r: 31, class: "marker-halo" }, this.marker);
    element("path", { d: "M0 -23 L16 16 L0 9 L-16 16 Z" }, this.marker);
  }
  target(gate) {
    this.goal.style.display = gate ? "" : "none";
    if (gate) { this.goal.setAttribute("cx", gate.x); this.goal.setAttribute("cy", gate.z); }
  }
  update(s) {
    this.marker.setAttribute(
      "transform",
      `translate(${s.x.toFixed(2)} ${s.z.toFixed(2)}) rotate(${((-s.heading * 180) / Math.PI).toFixed(1)}) scale(${this.scale})`,
    );
  }
}

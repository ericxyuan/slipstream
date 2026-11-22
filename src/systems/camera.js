import * as T from "three";
const modes = [
  {
    name: "Chase",
    offset: [-1.23, 2.53, 6.65],
    target: [0.41, 0.89, -4.8],
    fov: 54,
  },
  { name: "Wide chase", offset: [0, 5.3, 10.8], target: [0, 0.8, -5], fov: 57 },
  { name: "Bonnet", offset: [0, 1.28, -0.59], target: [0, 1.04, -25], fov: 68 },
];
export class CameraRig {
  constructor(obstacles) {
    this.camera = new T.PerspectiveCamera(54, 1, 0.065, 1500);
    this.obstacles = obstacles;
    this.index = 0;
    this.aim = new T.Vector3();
    this.pos = new T.Vector3();
    this.target = new T.Vector3();
    this.anchor = new T.Vector3();
    this.up = new T.Vector3(0, 1, 0);
  }
  configure(spec) {
    this.spec = spec;
  }
  cycle() {
    this.index = (this.index + 1) % modes.length;
    return modes[this.index].name;
  }
  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  update(s, dt, snap = false) {
    const mode = modes[this.index],
      inside = this.index === 2,
      aspect = this.camera.aspect;
    this.anchor.set(s.x, s.altitude, s.z);
    this.pos.fromArray(mode.offset);
    this.target.fromArray(mode.target);
    if (inside) {
      this.pos.y = this.spec.bonnet[0];
      this.pos.z = this.spec.bonnet[1];
      this.target.y = this.pos.y - 0.24;
    } else {
      this.pos.z +=
        (this.spec.length - 4.1) * 1.02 + (this.spec.height - 1.28) * 0.85;
      if (this.index === 0) {
        this.pos.x -= (this.spec.length - 4.1) * 0.56;
        this.target.x += (this.spec.length - 4.1) * 0.14;
      }
      this.pos.y += (this.spec.height - 1.28) * 1.1;
      this.target.y += (this.spec.height - 1.28) * 0.78;
    }
    if (aspect < 1 && !inside) this.pos.z += 2;
    this.pos.applyAxisAngle(this.up, s.heading).add(this.anchor);
    this.target.applyAxisAngle(this.up, s.heading).add(this.anchor);
    const k = snap || inside ? 1 : 1 - Math.exp(-dt * 8);
    this.camera.position.lerp(this.pos, k);
    this.aim.lerp(this.target, snap || inside ? 1 : 1 - Math.exp(-dt * 12));
    if (!inside) {
      // Shorten the chase arm when the sight line crosses solid scenery.
      const p = this.camera.position,
        dx = p.x - s.x,
        dz = p.z - s.z;
      let limit = 1;
      for (const o of this.obstacles) {
        if (s.altitude > (o.height ?? Infinity) + 0.1) continue;
        if (Math.abs(s.x - o.x) > o.rx + 23 || Math.abs(s.z - o.z) > o.rz + 23)
          continue;
        const x = (s.x - o.x) / (o.rx + 0.17),
          z = (s.z - o.z) / (o.rz + 0.17),
          vx = dx / (o.rx + 0.17),
          vz = dz / (o.rz + 0.17);
        const a = vx * vx + vz * vz,
          b = x * vx + z * vz,
          c = x * x + z * z - 1,
          disc = b * b - a * c;
        if (a < 0.00001 || disc < 0 || b >= 0 || c <= 0) continue;
        const hit = (-b - Math.sqrt(disc)) / a;
        if (hit >= 0 && hit < limit) limit = Math.max(0.04, hit - 0.04);
      }
      if (limit < 1) {
        p.x = s.x + dx * limit;
        p.z = s.z + dz * limit;
        p.y = Math.max(s.altitude + this.spec.height + 0.4, p.y);
      }
    }
    this.camera.lookAt(this.aim);
    const fov = mode.fov + Math.min(4, Math.abs(s.speed) * 0.12);
    if (Math.abs(this.camera.fov - fov) > 0.03) {
      this.camera.fov +=
        (fov - this.camera.fov) * (snap ? 1 : 1 - Math.exp(-dt * 7));
      this.camera.updateProjectionMatrix();
    }
  }
}

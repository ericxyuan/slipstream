import { vehicles } from "./catalog.js";

// Metres, seconds, Y up. A heading of zero faces -Z, positive yaw turns left.
export const STEP = 1 / 120;
export const SPAWN = {
  x: 3.55,
  z: 20,
  heading: 0,
  speed: 0,
  steer: 0,
  throttle: 0,
  brake: 0,
  altitude: 0,
  verticalSpeed: 0,
  steeringInput: 0,
  rearThrust: 0,
  sideThrust: 0,
  airborne: 0,
  groundSpeed: 0,
  wheelSlip: 0,
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (t) => t * t * (3 - 2 * t);
const approach = (value, target, step) =>
  value + clamp(target - value, -step, step);
const damp = (value, target, rate, dt) =>
  value + (target - value) * -Math.expm1(-rate * dt);
export function gear(speed) {
  if (Math.abs(speed) < 0.22) return "N";
  return speed < 0 ? "R" : String(Math.min(6, 1 + Math.floor(speed / 8.4)));
}
export class VehiclePhysics {
  constructor(obstacles) {
    this.obstacles = obstacles;
    this.configure(vehicles[0]);
    this.reset();
  }
  configure(spec) {
    this.spec = spec;
    this.radius = spec.width / 2;
    const end = spec.length / 2 - this.radius,
      count = Math.ceil(end / this.radius) * 2 + 1;
    this.offsets = Array.from(
      { length: count },
      (_, i) => -end + (i * 2 * end) / (count - 1),
    );
    if (spec.flying)
      this.hoverTarget = Math.max(0.85, this.state?.altitude ?? 0);
  }
  setCourse(course, obstacles) {
    this.course = course;
    this.obstacles = obstacles;
    this.reset();
  }
  reset() {
    const spawn = { ...SPAWN, ...this.course?.spawn };
    this.spinSpeed = 0;
    this.hoverTarget = this.spec.flying ? Math.max(0.85, spawn.altitude) : 0;
    this.state = { ...spawn };
    this.previous = { ...spawn };
    this.pedal = 0;
    this.brakePedal = 0;
    this.yawRate = 0;
    this.vx = 0;
    this.vz = 0;
    this.reverseDelay = 0;
    this.roll = 0;
    this.previousRoll = 0;
  }
  stage(input, dt) {
    const target = input.forward && !input.back && !input.handbrake ? 1 : 0;
    this.pedal = approach(
      this.pedal,
      target,
      dt / this.spec.handling.pedalTime,
    );
    this.previous.throttle = this.state.throttle;
    this.state.throttle = ease(this.pedal);
  }
  updateLift(input, dt) {
    const s = this.state;
    if (this.spec.flying && this.course?.id !== "drag") {
      const lift = Number(!!input.rise) - Number(!!input.lower);
      this.hoverTarget = clamp(
        this.hoverTarget + lift * 4.5 * dt,
        this.course?.id === "sky" ? 2 : 0,
        18,
      );
    } else this.hoverTarget = 0;
    // A damped altitude servo eases in, arrests the climb on release and flares on touchdown.
    const error = this.hoverTarget - s.altitude;
    const acceleration = clamp(16 * error - 8 * s.verticalSpeed, -9, 9);
    s.verticalSpeed += acceleration * dt;
    s.altitude = clamp(s.altitude + s.verticalSpeed * dt, 0, 18);
    if (Math.abs(error) < 0.015 && Math.abs(s.verticalSpeed) < 0.07) {
      s.altitude = this.hoverTarget;
      s.verticalSpeed = 0;
    }
    s.airborne = this.spec.flying ? ease(clamp(s.altitude / 0.32, 0, 1)) : 0;
  }
  step(input, dt = STEP) {
    const s = this.state,
      h = this.spec.handling;
    Object.assign(this.previous, s);
    this.previousRoll = this.roll;
    this.updateLift(input, dt);
    const fwdX = -Math.sin(s.heading),
      fwdZ = -Math.cos(s.heading);
    let speed = this.vx * fwdX + this.vz * fwdZ;
    const lateral = this.vx * -fwdZ + this.vz * fwdX;
    const direction = Number(!!input.forward) - Number(!!input.back);
    const opposing = direction * speed < -0.22;
    const braking =
      opposing || input.handbrake || (input.forward && input.back);
    if (opposing) this.reverseDelay = 0.15;
    else
      this.reverseDelay =
        direction === 0 ? 0 : Math.max(0, this.reverseDelay - dt);
    const target = braking || this.reverseDelay > 0 ? 0 : direction;
    this.pedal = approach(
      this.pedal,
      target,
      dt / (target ? h.pedalTime : h.pedalTime * 0.55),
    );
    this.brakePedal = approach(
      this.brakePedal,
      braking ? 1 : 0,
      dt / (braking ? h.brakeTime : h.brakeTime * 0.9),
    );
    s.throttle = ease(Math.abs(this.pedal));
    s.brake = ease(this.brakePedal);
    const drive = Math.sign(this.pedal) * s.throttle * (1 - s.brake);
    const steering = Number(!!input.left) - Number(!!input.right);
    s.steeringInput = damp(
      s.steeringInput,
      steering,
      h.steerResponse * (steering ? 1 : 1.35),
      dt,
    );
    const lock = Math.min(
      h.steeringLock,
      Math.atan(
        ((this.course?.surface?.grip ?? 1) *
          h.cornering *
          this.spec.wheelbase) /
          (speed * speed + 0.01),
      ),
    );
    s.steer = s.steeringInput * lock * (1 - s.airborne);
    const roadYaw =
      ((Math.tan(s.steer) * speed) / this.spec.wheelbase) *
      (input.handbrake ? 1.18 : 1);
    // Opposed side ports apply a yaw couple. Counter-thrust settles the nose on release.
    const desiredYaw = s.steeringInput * 0.94;
    const yawDrag = 0.9,
      jetAuthority = 2.82;
    s.sideThrust =
      s.airborne *
      clamp(
        (3 * (desiredYaw - this.yawRate) + yawDrag * this.yawRate) /
          jetAuthority,
        -1,
        1,
      );
    const groundRate = damp(this.yawRate, roadYaw, h.steerResponse, dt);
    this.yawRate +=
      (groundRate - this.yawRate) * (1 - s.airborne) +
      (jetAuthority * s.sideThrust - yawDrag * this.yawRate * s.airborne) * dt;
    s.heading += this.yawRate * dt;
    const fX = -Math.sin(s.heading),
      fZ = -Math.cos(s.heading);
    const maxSpeed = drive < 0 ? h.reverseLimit : h.limit;
    const powerCurve = Math.max(
      0,
      1 - Math.pow(Math.max(0, speed * Math.sign(drive)) / maxSpeed, 1.35),
    );
    const demand =
      drive * (drive < 0 ? h.launch * 0.52 : h.launch) * powerCurve;
    const surface = this.course?.surface;
    const traction = surface?.traction ?? Infinity;
    const motor = clamp(demand, -traction, traction);
    // Excess drive spins the tyres. Grip and tyre relaxation bring their tread
    // speed back towards road speed as the available traction catches up.
    this.spinSpeed *= Math.exp(-3 * dt);
    this.spinSpeed += (demand - motor) * 4 * dt;
    const treadSpeed = speed + this.spinSpeed;
    s.wheelSlip =
      Math.abs(this.spinSpeed) /
      Math.max(1, Math.abs(treadSpeed), Math.abs(speed));
    const resistance =
      h.coast * (1 - s.throttle) +
      h.drag * speed * speed +
      Math.min(h.braking, traction) * s.brake;
    const roadSpeed = approach(speed, 0, resistance * dt) + motor * dt;
    const slip =
      lateral *
      Math.exp(-(input.handbrake ? 1.9 : h.grip) * (surface?.grip ?? 1) * dt);
    const roadVX = fX * roadSpeed - fZ * slip,
      roadVZ = fZ * roadSpeed + fX * slip;

    // In the air, thrust changes the world-space velocity vector. Turning the nose
    // alone does not rotate the stored momentum or drive the wheels.
    s.rearThrust = Math.max(0, drive) * s.airborne * powerCurve;
    const jetAcceleration =
      13.5 * s.rearThrust + Math.min(0, drive) * 5 * s.airborne * powerCurve;
    const magnitude = Math.hypot(this.vx, this.vz);
    const airLoss =
      magnitude > 0
        ? Math.max(
            0,
            1 - dt * (0.075 + 0.0007 * magnitude + (8 * s.brake) / magnitude),
          )
        : 1;
    const airVX = this.vx * airLoss + fX * jetAcceleration * dt,
      airVZ = this.vz * airLoss + fZ * jetAcceleration * dt;
    this.vx = roadVX + (airVX - roadVX) * s.airborne;
    this.vz = roadVZ + (airVZ - roadVZ) * s.airborne;
    s.x += this.vx * dt;
    s.z += this.vz * dt;
    for (const o of this.obstacles) {
      if (
        Math.abs(s.x - o.x) > o.rx + this.spec.length / 2 + 0.5 ||
        Math.abs(s.z - o.z) > o.rz + this.spec.length / 2 + 0.5
      )
        continue;
      if (s.altitude > (o.height ?? Infinity) + 0.1) continue;
      for (const offset of this.offsets) {
        const dx = s.x + fX * offset - o.x,
          dz = s.z + fZ * offset - o.z,
          a = o.rx + this.radius,
          b = o.rz + this.radius;
        let nx, nz, penetration;
        if (o.rectangle) {
          const gx = dx - clamp(dx, -o.rx, o.rx),
            gz = dz - clamp(dz, -o.rz, o.rz);
          const distance = Math.hypot(gx, gz);
          if (distance >= this.radius) continue;
          if (distance > 0) {
            nx = gx / distance;
            nz = gz / distance;
            penetration = this.radius - distance;
          } else if (a - Math.abs(dx) < b - Math.abs(dz)) {
            nx = Math.sign(dx) || 1;
            nz = 0;
            penetration = a - Math.abs(dx);
          } else {
            nx = 0;
            nz = Math.sign(dz) || 1;
            penetration = b - Math.abs(dz);
          }
        } else {
          const d = Math.hypot(dx / a, dz / b);
          if (d >= 1) continue;
          const gx = dx / (a * a),
            gz = dz / (b * b),
            gl = Math.hypot(gx, gz);
          nx = gl ? gx / gl : 1;
          nz = gl ? gz / gl : 0;
          penetration = d > 1e-7 ? ((1 - d) * d) / gl : Math.min(a, b);
        }
        s.x += nx * penetration;
        s.z += nz * penetration;
        const impact = this.vx * nx + this.vz * nz;
        if (impact < 0) {
          this.vx -= 1.07 * impact * nx;
          this.vz -= 1.07 * impact * nz;
        }
      }
    }
    const [left, right, near, far] = this.course?.bounds ?? [
      -250, 235, -315, 215,
    ];
    const x = clamp(s.x, left, right),
      z = clamp(s.z, near, far);
    if (x !== s.x) this.vx = 0;
    if (z !== s.z) this.vz = 0;
    s.x = x;
    s.z = z;
    s.speed = this.vx * fX + this.vz * fZ;
    s.groundSpeed = Math.hypot(this.vx, this.vz);
    this.roll -= (((s.speed + this.spinSpeed) * dt) / 0.324) * (1 - s.airborne);
  }
  sample(alpha, target) {
    for (const key of Object.keys(SPAWN))
      target[key] =
        this.previous[key] + (this.state[key] - this.previous[key]) * alpha;
    return this.previousRoll + (this.roll - this.previousRoll) * alpha;
  }
}

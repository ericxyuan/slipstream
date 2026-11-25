import { accelerationMagnitude, MAX_REGEN } from "./telemetry.js";
import { wheelDrive } from "./powertrain.js";
import { surfaceAt } from "../world/surfaces.js";
import { lift, flight } from "./lift.js";
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
  support: 1,
  mode: 0,
  acceleration: 0,
  verticalAccel: 0,
  lateralAccel: 0,
  peakAccel: 0,
  regen: 0,
  regenPower: 0,
  energy: 0,
  battery: 0.75,
  boost: 0,
  engineLoad: 0,
  pitch: 0,
  bank: 0,
  compression: 0,
  impact: 0,
  wheelSlip: 0,
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (t) => t * t * (3 - 2 * t);
const approach = (value, target, step) =>
  value + clamp(target - value, -step, step);
const damp = (value, target, rate, dt) =>
  value + (target - value) * -Math.expm1(-rate * dt);
export function roadYawLimit(handling, speed, grip) {
  const fraction = clamp((Math.abs(speed) * 3.6 - 45) / 155, 0, 1);
  return handling.turnRate * (1 - 0.175 * ease(fraction)) * grip;
}
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
    if (spec.flying) this.hoverTarget = Math.max(0, this.state?.altitude ?? 0);
  }
  setCourse(course, obstacles) {
    this.course = course;
    this.obstacles = obstacles;
    this.reset();
  }
  reset() {
    const spawn = { ...SPAWN, ...this.course?.spawn };
    this.spinSpeed = 0;
    this.hoverTarget = this.spec.flying ? Math.max(0, spawn.altitude) : 0;
    this.state = { ...spawn };
    this.previous = { ...spawn };
    this.pedal = 0;
    this.brakePedal = 0;
    this.yawRate = 0;
    this.vx = 0;
    this.vz = 0;
    this.cooldown = 0;
    this.jumpHeld = false;
    this.preload = 0;
    this.reverseDelay = 0;
    this.roll = 0;
    this.previousRoll = 0;
  }
  step(input, dt = STEP) {
    const s = this.state,
      h = this.spec.handling;
    Object.assign(this.previous, s);
    this.previousRoll = this.roll;
    lift(this, input, dt);
    const surface = surfaceAt(this.course, s.x, s.z);
    const flying = !!(this.spec.flying && s.airborne);
    const previousVX = this.vx,
      previousVZ = this.vz;
    s.impact = 0;
    s.boost = damp(s.boost, input.boost && input.forward ? 1 : 0, 9, dt);
    const boost = 1 + s.boost * (this.spec.mass > 5000 ? 0.29 : 0.19);
    const balanced = this.course?.config?.rules === "balanced";
    s.verticalAccel = (s.verticalSpeed - this.previous.verticalSpeed) / dt;
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
    const steering = input.steer ?? (Number(!!input.left) - Number(!!input.right));
    s.steeringInput = damp(
      s.steeringInput,
      steering,
      h.steerResponse * (steering ? 1 : 1.35),
      dt,
    );
    // Between 45 and 200 km/h, ease out up to 17.5% of each car's road yaw.
    // This takes about 8 degrees off a half-second sports coupe turn on asphalt.
    const curvature = s.steeringInput * Math.min(
      Math.tan(h.steeringLock) / this.spec.wheelbase,
      roadYawLimit(h, speed, surface?.grip ?? 1) / Math.max(0.01, Math.abs(speed)),
    );
    s.steer = Math.atan(curvature * this.spec.wheelbase) * (1 - s.airborne);
    const roadYaw = curvature * speed * (input.handbrake ? 1.18 : 1);
    // Opposed side ports apply a yaw couple. Counter-thrust settles the nose on release.
    const desiredYaw = s.steeringInput * flight.yaw;
    const yawDrag = 0.9,
      jetAuthority = flight.side;
    s.sideThrust =
      Number(flying) *
      clamp(
        (flight.control * (desiredYaw - this.yawRate) +
          yawDrag * this.yawRate) /
          jetAuthority,
        -1,
        1,
      );
    const groundRate = damp(this.yawRate, roadYaw, h.steerResponse * 1.8, dt);
    this.yawRate +=
      (groundRate - this.yawRate) * (1 - s.airborne) +
      (jetAuthority * s.sideThrust - yawDrag * this.yawRate * s.airborne) * dt;
    s.heading += this.yawRate * dt;
    const fX = -Math.sin(s.heading),
      fZ = -Math.cos(s.heading);
    const maxSpeed =
      (drive < 0
        ? h.reverseLimit
        : flying
          ? flight.speed
          : balanced
            ? 75
            : h.limit) * boost;
    const powerCurve = Math.max(
      0,
      1 - Math.pow(Math.max(0, speed * Math.sign(drive)) / maxSpeed, 2),
    );
    const demand =
      drive *
      (drive < 0 ? h.launch * 0.52 : balanced ? 10 : h.launch) *
      powerCurve *
      boost;

    const traction =
      (surface?.traction ?? Infinity) *
      (this.spec.id === "rally" && surface?.grip < 0.7 ? 1.35 : 1);
    const motor = s.airborne
      ? 0
      : wheelDrive(
          this.spec,
          demand,
          traction * Math.max(0.05, s.support),
          s,
          s.steeringInput,
        );
    // Excess drive spins the tyres. Grip and tyre relaxation bring their tread
    // speed back towards road speed as the available traction catches up.
    this.spinSpeed *= Math.exp(-3 * dt);
    this.spinSpeed += (demand - motor) * 4 * dt * (1 - s.airborne);
    if (s.airborne) this.spinSpeed = 0;
    const treadSpeed = speed + this.spinSpeed;
    s.wheelSlip =
      Math.abs(this.spinSpeed) /
      Math.max(1, Math.abs(treadSpeed), Math.abs(speed));
    const regenLimit =
      s.battery < 0.999 && this.spec.electric && !s.airborne
        ? Math.min(traction, Math.abs(speed) / dt, Math.abs(speed) * 0.9)
        : 0;
    s.regen = Math.min(regenLimit, (1 - s.throttle) * (1.5 + (MAX_REGEN - 1.5) * s.brake));
    s.regenPower = (s.regen * this.spec.mass * Math.abs(speed) * 0.75) / 1000;
    const recovered = s.regenPower * dt / 3600;
    s.energy += recovered;
    if (this.spec.electric) {
      const electricShare = this.spec.hybrid ? 1 - s.engineLoad * 0.65 : 1;
      const propulsiveForce =
        s.airborne && flying
          ? flight.drive * Math.max(0, drive)
          : Math.abs(motor);
      const used =
        (propulsiveForce *
          this.spec.mass *
          Math.abs(speed) *
          dt *
          electricShare) /
        (0.91 * 3600000);
      s.battery = clamp(
        s.battery + (recovered - used) / this.spec.batteryKWh,
        0,
        1,
      );
    }
    const rolling = this.spec.electric ? 0.045 : h.coast;
    const resistance =
      rolling * (surface?.rolling ?? 1) * (1 - s.throttle) +
      s.regen +
      (1 - s.throttle) * h.drag * speed * speed +
      Math.max(0, Math.min(h.braking, traction) * s.brake - s.regen * s.brake);
    const roadSpeed = approach(speed, 0, resistance * dt) + motor * dt;
    const slip =
      lateral *
      Math.exp(-(input.handbrake ? 1.9 : h.grip) * (surface?.grip ?? 1) * dt);
    const roadVX = fX * roadSpeed - fZ * slip,
      roadVZ = fZ * roadSpeed + fX * slip;

    // In the air, thrust changes the world-space velocity vector. Turning the nose
    // alone does not rotate the stored momentum or drive the wheels.
    s.rearThrust = Math.max(0, drive) * Number(flying) * powerCurve;
    const jetAcceleration =
      flight.drive * boost * s.rearThrust +
      Math.min(0, drive) * 9 * Number(flying) * powerCurve;
    const magnitude = Math.hypot(this.vx, this.vz);
    const airLoss =
      magnitude > 0
        ? Math.max(
            0,
            1 -
              dt *
                ((flying ? 0.12 : 0.005) * (1 - s.throttle) +
                  (flying ? flight.brake * s.brake : 0) / magnitude),
          )
        : 1;
    const sideLoss = flying
      ? lateral * (1 - Math.exp(-flight.damping * dt))
      : 0;
    const airVX = this.vx * airLoss + fX * jetAcceleration * dt + fZ * sideLoss,
      airVZ = this.vz * airLoss + fZ * jetAcceleration * dt - fX * sideLoss;
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
      if (s.altitude + this.spec.height < (o.minY ?? 0)) continue;
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
          s.impact = Math.max(s.impact, -impact);
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
    s.acceleration =
      ((this.vx - previousVX) * fX + (this.vz - previousVZ) * fZ) / dt;
    s.lateralAccel =
      (-(this.vx - previousVX) * fZ + (this.vz - previousVZ) * fX) / dt;
    s.peakAccel = Math.max(s.peakAccel, accelerationMagnitude(s));
    s.pitch = damp(
      s.pitch,
      flying ? (-s.verticalSpeed / flight.climb) * flight.pitch : 0,
      flight.control,
      dt,
    );
    s.bank = damp(
      s.bank,
      flying ? -s.steeringInput * flight.bank : 0,
      flight.control,
      dt,
    );
    this.roll -= (((s.speed + this.spinSpeed) * dt) / 0.324) * (1 - s.airborne);
  }
  sample(alpha, target) {
    for (const key of Object.keys(SPAWN))
      target[key] =
        this.previous[key] + (this.state[key] - this.previous[key]) * alpha;
    return this.previousRoll + (this.roll - this.previousRoll) * alpha;
  }
}

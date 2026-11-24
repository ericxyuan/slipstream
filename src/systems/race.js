import { accelerationMagnitude } from "../vehicle/telemetry.js";
import { crossing } from "../world/courses.js";

export const terminal = (phase) =>
  ["finished", "dnf", "false-start"].includes(phase);
export class Race {
  constructor(course) {
    this.course = course;
    this.phase =
      course.format === "free" || (!course.format && course.id === "desert")
        ? "free"
        : "ready";
    this.duration = course.config?.countdown ?? 3;
    this.countdown = this.duration;
    this.clock = 0;
    this.green = null;
    this.elapsed = 0;
    this.next = 0;
    this.lap = 1;
    this.completedLaps = 0;
    this.reaction = null;
    this.lineTime = null;
    this.maxSpeed = 0;
    this.maxAccel = 0;
    this.meanAccel = 0;
    this.accelDuration = 0;
    this.maxSlip = 0;
    this.finishSpeed = 0;
  }
  start(now = this.clock) {
    if (this.phase === "ready") {
      this.green = now + this.duration;
      this.phase = "countdown";
    }
  }
  cancel() {
    if (this.phase === "countdown") {
      this.phase = "ready";
      this.green = null;
      this.countdown = this.duration;
    }
  }
  step(car, input, dt, now = this.clock + dt) {
    this.clock = now;
    if (this.phase === "free") return car.step(input, dt);
    if (this.phase === "countdown") {
      this.countdown = Math.max(0, this.green - now);
      if (this.countdown > 1e-8) {
        if (input.forward || input.boost || input.jump || input.rise) {
          this.phase = "false-start";
          this.reaction = now - this.green;
        }
        return;
      }
      this.phase = "running";
    }
    if (this.phase !== "running") return;
    const beforeTime = Math.max(0, now - dt - this.green);
    if (this.reaction === null && input.forward) this.reaction = beforeTime;
    car.step(input, dt);
    const a = car.previous,
      b = car.state;
    if (this.lineTime === null && this.course.startLine) {
      const line = this.course.startLine,
        fraction = crossing(
          { ...line, radius: Math.max(line.radius, 35) },
          a,
          b,
          false,
        );
      if (fraction !== null) this.lineTime = beforeTime + fraction * dt;
    }
    const f = crossing(
      this.course.gates[this.next],
      a,
      b,
      this.course.id === "sky",
    );
    this.elapsed = Math.max(0, now - this.green);
    const acceleration = accelerationMagnitude(b);
    const finalGate = this.next === this.course.gates.length - 1 && this.lap === (this.course.config?.laps ?? 1);
    const measured = Math.max(0, (finalGate && f !== null ? beforeTime + f * dt : this.elapsed) - beforeTime);
    if (measured > 0 && Number.isFinite(acceleration)) {
      this.maxAccel = Math.max(this.maxAccel, acceleration);
      this.accelDuration += measured;
      this.meanAccel += (acceleration - this.meanAccel) * measured / this.accelDuration;
    }
    this.maxSpeed = Math.max(this.maxSpeed, b.groundSpeed);
    this.maxSlip = Math.max(this.maxSlip, b.wheelSlip);
    if (f === null) return;
    if (++this.next < this.course.gates.length) return;
    this.completedLaps++;
    if (this.lap < (this.course.config?.laps ?? 1)) {
      this.lap++;
      this.next = 0;
      return;
    }
    this.elapsed = beforeTime + f * dt;
    this.finishSpeed = a.groundSpeed + (b.groundSpeed - a.groundSpeed) * f;
    this.phase = "finished";
  }
  result() {
    return Object.fromEntries(
      [
        "phase",
        "elapsed",
        "reaction",
        "lineTime",
        "next",
        "lap",
        "completedLaps",
        "maxSpeed",
        "maxAccel",
        "meanAccel",
        "accelDuration",
        "finishSpeed",
        "maxSlip",
        "green",
        "countdown",
      ].map((k) => [k, this[k]]),
    );
  }
}

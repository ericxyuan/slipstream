import { crossing } from "../world/courses.js";

export class Race {
  constructor(course) {
    this.course = course;
    this.phase = course.id === "desert" ? "free" : "ready";
    this.countdown = 3;
    this.elapsed = 0;
    this.next = 0;
    this.reaction = null;
    this.staged = false;
    this.maxSpeed = 0;
    this.maxAccel = 0;
    this.maxSlip = 0;
  }
  start() {
    if (this.phase === "ready") this.phase = "countdown";
  }
  step(car, input, dt) {
    if (this.phase === "free") return car.step(input, dt);
    if (this.phase === "countdown") {
      if (this.course.id === "drag") {
        car.stage(input, dt);
        this.staged = !!input.forward && !input.back && !input.handbrake;
      }
      this.countdown -= dt;
      if (this.countdown < 1e-8) this.phase = "running";
      return;
    }
    if (this.phase !== "running") return;
    if (this.reaction === null) {
      if (input.forward && !input.back && !input.handbrake) this.reaction = this.elapsed;
      else if (this.course.id === "drag") {
        this.staged = false;
        car.stage({}, dt);
        this.elapsed += dt;
        return;
      }
    }
    car.step(input, dt);
    const before = car.previous, after = car.state;
    const fraction = crossing(this.course.gates[this.next], before, after, this.course.id === "sky");
    if (fraction !== null) this.next++;
    const finished = this.next === this.course.gates.length;
    const used = finished ? fraction : 1;
    this.elapsed += dt * used;
    const gain = after.groundSpeed - before.groundSpeed;
    this.maxAccel = Math.max(this.maxAccel, gain / dt);
    this.maxSpeed = Math.max(this.maxSpeed, before.groundSpeed + gain * used);
    this.maxSlip = Math.max(this.maxSlip, after.wheelSlip);
    if (finished) this.phase = "finished";
  }
}

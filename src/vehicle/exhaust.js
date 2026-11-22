import * as T from "three";
import { randomSource } from "../world/geometry.js";

import { rearPorts, liftPorts, steeringPorts } from "./ports.js";
const capacity = 672;
const vertexShader = `
attribute vec4 puff;
attribute float seed;
varying vec2 local;
varying float opacity;
varying float phase;
void main(){
  local=position.xy*2.;
  phase=seed;
  opacity=puff.w;
  vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
  float a=seed*6.28+puff.z*.55;
  vec2 offset=mat2(cos(a),-sin(a),sin(a),cos(a))*local*puff.xy;
  center.xy+=offset;
  gl_Position=projectionMatrix*center;
}`;
const fragmentShader = `
varying vec2 local;
varying float opacity;
varying float phase;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
 vec2 i=floor(p),t=fract(p);t=t*t*(3.-2.*t);
 return mix(mix(hash(i),hash(i+vec2(1,0)),t.x),mix(hash(i+vec2(0,1)),hash(i+1.),t.x),t.y);
}
void main(){
 vec2 q=local*2.6+phase*31.;
 float grain=.59*noise(q)+.29*noise(2.4*q)+.12*noise(5.7*q);
 float radius=length(local)+(grain-.5)*.61;
 float alpha=(1.-smoothstep(.16,1.,radius))*(.48+grain*.52)*opacity;
 if(alpha<.007)discard;
 gl_FragColor=vec4(mix(vec3(.78,.84,.88),vec3(1.),grain),alpha);
 #include <colorspace_fragment>
}`;

// Emit in world space so gas keeps drifting from its release point during turns.
export class GasExhaust {
  constructor(scene) {
    this.rand = randomSource(4019);
    const geometry = new T.PlaneGeometry(1, 1);
    this.puffs = new T.InstancedBufferAttribute(
      new Float32Array(capacity * 4),
      4,
    ).setUsage(T.DynamicDrawUsage);
    this.seeds = new T.InstancedBufferAttribute(
      new Float32Array(capacity),
      1,
    ).setUsage(T.DynamicDrawUsage);
    geometry.setAttribute("puff", this.puffs);
    geometry.setAttribute("seed", this.seeds);
    this.mesh = new T.InstancedMesh(
      geometry,
      new T.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
      }),
      capacity,
    );
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    this.pool = Array.from({ length: capacity }, () => ({
      age: Infinity,
      life: 1,
    }));
    this.matrix = new T.Matrix4();
    this.cursor = 0;
    this.rearPhase = 0;
    this.liftPhase = 0;
    this.sidePhase = 0;
    this.lastX = null;
    this.lastZ = 0;
  }
  clear() {
    for (const p of this.pool) p.age = Infinity;
    this.mesh.count = 0;
    this.lastX = null;
    this.rearPhase = 0;
    this.liftPhase = 0;
    this.sidePhase = 0;
  }
  emit(s, port, pressure, vx, vz) {
    const { x, y, z, dx, dy, dz } = port,
      jet = dy === 0;
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % capacity;
    const sin = Math.sin(s.heading),
      cos = Math.cos(s.heading),
      rand = this.rand;
    const flow = (jet ? 13 : 8) * (0.55 + 0.65 * pressure);
    p.x = s.x + x * cos + z * sin;
    p.y = s.altitude + y + 0.04;
    p.z = s.z - x * sin + z * cos;
    p.vx = vx + (dx * cos + dz * sin) * flow + (rand() - 0.5) * 1.6;
    p.vz = vz + (-dx * sin + dz * cos) * flow + (rand() - 0.5) * 1.6;
    p.vy = s.verticalSpeed + dy * flow + (rand() - 0.5) * 0.55;
    p.radialX = x * cos + z * sin;
    p.radialZ = -x * sin + z * cos;
    p.age = 0;
    p.life = (jet ? 0.45 : 0.66) + rand() * 0.18;
    p.seed = rand();
    p.jet = jet;
    p.pressure = pressure;
    p.grounded = false;
  }
  update(active, s, dt) {
    if (
      this.lastX !== null &&
      Math.hypot(s.x - this.lastX, s.z - this.lastZ) > 8
    )
      this.clear();
    const vx = dt > 0 && this.lastX !== null ? (s.x - this.lastX) / dt : 0;
    const vz = dt > 0 && this.lastX !== null ? (s.z - this.lastZ) / dt : 0;
    this.lastX = s.x;
    this.lastZ = s.z;
    if (active) {
      const lift =
        s.airborne * Math.max(0.22, Math.min(1, 0.57 + s.verticalSpeed * 0.09));
      this.rearPhase += dt * 99 * s.rearThrust;
      this.liftPhase += dt * 54 * lift;
      while (this.rearPhase >= 1) {
        this.rearPhase--;
        for (const port of rearPorts) this.emit(s, port, s.rearThrust, vx, vz);
      }
      while (this.liftPhase >= 1) {
        this.liftPhase--;
        for (const port of liftPorts) this.emit(s, port, lift, vx, vz);
      }
      this.sidePhase += dt * 90 * Math.abs(s.sideThrust);
      while (this.sidePhase >= 1) {
        this.sidePhase--;
        for (const port of steeringPorts) {
          if (port.turn === Math.sign(s.sideThrust))
            this.emit(s, port, Math.abs(s.sideThrust), vx, vz);
        }
      }
    }
    let count = 0;
    for (const p of this.pool) {
      if (p.age >= p.life) continue;
      p.age += dt;
      const t = Math.min(1, p.age / p.life);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.09 && !p.grounded) {
        p.grounded = true;
        p.vx += p.radialX * 1.7;
        p.vz += p.radialZ * 1.7;
        p.vy = 0.25;
      }
      p.y = Math.max(0.09, p.y);
      const drag = Math.exp(-2.2 * dt);
      p.vx *= drag;
      p.vz *= drag;
      p.vy = p.vy * drag + 0.75 * dt;
      const size = (p.jet ? 0.095 : 0.082) + t * (p.jet ? 0.78 : 0.86);
      this.matrix.makeTranslation(p.x, p.y, p.z);
      this.mesh.setMatrixAt(count, this.matrix);
      const alpha =
        (1 - t) ** 1.6 * (p.jet ? 0.77 : 0.46) * (0.65 + 0.35 * p.pressure);
      this.puffs.setXYZW(
        count,
        size * (p.grounded ? 1.35 : 1),
        size * (p.grounded ? 0.45 : 0.91),
        t,
        alpha,
      );
      this.seeds.setX(count, p.seed);
      count++;
    }
    this.mesh.visible = count > 0;
    this.mesh.count = count;
    if (count) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.puffs.needsUpdate = true;
      this.seeds.needsUpdate = true;
    }
  }
}

import * as T from "three";
import { createCar } from "../vehicle/model.js";
import { buildVariant } from "../vehicle/variants.js";
export class GaragePreview {
  constructor(canvas) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.scene = new T.Scene();
    this.scene.add(new T.HemisphereLight(0xffffff, 0xa6acbd, 2.2));
    const sun = new T.DirectionalLight(0xffeee0, 2.6);
    sun.position.set(-3, 5, 2);
    this.scene.add(sun);
    this.camera = new T.PerspectiveCamera(35, 2, 0.05, 80);
    this.angle = 0.75;
    this.canvas = canvas;
    canvas.onpointerdown = (e) => canvas.setPointerCapture(e.pointerId);
    canvas.onpointermove = (e) => {
      if (canvas.hasPointerCapture(e.pointerId)) {
        this.angle += e.movementX * 0.014;
        this.draw();
      }
    };
    this.resize = new ResizeObserver(() => this.draw());
    this.resize.observe(canvas);
  }
  select(v) {
    this.clear();
    this.model = (v.id === "rally" ? createCar(v) : buildVariant(v)).root;
    this.scene.add(this.model);
    this.spec = v;
    this.draw();
  }
  draw() {
    if (!this.spec) return;
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const r = this.spec.length * 1.42;
    this.camera.position.set(
      Math.sin(this.angle) * r,
      this.spec.height * 0.8 + r * 0.29,
      Math.cos(this.angle) * r,
    );
    this.camera.lookAt(0, this.spec.height * 0.4, 0);
    this.renderer.render(this.scene, this.camera);
  }
  clear() {
    if (!this.model) return;
    this.scene.remove(this.model);
    const mats = new Set();
    this.model.traverse((m) => {
      m.geometry?.dispose();
      if (m.material) mats.add(m.material);
    });
    for (const m of mats) {
      m.map?.dispose();
      m.dispose();
    }
  }
  dispose() {
    this.resize.disconnect();
    this.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

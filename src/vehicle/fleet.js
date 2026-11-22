import {
  vehicles,
  rememberVehicle,
  restoreVehicle,
  restoreRotation,
} from "./catalog.js";
import { createCar } from "./model.js";
import { buildVariant } from "./variants.js";
import { GasExhaust } from "./exhaust.js";
import { Assembly } from "./assembly.js";

export class Fleet {
  constructor(scene, onChange) {
    this.scene = scene;
    this.onChange = onChange;
    this.models = new Map();
    this.rotation = restoreRotation();
    this.index = restoreVehicle();
    this.select(this.index, false).level = 1;
  }
  select(index, save = true) {
    this.index = index;
    const spec = vehicles[index];
    if (spec.flying && !this.exhaust) this.exhaust = new GasExhaust(this.scene);
    if (!this.models.has(index)) {
      const model = spec.id === "rally" ? createCar(spec) : buildVariant(spec);
      const assembly = new Assembly(model, spec);
      this.models.set(index, assembly);
      this.scene.add(assembly.root);
    }
    if (save) rememberVehicle(index);
    this.onChange(spec);
    return this.models.get(index);
  }
  cycle(direction) {
    const i = this.rotation.indexOf(vehicles[this.index].id);
    this.select(
      vehicles.findIndex(
        (v) => v.id === this.rotation[(i + direction + 3) % 3],
      ),
    );
  }
  update(dt, state, roll, braking) {
    this.exhaust?.update(
      vehicles[this.index].flying && this.models.get(this.index).level > 0.85,
      state,
      dt,
    );
    for (const [index, model] of this.models)
      model.update(index === this.index, dt, state, roll, braking);
  }
}

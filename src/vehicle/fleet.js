import { vehicles, rememberVehicle, restoreVehicle } from "./catalog.js";
import { createCar } from "./model.js";
import { buildVariant } from "./variants.js";
import { GasExhaust } from "./exhaust.js";
import { Assembly } from "./assembly.js";

export class Fleet {
  constructor(scene, onChange) {
    this.scene = scene;
    this.onChange = onChange;
    this.models = new Map();
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
    this.select((this.index + direction + vehicles.length) % vehicles.length);
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

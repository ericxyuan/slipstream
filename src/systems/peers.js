import {vehicles} from "../vehicle/catalog.js";
import {buildVariant} from "../vehicle/variants.js";
import {createCar} from "../vehicle/model.js";
import {GasExhaust} from "../vehicle/exhaust.js";
export class Peers{
  constructor(scene,audio){this.scene=scene;this.audio=audio;this.views=new Map();}
  remove(id,v){
    this.scene.remove(v.model.root);v.model.root.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});
    if(v.gas){this.scene.remove(v.gas.mesh);v.gas.mesh.geometry.dispose();v.gas.mesh.material.dispose();}
    this.audio.remove(id);this.views.delete(id);
  }
  update(snapshot,local,state,dt,map,surface){
    const ids=new Set();
    for(const p of snapshot?.players??[]){
      if(p.id===local)continue;ids.add(p.id);const spec=vehicles.find(v=>v.id===p.vehicle);
      let v=this.views.get(p.id);if(v&&v.spec!==spec){this.remove(p.id,v);v=null;}
      if(!v){const model=spec.id==="rally"?createCar(spec):buildVariant(spec);this.scene.add(model.root);
        v={model,spec,s:{...p.state},roll:0,gas:spec.flying?new GasExhaust(this.scene):null};this.views.set(p.id,v);}
      const t=1-Math.exp(-dt*17);for(const k of Object.keys(p.state))v.s[k]+=(p.state[k]-v.s[k])*t;
      const s=v.s;v.roll-=s.speed*dt/.324*(1-s.airborne);v.model.root.position.set(s.x,s.altitude+.04,s.z);v.model.root.rotation.y=s.heading;
      v.model.update(s,v.roll,s.brake>.13);v.gas?.update(true,s,dt);this.audio.update(p.id,s,spec,state,surface,map);
    }
    for(const [id,v] of this.views)if(!ids.has(id))this.remove(id,v);
  }
}

import * as T from "three";
import {box,paint,solid} from "./geometry.js";
export function propMeshes(group,props){
  const orange=paint("#e47637"),white=paint("#f1e9d5"),dark=paint("#383a3c");
  return props.map(p=>{
    const g=new T.Group();group.add(g);
    if(p.kind==="cone"){
      box(g,dark,0,.05,0,.67,.1,.67);
      solid(g,new T.ConeGeometry(.26,.78,12),orange,0,.45,0);
      solid(g,new T.CylinderGeometry(.09,.15,.17,12),white,0,.54,0);
    }else{
      solid(g,new T.CylinderGeometry(.38,.38,.95,16),orange,0,.49,0);
      for(const y of [.3,.72])solid(g,new T.CylinderGeometry(.39,.39,.08,16),white,0,y,0);
    }return g;
  });
}
export function colliderView(group,obstacles){
  const mat=new T.LineBasicMaterial({color:0x8bffb6});
  for(const o of obstacles){
    const h=o.height??2,g=o.rectangle?new T.BoxGeometry(o.rx*2,h,o.rz*2):new T.CylinderGeometry(1,1,h,12);
    if(!o.rectangle)g.scale(o.rx,1,o.rz);
    const line=new T.LineSegments(new T.EdgesGeometry(g),mat);g.dispose();line.position.set(o.x,h/2,o.z);group.add(line);
  }
}
export function surfaceOverlay(group,c){
  if(!c.config||c.config.surface==="original"||c.id==="sky")return;
  const points=c.route, materials=new Map();
  let dist=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
    if(len<.01)continue;
    const surface=c.sections?.[Math.min(c.sections.length-1,Math.floor((dist+len/2)/c.routeLength*c.sections.length))]?.surface??c.surface;
    let mat=materials.get(surface.id);if(!mat){mat=paint(surface.color,{transparent:true,opacity:.54,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});materials.set(surface.id,mat);}
    const strip=box(group,mat,(a.x+b.x)/2,.025,(a.z+b.z)/2,c.id==="drag"?c.stripWidth:c.id==="city"?14:15,.008,len+.05);
    strip.rotation.y=Math.atan2(dx,dz);dist+=len;
  }
}

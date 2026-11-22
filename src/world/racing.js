import * as T from "three";
import { batchStatic, box, paint, randomSource, solid } from "./geometry.js";
import { streetsX, streetsZ, roadWidth, cityBuildings, cityBlocks } from "./city.js";
import { cityCorners } from "./courses.js";
import { grainTexture } from "./road.js";

const luminous = color => new T.MeshBasicMaterial({ color });

function sign(parent, text, x, y, z, width, height, color = "#eff4ee", background = "#182529") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 62px sans-serif";
  ctx.fillText(text, 256, 51, 486);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return solid(parent, new T.PlaneGeometry(width, height),
    new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }), x, y, z);
}

function checkeredLine(group, z, width) {
  const light = paint("#f6f4dc"), dark = paint("#252930");
  const cell = width / 24;
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 24; i++)
      box(group, (row + i) % 2 ? light : dark, -width / 2 + cell * (i + 0.5), 0.045,
        z + cell * (row - 0.5), cell, 0.018, cell);
}

export function buildStrip(group, course) {
  const { length, surface } = course;
  const width=course.stripWidth??20, edge=width/2;
  const texture = grainTexture(218, 30, 42);
  texture.repeat.set(5, (length + 130) / 5);
  const strip = paint(surface.color, { map: texture, roughness: surface.grip < 0.75 ? 0.5 : 0.92 });
  const concrete = paint("#a5a69e"), orange = paint("#ee7838"), white = paint("#f4efe3");
  const steel = paint("#44515b"), tires = paint("#252b2d");
  const depth = length + 130, mid = 25 - depth / 2;
  box(group, paint("#b2a489"), 0, -0.55, mid, 1400, 1, depth + 1000);
  box(group, strip, 0, -0.04, mid, width+2, 0.12, depth);
  for (const side of [-1, 1]) {
    box(group, white, side * (edge-.3), 0.034, mid, 0.15, 0.015, depth);
    box(group, concrete, side * (edge+1.1), 0.48, mid, 0.65, 1, depth);
    for (let d = 0; d <= length + 80; d += 16)
      box(group, orange, side * (edge+.75), 0.52, -d, 0.09, 0.45, 3.2);
    for (let d = 4; d < length; d += 75) {
      box(group, steel, side * (edge+5), 5, -d, 0.22, 10, 0.22);
      box(group, white, side * (edge+4.3), 10, -d, 1.8, 0.25, 0.6);
    }
    for (let row = 0; row < 5; row++)
      box(group, row % 2 ? steel : concrete, side * (edge+10 + row * 1.5), 0.35 + row * 0.6,
        -13, 1.7, 0.6 + row * 0.48, 52);
  }
  box(group, white, 0, 0.034, 0, width, 0.02, 0.32);
  for(let i=1;i<(course.lanes??1);i++) for(let d=2;d<length;d+=9) box(group,white,(i-(course.lanes/2))*4.5,.034,-d,.13,.015,4);
  checkeredLine(group, -length, width);
  for (const side of [-1, 1]) box(group, steel, side * (edge+1.6), 4.4, -length, 0.8, 8.8, 1);
  box(group, tires, 0, 8.1, -length, width+4, 1.8, 1);
  sign(group, "FINISH", 0, 8.12, -length + 0.52, 10, 1.6);
  for (let d = 100; d < length; d += 100)
    sign(group, d + " m", edge+.9, 1.65, -d, 3.6, 1, "#ffbf76");
  batchStatic(group);
  return [];
}

function facade(seed) {
  const rand = randomSource(seed), c = document.createElement("canvas");
  c.width = 128; c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = ["#474e5b", "#5b6269", "#5b4944"][seed % 3];
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 3; y < 256; y += 12)
    for (let x = 2; x < 128; x += 8) {
      ctx.fillStyle = rand() > 0.65 ? "#d8bea0" : rand() > 0.4 ? "#8297a3" : "#394452";
      ctx.fillRect(x, y, 5, 7);
    }
  const map = new T.CanvasTexture(c);
  map.colorSpace = T.SRGBColorSpace;
  return paint("#ffffff", { map });
}

export function buildCity(group,course) {
  const obstacles=cityBuildings(), facades=[1,2,3,4].map(facade);
  const curb=paint("#b7b1a6"), roof=paint("#414a50"), line=paint("#eae2cd"), amber=paint("#d4ac66");
  const brick=paint("#935e49"), concrete=paint("#c9bfab"), foliage=paint("#557353"), bark=paint("#746552");
  const steel=paint("#465260"), grass=paint("#809067"), mint=luminous("#72e5c5");
  const roadMat=paint(course?.surface?.color??"#50555b");
  box(group,roadMat,50,-.51,-20,1100,1,1100);
  for(const b of cityBlocks()){
    const {x,z,w,d,district}=b;
    box(group,district==="park"?grass:curb,x,.07,z,w,.18,d);
    if(district==="park") {
      box(group,curb,x,.18,z,w, .12, 2.5);
      for(const side of [-1,1])for(const k of [-1,0,1]){
        const tx=x+k*w*.31,tz=z+side*d*.28;
        box(group,bark,tx,1.45,tz,.55,2.9,.55);
        solid(group,new T.IcosahedronGeometry(3.1,0),foliage,tx,4,tz);
      }
    }
  }
  for(const [i,o] of obstacles.entries()){
    const {x,z,rx,rz,height:h,district:k}=o,w=rx*2,d=rz*2;
    const wall=k==="downtown"?facades[i%4]:k==="residential"?brick:k==="freight"?steel:concrete;
    box(group,wall,x,h/2,z,w,h,d);
    if(k==="downtown"){
      box(group,facades[(i+1)%4],x,h+3,z,w*.77,6,d*.8);
      box(group,steel,x,h+7,z,1,5,1);
    }else if(k==="residential"){
      const gable=solid(group,new T.ConeGeometry(1,1,4),roof,x,h+1.25,z);
      gable.rotation.y=Math.PI/4;gable.scale.set(w*.76,2.9,d*.74);
      for(const side of [-1,1])for(const n of [-1,0,1])
        box(group,steel,x+n*w*.28,h*.56,z+side*(rz+.04),1.7,1.5,.12);
    }else if(k==="civic"){
      for(let n=-2;n<=2;n++)solid(group,new T.CylinderGeometry(.75,.9,h*.75,10),concrete,x+n*w*.19,h*.375,z+rz+1);
      box(group,concrete,x,h*.82,z+rz,w+2,1.3,5);sign(group,"CITY HALL",x,h*.82,z+rz+2.52,9,1.05);
    }else if(k==="retail"){
      box(group,facades[0],x,h*.38,z+rz,w-.6,h*.56,.2);
      const awning=box(group,i%2?brick:foliage,x,3.2,z+rz+.65,w, .24,1.7);awning.rotation.x=.14;
      sign(group,["MARKET","COFFEE","FOUNDRY STORES"][i%3],x,h*.76,z+rz+.12,w*.75,1.5);
    }else{
      for(let n=-1;n<=1;n++)box(group,roof,x+n*w*.28,2.2,z+rz+.1,w*.19,4.3,.18);
      if(k==="industrial")for(const side of [-1,1])solid(group,new T.CylinderGeometry(.83,1.45,11,12),brick,x+side*w*.3,h+4,z);
      else for(const side of [-1,1])box(group,side===1?brick:foliage,x+side*w*.31,1.35,z+rz+4,5.5,2.7,2.3);
    }
  }
  for(const [axis,positions,cross] of [["x",streetsX,streetsZ],["z",streetsZ,streetsX]]){
    for(const p of positions)for(let i=1;i<cross.length;i++){
      const width=roadWidth(axis,p),a=cross[i-1]+roadWidth(axis==="x"?"z":"x",cross[i-1])/2,b=cross[i]-roadWidth(axis==="x"?"z":"x",cross[i])/2;
      function stripe(mat,off,at,w,d){box(group,mat,axis==="x"?p+off:at,.022,axis==="x"?at:p+off,axis==="x"?w:d,.018,axis==="x"?d:w);}
      stripe(amber,0,(a+b)/2,.17,b-a);
      if(width>=24)for(const side of [-1,1])for(let at=a+4;at<b-2;at+=9)stripe(line,side*width*.24,at,.12,3);
      for(const end of [a+1.3,b-1.3])for(let off=-width/2+1;off<width/2;off+=1.7)stripe(line,off,end,.64,2);
      const lx=axis==="x"?p+width/2+1:(a+b)/2,lz=axis==="x"?(a+b)/2:p+width/2+1;
      box(group,steel,lx,3.2,lz,.18,6.4,.18);box(group,line,lx-.7,6.4,lz,1.6,.22,.4);
    }
  }
  // Painted chevrons trace the racing line and point around each junction.
  cityCorners.forEach(([x, z], i) => {
    const [ex, ez] = cityCorners[(i + 1) % cityCorners.length];
    const length = Math.hypot(ex - x, ez - z), dx = (ex - x) / length, dz = (ez - z) / length;
    for (let d = 4; d < length; d += 13) for (const side of [-1, 1]) {
      const stripe = box(group, mint, x + dx * d - side * dz * 0.48, 0.034,
        z + dz * d + side * dx * 0.48, 0.25, 0.018, 1.5);
      stripe.rotation.y = Math.atan2(-dx, -dz) + side * 0.75;
    }
  });
  checkeredLine(group, 40, 16);
  sign(group, "FOUNDRY CITY", 0, 7.1, 40, 18, 1.9);
  for (const x of [-9.4, 9.4]) box(group, steel, x, 3.6, 40, 0.5, 7.2, 0.6);
  batchStatic(group);
  return obstacles;
}

export function buildSky(group, course) {
  const rand = randomSource(516);
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  for (let i = 0; i < 65; i++) {
    const x = 44 + rand() * 168, dome = Math.sin(Math.PI * (x - 44) / 168);
    const y = 80 - rand() * dome * 40, r = 10 + rand() * 31;
    const grad = ctx.createRadialGradient(x, y, r * 0.15, x, y, r);
    grad.addColorStop(0, i < 25 ? "#b5c9dfee" : "#f1f6ffef");
    grad.addColorStop(0.55, i < 25 ? "#bdcee1c0" : "#f3f7ffd1");
    grad.addColorStop(1, "#ebf4ff00");
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  const clouds = new T.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: T.DoubleSide });
  const blue = paint("#8baec2"), rim = paint("#2a414e"), light = luminous("#85dcfb");
  // The start deck and cloud banks sit beneath the flight path.
  box(group, blue, 0, -98, -260, 2400, 2, 2400);
  for (let i = 0; i < 180; i++) {
    const cloud = solid(group, new T.PlaneGeometry(1, 1), clouds,
      rand() * 1100 - 550, -30 - rand() * 50, 180 - rand() * 1150);
    const width = 60 + rand() * 130;
    cloud.scale.set(width, width * 0.38, 1);
    cloud.rotation.set(-0.45, (rand() - 0.5) * Math.PI, 0, "YXZ");
    cloud.castShadow = cloud.receiveShadow = false;
  }
  box(group, rim, 0, -0.6, 7, 16, 1.2, 40);
  for (const x of [-7.5, 7.5]) box(group, light, x, 0.05, 7, 0.25, 0.1, 40);
  (course.gates.length?course.gates:course.network?.slice(1)??[]).forEach((g, i) => {
    const portal = new T.Group();
    portal.position.set(g.x, g.y, g.z);
    portal.rotation.y = Math.atan2(-(g.dx??0), -(g.dz??-1));
    group.add(portal);
    solid(portal, new T.TorusGeometry((g.radius??5.5) + 0.48, 0.45, 8, 64), rim);
    solid(portal, new T.TorusGeometry((g.radius??5.5) + 0.12, 0.13, 8, 64), light, 0, 0, 0.27);
    sign(portal, i === course.gates.length - 1 ? "FINISH" : String(i + 1).padStart(2, "0"),
      0, (g.radius??5.5) + 1.2, 0.1, 3.8, 1);
  });
  batchStatic(group);
  return [];
}

export function disposeCourse(group) {
  const materials = new Set();
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    materials.add(mesh.material);
  });
  for (const material of materials) {
    material.map?.dispose();
    material.dispose();
  }
}

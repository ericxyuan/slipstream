import { courseLayout, courses, surfaces } from "./courses.js";
export const formats = {free:"Free drive",circuit:"Circuit",sprint:"Sprint",drag:"Drag",trial:"Time trial"};
export const defaults = {map:"desert",format:"free",surface:"original",collision:"ghost",laps:1,dnf:30,players:8,rules:"authentic",reverse:false,start:0,end:100,checkpoints:8,distance:402,countdown:3,sections:"prepared,gravel,wet"};
export function validate(raw={}) {
  const c={...defaults,...raw};
  if (!Object.hasOwn(courses,c.map)||!Object.hasOwn(formats,c.format)||
    !["original","mixed","custom",...Object.keys(surfaces)].includes(c.surface)||
    !["real","ghost"].includes(c.collision)||!["balanced","authentic"].includes(c.rules)) throw Error("Choose a valid map, format and rule set.");
  for(const [key,min,max] of [["laps",1,99],["dnf",0,3600],["players",1,12],["start",0,90],["end",10,100],["checkpoints",2,32],["distance",50,2000],["countdown",1,15]]) {
    if(!Number.isInteger(c[key])||c[key]<min||c[key]>max) throw Error("Invalid "+key+".");
  }
  if(c.end<=c.start) throw Error("Finish must follow the start.");
  if(typeof c.sections!=="string"||c.sections.length>300||c.sections.split(",").some(key=>!Object.hasOwn(surfaces,key.trim()))) throw Error("Use valid surface names for custom sections.");
  c.reverse=c.reverse===true;
  if(c.format!=="circuit") c.laps=1;
  return c;
}
export function makeCourse(raw, count=1, lane=0) {
  const config=validate(raw), {map,format}=config;
  const c=courseLayout(map,config.distance);
  const stripWidth=Math.max(12,count*4.5+3);
  if(map==="city")c.bounds=[-166,286,-286,246];
  if(map==="drag"){c.lanes=count;c.stripWidth=stripWidth;c.bounds=[-stripWidth/2,stripWidth/2,-config.distance-100,22];}
  let p=c.points.map(v=>({x:v.x,y:v.y??0,z:v.z}));
  const network=[...p];
  if(map==="desert") p.pop();
  if(map==="sky") p[0].y=8;
  if(format==="drag" && map!=="drag"){
    const distance=Math.min(config.distance,{city:510,desert:95,sky:660}[map]);
    const z={city:235,desert:79,sky:0}[map];
    p=[{x:0,y:map==="sky"?8:0,z},{x:0,y:map==="sky"?8:0,z:z-distance}];
  }else if(format==="circuit"&&!c.closed){
    p=[...p,...p.slice().reverse().map(v=>({...v,x:v.x+(map==="drag"?4:24)}))];
  }
  if(config.reverse) p.reverse();
  if(c.closed && format!=="drag" || format==="circuit") p.push({...p[0]});
  const lengths=[0];
  for(let i=1;i<p.length;i++) lengths.push(lengths[i-1]+Math.hypot(p[i].x-p[i-1].x,p[i].z-p[i-1].z));
  const full=lengths.at(-1);
  function at(d) {
    d=Math.max(0,Math.min(full,d));
    let i=1;while(i<lengths.length-1 && lengths[i]<d)i++;
    const a=p[i-1],b=p[i],span=lengths[i]-lengths[i-1]||1,t=(d-lengths[i-1])/span;
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,dx:(b.x-a.x)/span,dz:(b.z-a.z)/span,radius:map==="sky"?6:Math.max(9,stripWidth/2+1)};
  }
  const from=full*config.start/100, distance=format==="circuit"?full:full*config.end/100-from;
  function sample(t){const d=from+distance*t;return at(d>full?d-full:d);}
  const route=[sample(0),...p.flatMap((v,i)=>lengths[i]>from&&lengths[i]<Math.min(full,from+distance)?[v]:[]),...(from+distance>full?p.filter((v,i)=>lengths[i]<from):[]),sample(1)];
  const a=at(from+0.001), offset=(lane-(count-1)/2)*(format==="drag"?4.5:3.2);
  const spawn={x:a.x-a.dz*offset,z:a.z+a.dx*offset,heading:Math.atan2(-a.dx,-a.dz),altitude:a.y};
  const surface=surfaces[config.surface]??surfaces[map==="drag"?"prepared":"asphalt"];
  const palette=config.surface==="mixed"?["asphalt","gravel","wet"]:config.sections.split(",").map(k=>k.trim());
  const sections=["mixed","custom"].includes(config.surface)?Array.from({length:palette.length},(_,i)=>({a:sample(i/palette.length),b:sample((i+1)/palette.length),surface:surfaces[palette[i]]})):null;
  return {...c,config,network,route,sections,surface,routeLength:distance,format,type:formats[format],closed:format==="circuit",
    spawn:format==="free"&&map==="desert"?undefined:spawn,
    gates:format==="free"?[]:Array.from({length:format==="drag"?1:config.checkpoints},(_,i)=>sample((i+1)/(format==="drag"?1:config.checkpoints)))};
}

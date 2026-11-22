// Lightweight impulses in world space. A horizontal capsule approximates each vehicle.
export function collideVehicles(a,b){
  const sa=a.state,sb=b.state;
  if(Math.abs(sa.altitude-sb.altitude)>Math.max(a.spec.height,b.spec.height))return;
  const axis=c=>({x:-Math.sin(c.state.heading),z:-Math.cos(c.state.heading)});
  const ax=axis(a),bx=axis(b),dx=sb.x-sa.x,dz=sb.z-sa.z;
  let depth=Infinity,nx=0,nz=0;
  for(const n of [ax,bx,{x:-ax.z,z:ax.x},{x:-bx.z,z:bx.x}]){
    const radius=(c,f)=>(Math.abs(n.x*f.x+n.z*f.z)*c.spec.length+Math.abs(-n.x*f.z+n.z*f.x)*c.spec.width)/2;
    const dot=dx*n.x+dz*n.z, overlap=radius(a,ax)+radius(b,bx)-Math.abs(dot);
    if(overlap<=0)return;
    if(overlap<depth){depth=overlap;nx=n.x*(Math.sign(dot)||1);nz=n.z*(Math.sign(dot)||1);}
  }
  const ia=1/a.spec.mass,ib=1/b.spec.mass,sum=ia+ib;
  sa.x-=nx*depth*ia/sum;sa.z-=nz*depth*ia/sum;sb.x+=nx*depth*ib/sum;sb.z+=nz*depth*ib/sum;
  const v=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;
  if(v>=0)return;
  const j=-1.12*v/sum;
  a.vx-=nx*j*ia;a.vz-=nz*j*ia;b.vx+=nx*j*ib;b.vz+=nz*j*ib;
  sa.impact=sb.impact=-v;
}
export function makeProps(course){
  if(course.id==="sky")return [];
  const points=course.network??course.points;
  return Array.from({length:12},(_,i)=>{
    const p=points[Math.floor(i/12*(points.length-1))],q=points[Math.min(points.length-1,Math.floor(i/12*(points.length-1))+1)];
    const dx=q.x-p.x,dz=q.z-p.z,n=Math.hypot(dx,dz)||1;
    const side=(i%2?1:-1)*(course.id==="drag"?(course.stripWidth??12)/2-.4:6.2);
    return {x:p.x+dz/n*side+(course.id==="drag"?0:0),z:course.id==="drag"?-i*course.length/12:p.z-dx/n*side,vx:0,vz:0,tilt:0,kind:i%3?"cone":"barrel"};
  });
}
export function stepProps(props,cars,dt){
  for(const p of props){
    for(const c of cars){
      if(c.state.altitude>1.1)continue;
      const dx=p.x-c.state.x,dz=p.z-c.state.z,cos=Math.cos(c.state.heading),sin=Math.sin(c.state.heading);
      const x=dx*cos-dz*sin,z=dx*sin+dz*cos;
      if(Math.abs(x)>c.spec.width/2+.3||Math.abs(z)>c.spec.length/2+.3||Math.hypot(c.vx-p.vx,c.vz-p.vz)<1.2)continue;
      p.vx=c.vx*.85+Math.sign(dx)*1.2;p.vz=c.vz*.85+Math.sign(dz)*1.2;p.tilt=1.4;c.vx*=.997;c.vz*=.997;
      c.state.impact=Math.max(c.state.impact,2);
    }
    p.x+=p.vx*dt;p.z+=p.vz*dt;const k=Math.exp(-1.6*dt);p.vx*=k;p.vz*=k;
  }
}

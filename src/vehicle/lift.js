// A flat road supports a tyre until the suspension reaches full droop.
// Hysteresis below that travel prevents contact chatter at touchdown.
const droop=.065, gravity=9.80665;
export const flightBase={drive:13.5,speed:75,brake:8,yaw:.94,side:2.82,lift:9,climb:4.5,pitch:.08,bank:.18,control:3,damping:1.5};
export const flight=Object.fromEntries(Object.entries(flightBase).map(([k,v])=>[k,v*1.8]));
export function lift(car,input,dt){
  const s=car.state, spec=car.spec, old=s.altitude;
  s.compression=Math.max(0,s.compression-dt*4);
  car.cooldown=Math.max(0,car.cooldown-dt);
  if(spec.jump && input.jump && !car.jumpHeld && !s.airborne && !car.cooldown){
    car.preload=.11;car.cooldown=1.2;
  }
  car.jumpHeld=!!input.jump;
  if(car.preload>0){
    car.preload-=dt;s.compression=1;
    if(car.preload<=0)s.verticalSpeed=Math.sqrt(2*gravity*.2);
  }
  if(spec.flying){
    car.hoverTarget=Math.max(0,Math.min(32,car.hoverTarget+((+!!input.rise)-(+!!input.lower))*flight.climb*dt));
    const a=Math.max(-flight.lift,Math.min(flight.lift,16*(car.hoverTarget-old)-8*s.verticalSpeed));
    s.verticalSpeed+=a*dt;
  }else if(old>0 || s.verticalSpeed>0)s.verticalSpeed-=gravity*dt;
  s.altitude=Math.max(0,old+s.verticalSpeed*dt);
  if(spec.flying&&Math.abs(s.altitude-car.hoverTarget)<.004&&Math.abs(s.verticalSpeed)<.02){s.altitude=car.hoverTarget;s.verticalSpeed=0;}
  if(s.altitude===0&&s.verticalSpeed<0){s.compression=Math.min(1,-s.verticalSpeed/2);s.verticalSpeed=0;}
  const travel=s.airborne?droop*.4:droop;
  s.support=Math.max(0,1-s.altitude/travel);
  s.airborne=Number(s.support<=0);
  s.mode=s.airborne?(spec.flying?(car.hoverTarget<travel?3:2):4):(spec.flying&&car.hoverTarget>droop?1:0);
}

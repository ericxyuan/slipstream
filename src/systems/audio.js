// Procedural sources are started only after a user gesture. Each remote voice has its own spatial mix.
export class DriveAudio{
  constructor(){
    try{this.volumes=JSON.parse(localStorage.getItem("slipstream.audio"))??{};}catch{this.volumes={};}
    this.voices=new Map();
    const unlock=()=>{if(!this.ctx)this.init();if(this.ctx?.state==="suspended")this.ctx.resume().catch(()=>{});};
    window.addEventListener("pointerdown",unlock);window.addEventListener("keydown",unlock);
  }
  init(){
    if(!window.AudioContext)return;
    this.ctx=new AudioContext();let c=this.ctx;
    this.master=c.createGain();const limiter=c.createDynamicsCompressor();this.master.connect(limiter).connect(c.destination);
    this.buses={};for(const id of ["engine","surface","ambient","effects","ui"]){this.buses[id]=c.createGain();this.buses[id].connect(this.master);}
    this.noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate);let data=this.noise.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
    this.wind=this.texture(this.buses.ambient);this.tyres=this.texture(this.buses.surface);
    this.apply();
  }
  texture(bus){
    const c=this.ctx,node=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();
    node.buffer=this.noise;node.loop=true;filter.type="lowpass";gain.gain.value=0;node.connect(filter).connect(gain).connect(bus);node.start();
    return {gain:gain.gain,freq:filter.frequency};
  }
  set(key,v){this.volumes[key]=v;try{localStorage.setItem("slipstream.audio",JSON.stringify(this.volumes));}catch{}this.apply();}
  apply(){if(!this.ctx)return;for(const [id,node] of Object.entries({master:this.master,...this.buses}))node.gain.setTargetAtTime(this.volumes[id]??(id==="master"?.45:.65),this.ctx.currentTime,.05);}
  tone(freq,duration=.09,bus="ui"){
    if(!this.ctx)return;const c=this.ctx,o=c.createOscillator(),g=c.createGain(),t=c.currentTime;
    o.frequency.value=freq;o.connect(g).connect(this.buses[bus]);g.gain.setValueAtTime(.085,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.start();o.stop(t+duration);
  }
  update(id,s,v,listener,surface,map){
    if(!this.ctx)return;const c=this.ctx,t=c.currentTime;
    let voice=this.voices.get(id);
    if(!voice){
      const osc=c.createOscillator(),harm=c.createOscillator(),gain=c.createGain(),pan=c.createStereoPanner(),filter=c.createBiquadFilter();
      filter.type="lowpass";osc.connect(filter);harm.connect(filter);filter.connect(gain).connect(pan).connect(this.buses.engine);
      gain.gain.value=0;osc.start();harm.start();voice={osc,harm,gain,pan,filter};this.voices.set(id,voice);
    }
    const ev=v.electric&&!v.hybrid,heavy=v.mass>5000,rev=ev?s.groundSpeed*.95:Math.abs(s.speed)%9*4.2;
    const base=heavy?28:v.hybrid?52:ev?98:64;
    voice.osc.type=ev?"sine":heavy?"sawtooth":"triangle";voice.harm.type=ev?"triangle":"sine";
    const f=base+rev+s.throttle*(heavy?12:33)+s.regen*7;
    voice.osc.frequency.setTargetAtTime(f,t,.09);voice.harm.frequency.setTargetAtTime(f*(v.hybrid?1.5:ev?2.02:2),t,.1);
    voice.filter.frequency.setTargetAtTime(170+s.throttle*760,t,.09);
    const dx=s.x-listener.x,dz=s.z-listener.z,dist=Math.hypot(dx,dz);
    voice.pan.pan.setTargetAtTime(Math.max(-1,Math.min(1,(dx*Math.cos(listener.heading)-dz*Math.sin(listener.heading))/20)),t,.08);
    voice.gain.gain.setTargetAtTime((ev?.017:.045)*(1+s.throttle*1.8)/(1+dist*.07),t,.08);
    if(id==="local"){
      this.wind.freq.setTargetAtTime(map==="city"?480:map==="sky"?1200:650,t,.3);
      this.wind.gain.setTargetAtTime(.014+s.groundSpeed*.0007+s.rearThrust*.14,t,.14);
      this.tyres.freq.setTargetAtTime(650+(1-(surface?.grip??1))*2900+s.wheelSlip*900,t,.1);
      this.tyres.gain.setTargetAtTime((1-s.airborne)*Math.min(.16,s.groundSpeed*.0008*(surface?.rolling??1)+s.wheelSlip*.08),t,.1);
      if(s.impact>1&&!this.hit)this.tone(57,.17,"effects");this.hit=s.impact>1;
      if(s.mode===4&&this.mode!==4)this.tone(110,.08,"effects");this.mode=s.mode;
    }
  }
  remove(id){const v=this.voices.get(id);if(v){v.osc.stop();v.harm.stop();v.pan.disconnect();this.voices.delete(id);}}
  mute(on){if(this.ctx)this.master.gain.setTargetAtTime(on?0:(this.volumes.master??.45),this.ctx.currentTime,.06);}
}

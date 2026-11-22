// Longitudinal grip is the maximum tyre acceleration in metres per second squared.
const definitions = [
  ["prepared","Smooth asphalt",65,1.12,0.9,"#45454a"],
  ["asphalt","Standard asphalt",20,1,1,"#54555a"],
  ["worn","Worn asphalt",13,.88,1.15,"#726e69"],
  ["wet","Wet asphalt",5.5,.66,1.06,"#344353"],
  ["concrete","Concrete",19,.96,1.02,"#9b9995"],
  ["wetConcrete","Wet concrete",5,.61,1.1,"#74828a"],
  ["gravel","Loose gravel",3.4,.46,1.65,"#aa9174"],
  ["dirt","Packed dirt",5,.58,1.5,"#a17a58"],
  ["mud","Mud",2.8,.38,3.4,"#59483c"],
  ["sand","Sand",3.1,.41,4,"#d9bf8b"],
  ["grass","Grass",4.2,.53,1.8,"#79825c"],
  ["wetGrass","Wet grass",2,.29,2.1,"#657050"],
  ["snow","Snow",2.5,.35,2.4,"#c8d4da"],
  ["ice","Packed ice",1.45,.23,.68,"#acc7d4"],
  ["cobbles","Cobblestone",7,.72,1.55,"#867d76"],
];
export const surfaces = Object.fromEntries(definitions.map(([id,name,traction,grip,rolling,color]) =>
  [id,{id,name,traction,grip,rolling,color}]));
export function surfaceAt(course,x,z) {
  if (!course?.sections?.length) return course?.surface;
  let nearest = Infinity, chosen;
  for (const section of course.sections) {
    const {a,b} = section, dx=b.x-a.x, dz=b.z-a.z;
    const t = Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz || 1)));
    const distance=(a.x+dx*t-x)**2+(a.z+dz*t-z)**2;
    if(distance<nearest){ nearest=distance; chosen=section.surface; }
  }
  return chosen;
}

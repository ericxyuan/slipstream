// Dimensions and bonnet viewpoints use metres. Handling uses m/s² for longitudinal
// acceleration, m/s for speed limits, radians for lock and rad/s for maximum turn rate.
// Grip and steering response are damping rates per second. These are class-level game tunes.
export const vehicles = [
  {
    id: "rally",
    name: "Rally coupe",
    plate: "SLP-001",
    color: "#ff8343",
    width: 1.94,
    length: 4.1,
    height: 1.28,
    bonnet: [1.28, -0.59],
    wheelbase: 2.65,
    handling: {
      launch: 8.5,
      braking: 9.9,
      coast: 0.48,
      drag: 0.0013,
      limit: 49,
      reverseLimit: 8,
      steeringLock: 0.82,
      steerResponse: 13.4,
      turnRate: 1.65,
      grip: 9.4,
      pedalTime: 0.46,
      brakeTime: 0.27,
    },
  },
  {
    id: "sport",
    name: "Sports coupe",
    plate: "APEX-02",
    color: "#8ed8fa",
    width: 2.04,
    length: 4.55,
    height: 1.19,
    bonnet: [1.15, -0.76],
    wheelbase: 2.76,
    handling: {
      launch: 9.1,
      braking: 11,
      coast: 0.36,
      drag: 0.001,
      limit: 64,
      reverseLimit: 8,
      steeringLock: 0.78,
      steerResponse: 16.2,
      turnRate: 1.95,
      grip: 12,
      pedalTime: 0.41,
      brakeTime: 0.22,
    },
  },
  {
    id: "bus",
    name: "School bus",
    plate: "BUS-003",
    color: "#ffca37",
    width: 2.48,
    length: 9.2,
    height: 3.1,
    bonnet: [2.55, -3.42],
    wheelbase: 5.7,
    handling: {
      launch: 1.85,
      braking: 5.4,
      coast: 0.24,
      drag: 0.0014,
      limit: 28,
      reverseLimit: 4,
      steeringLock: 0.87,
      steerResponse: 6.0,
      turnRate: 0.76,
      grip: 5,
      pedalTime: 0.93,
      brakeTime: 0.62,
    },
  },
  {
    id: "semi",
    name: "Semi tractor",
    plate: "RIG-004",
    color: "#eef3f8",
    width: 2.55,
    length: 7.5,
    height: 3.4,
    bonnet: [2.68, -1.61],
    wheelbase: 4.6,
    handling: {
      launch: 3.15,
      braking: 6.2,
      coast: 0.3,
      drag: 0.0018,
      limit: 36,
      reverseLimit: 5,
      steeringLock: 0.85,
      steerResponse: 7.3,
      turnRate: 0.9,
      grip: 5.8,
      pedalTime: 0.74,
      brakeTime: 0.51,
    },
  },
  {
    id: "roadster",
    name: "Tesla Roadster 2 · Rocket Edition",
    plate: "RDSTR",
    color: "#f7f8fa",
    width: 2.1,
    length: 4.62,
    height: 1.12,
    bonnet: [1.16, -0.76],
    wheelbase: 2.8,
    handling: {
      launch: 12.8,
      braking: 11.4,
      coast: 1.24,
      drag: 0.0009,
      limit: 75,
      reverseLimit: 9,
      steeringLock: 0.76,
      steerResponse: 10.7,
      turnRate: 1.93,
      grip: 11,
      pedalTime: 0.69,
      brakeTime: 0.4,
    },
    flying: true,
  },
];
vehicles.push(
  {
    id: "u9",
    name: "Yangwang U9 Xtreme · Dawn Moment",
    plate: "U9X",
    color: "#c5a25a",
    paint: "#17181b",
    jump: true,
    width: 2.03,
    length: 4.97,
    height: 1.29,
    bonnet: [1.18, -0.76],
    wheelbase: 2.9,
    handling: {
      ...vehicles[1].handling,
      steerResponse: 17.1,
      turnRate: 2.12,
      grip: 15,
      braking: 14.1,
      pedalTime: 0.3,
    },
  },
  {
    id: "i8",
    name: "BMW i8 Coupé",
    plate: "BMW-I8",
    color: "#72c9ef",
    paint: "#a7b8c4",
    hybrid: true,
    width: 1.94,
    length: 4.69,
    height: 1.29,
    bonnet: [1.16, -0.76],
    wheelbase: 2.8,
    handling: {
      ...vehicles[1].handling,
      steerResponse: 13.0,
      turnRate: 1.72,
      grip: 10.4,
      braking: 10.4,
    },
  },
);
const performanceData = [
  [1550, 265, 3.1, "AWD rally"],
  [1350, 345, 2.1, "RWD sports"],
  [9000, 205, 4.2, "Schoolbus"],
  [15000, 230, 4, "Heavy tractor"],
  [
    1900,
    375,
    0.59,
    "Cold-gas Rocket · <0.59 s to 60 mph reference · estimated game mass",
  ],
  [
    2480,
    503.17,
    1.9,
    "Four motors · 2,220 kW · 3,019 PS · 1,200 V · estimated game launch",
  ],
  [1535, 250, 4.4, "Plug-in hybrid AWD · 275 kW · 374 PS"],
];
vehicles.forEach((v, i) => {
  const [mass, top, seconds, description] = performanceData[i];
  Object.assign(v, {
    mass,
    top,
    seconds,
    description,
    electric: i >= 4,
    pack: i >= 4 ? "Electric Set" : "SlipStream Set",
    batteryKWh: { roadster: 120, u9: 80, i8: 11.6 }[v.id] ?? 0,
  });
  const h = v.handling,
    goal = v.flying ? 26.8224 : 100 / 3.6;
  h.limit = top / 3.6;
  if (v.flying) h.pedalTime = 0.16;
  // Integrate the same torque taper used by the simulation to calibrate the launch.
  let integral = 0;
  for (let j = 0; j < 100; j++)
    integral += goal / 100 / (1 - (((j + 0.5) * goal) / 100 / h.limit) ** 2);
  h.launch = integral / (seconds - h.pedalTime * 0.5);
});
export function restoreRotation() {
  try {
    const ids = JSON.parse(localStorage.getItem("slipstream.rotation"));
    if (
      Array.isArray(ids) &&
      ids.length === 3 &&
      new Set(ids).size === 3 &&
      ids.every((id) => vehicles.some((v) => v.id === id))
    )
      return ids;
  } catch {}
  return ["rally", "sport", "roadster"];
}
export const storageKey = "slipstream.vehicle";
export function restoreVehicle() {
  try {
    const id = localStorage.getItem(storageKey);
    return Math.max(
      0,
      vehicles.findIndex((vehicle) => vehicle.id === id),
    );
  } catch {
    return 0;
  }
}
export function rememberVehicle(index) {
  try {
    localStorage.setItem(storageKey, vehicles[index].id);
  } catch {
    /* Storage can be unavailable in a private window. */
  }
}

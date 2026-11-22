// Dimensions and bonnet viewpoints use metres. Handling uses m/s² for longitudinal
// and lateral acceleration, m/s for speed limits, radians for lock and seconds for pedal travel.
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
      steeringLock: 0.57,
      steerResponse: 8.5,
      cornering: 8.7,
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
      steeringLock: 0.52,
      steerResponse: 10.5,
      cornering: 10.7,
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
      steeringLock: 0.66,
      steerResponse: 3.7,
      cornering: 3.6,
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
      steeringLock: 0.62,
      steerResponse: 4.6,
      cornering: 4.4,
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
      steeringLock: 0.51,
      steerResponse: 6.8,
      cornering: 10.3,
      grip: 11,
      pedalTime: 0.69,
      brakeTime: 0.4,
    },
    flying: true,
  },
];
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

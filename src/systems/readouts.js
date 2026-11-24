import { accelerationMagnitude } from "../vehicle/telemetry.js";

export function combinedAcceleration(state) {
  const magnitude = accelerationMagnitude(state);
  return magnitude.toFixed(2) + " m/s² · " + (magnitude / 9.80665).toFixed(2) + " g";
}
export const formatTime = (n) => (n == null ? "—" : n.toFixed(3) + " s");
export const motionNames = [
  "Ground driving",
  "Lifting off",
  "Flight",
  "Landing",
  "Suspension jump",
];

// Coordinate acceleration in the vehicle's orthonormal forward, lateral and vertical axes.
export function accelerationMagnitude(state) {
  return Math.hypot(state.acceleration, state.lateralAccel, state.verticalAccel);
}

export const MAX_REGEN = 4; // m/s² at full regenerative braking

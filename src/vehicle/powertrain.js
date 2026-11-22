// Axle demand is a fraction of requested wheel force. Wheel loads sum to one.
export function wheelDrive(spec, demand, traction, s, steering) {
  const loadShift = Math.max(-0.09, Math.min(0.09, s.acceleration * 0.008));
  const front = 0.5 - loadShift,
    rear = 1 - front;
  if (spec.hybrid) {
    // The petrol three-cylinder drives the rear axle. Front eDrive assists launch
    // and carries light loads until speed, driver demand or battery reserve calls for the engine.
    const petrol = Math.min(
      1,
      Math.max(
        0,
        (s.throttle - 0.2) * 1.6,
        (s.groundSpeed - 19) / 13,
        (0.19 - s.battery) * 8,
      ),
    );
    s.engineLoad = petrol * s.throttle;
    const electric = s.battery > 0.02 ? 1 - petrol * 0.65 : 0;
    return (
      Math.sign(demand) *
      (Math.min(Math.abs(demand) * electric, traction * front) +
        Math.min(Math.abs(demand) * (1 - electric), traction * rear))
    );
  }
  s.engineLoad = spec.electric ? 0 : s.throttle;
  if (spec.id === "u9") {
    // Torque is apportioned at each wheel. The outside pair accepts more load in a turn.
    const left = Math.max(0.28, Math.min(0.72, 0.5 - steering * 0.1));
    let delivered = 0;
    for (const axle of [front, rear])
      for (const side of [left, 1 - left]) {
        const fraction = axle * side;
        delivered += Math.min(Math.abs(demand) * fraction, traction * fraction);
      }
    return Math.sign(demand) * delivered;
  }
  return Math.max(-traction, Math.min(traction, demand));
}

// Vehicle-local coordinates in metres. Direction is the outgoing gas vector.
export const rearPorts = [-0.39, -0.13, 0.13, 0.39].map((x) => ({
  x,
  y: 0.398,
  z: 2.327,
  dx: 0,
  dy: 0,
  dz: 1,
}));
export const liftPorts = [-0.86, 0.86].flatMap((x) =>
  [-1.36, 1.36].map((z) => ({ x, y: 0.13, z, dx: 0, dy: -1, dz: 0 })),
);
export const steeringPorts = [-1, 1].flatMap((side) =>
  [-1.04, 1.04].map((z) => ({
    x: side * 1.055,
    y: 0.52,
    z,
    dx: side,
    dy: 0,
    dz: 0,
    // Equal opposing forces at the nose and tail give yaw without sideways drift.
    turn: -Math.sign(z) * side,
  })),
);

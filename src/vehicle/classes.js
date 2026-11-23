export const classes = {
  all: "Open field",
  original: "SlipStream Set",
  electric: "Electric Set",
  heavy: "Heavy vehicles",
};
export function eligible(v, c) {
  if (!v) return false;
  if (c.map === "sky") return !!v.flying;
  switch (c.vehicleClass) {
    case "electric":
      return v.electric;
    case "heavy":
      return v.mass >= 5000;
    case "original":
      return !v.electric;
    default:
      return true;
  }
}

export function supportsControl(vehicle, action) {
  if (action === "jump") return !!vehicle.jump;
  if (action === "rise" || action === "lower") return !!vehicle.flying;
  return true;
}

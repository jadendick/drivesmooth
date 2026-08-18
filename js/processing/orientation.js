// Converts device-screen coordinates into vehicle coordinates: x is right, y is forward.
export function orientForce({ x, y }, phoneForward) {
  switch (phoneForward) {
    case "top": return { x: x, y: -y };
    case "bottom": return { x: -x, y: y };
    case "right": return { x: y, y: x };
    case "left": return { x: -y, y: -x };
    default: return { x, y };
  }
}

// Used by the localhost simulator so its virtual vehicle force remains intuitive for every setting.
export function toDeviceForce({ x, y }, phoneForward) {
  switch (phoneForward) {
    case "bottom": return { x: -x, y: -y };
    case "right": return { x: y, y: -x };
    case "left": return { x: -y, y: x };
    default: return { x, y };
  }
}

// This is intentionally a pass-through. Keeping it isolated lets us add a filter later.
export function smoothForce(rawForce) {
  return { x: rawForce.x, y: rawForce.y };
}

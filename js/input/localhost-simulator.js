import { toDeviceForce } from "../processing/orientation.js";

export class LocalhostSimulator {
  constructor(onSample, getSettings) { this.onSample = onSample; this.getSettings = getSettings; this.timer = null; this.startedAt = 0; }
  async requestPermission() {}
  start() { if (!this.timer) { this.startedAt = performance.now(); this.timer = window.setInterval(() => this.emit(), 1000 / 60); } }
  stop() { window.clearInterval(this.timer); this.timer = null; }
  emit() {
    const seconds = (performance.now() - this.startedAt) / 1000;
    const phase = seconds % 18;
    const pulse = (from, to, max) => phase < from || phase > to ? 0 : max * Math.sin(((phase - from) / (to - from)) * Math.PI);
    const y = pulse(2, 5, .34) - pulse(7, 10, .55);
    const x = pulse(3, 6.5, .32) - pulse(12, 16, .42);
    const noise = () => (Math.random() - .5) * .012;
    const deviceForce = toDeviceForce({ x, y }, this.getSettings().phoneForward);
    this.onSample({ timestamp: performance.now(), x: deviceForce.x + noise(), y: deviceForce.y + noise() });
  }
}

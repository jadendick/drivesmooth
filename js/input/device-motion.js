import { CONFIG } from "../config.js";

export class DeviceMotionInput {
  constructor(onSample) { this.onSample = onSample; this.running = false; this.handleMotion = this.handleMotion.bind(this); }
  async requestPermission() {
    if (!("DeviceMotionEvent" in window)) throw new Error("This browser does not provide motion data.");
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      const result = await DeviceMotionEvent.requestPermission();
      if (result !== "granted") throw new Error("Motion permission was not granted.");
    }
  }
  start() { if (!this.running) { window.addEventListener("devicemotion", this.handleMotion); this.running = true; } }
  stop() { window.removeEventListener("devicemotion", this.handleMotion); this.running = false; }
  handleMotion(event) {
    const acceleration = event.accelerationIncludingGravity || event.acceleration;
    if (!acceleration || !Number.isFinite(acceleration.x) || !Number.isFinite(acceleration.y)) return;
    this.onSample({ timestamp: performance.now(), x: acceleration.x / CONFIG.gravity, y: acceleration.y / CONFIG.gravity });
  }
}

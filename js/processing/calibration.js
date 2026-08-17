export class Calibration {
  constructor() { this.offset = { x: 0, y: 0 }; this.samples = []; this.endsAt = 0; }
  begin(durationMs, now) { this.samples = []; this.endsAt = now + durationMs; }
  get active() { return this.endsAt > 0; }
  add(sample) { if (this.active) this.samples.push(sample); }
  finish() {
    if (!this.samples.length) return false;
    this.offset = ["x", "y"].reduce((result, axis) => ({ ...result, [axis]: this.samples.reduce((sum, sample) => sum + sample[axis], 0) / this.samples.length }), {});
    this.samples = []; this.endsAt = 0; return true;
  }
  apply(sample) { return { x: sample.x - this.offset.x, y: sample.y - this.offset.y }; }
}

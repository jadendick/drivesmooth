export class ForceChart {
  constructor(canvas, axis, color, config) { this.canvas = canvas; this.axis = axis; this.color = color; this.config = config; this.context = canvas.getContext("2d"); }
  draw(samples, { durationMs, now }) {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * ratio)); const height = Math.max(1, Math.round(rect.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    const ctx = this.context; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    this.drawGrid(ctx, rect.width, rect.height);
    if (!samples.length) return;
    const end = now; const start = end - Math.max(durationMs, 1);
    ctx.beginPath(); ctx.strokeStyle = this.color; ctx.lineWidth = 2; ctx.lineJoin = "round";
    let hasPoint = false;
    for (const sample of samples) {
      const x = ((sample.timestamp - start) / (end - start)) * rect.width;
      const value = Math.max(-this.config.maxDisplayForceG, Math.min(this.config.maxDisplayForceG, sample.smooth[this.axis]));
      const y = rect.height / 2 - (value / this.config.maxDisplayForceG) * (rect.height / 2 - 10);
      if (!hasPoint) { ctx.moveTo(x, y); hasPoint = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  drawGrid(ctx, width, height) {
    ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 1;
    for (let row = 1; row < 4; row += 1) { const y = (height / 4) * row; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.strokeStyle = "rgba(255,255,255,.17)"; ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
  }
}

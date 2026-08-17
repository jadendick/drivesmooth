export class EventStateMachine {
  constructor(definition, config) { this.definition = definition; this.config = config; this.reset(); }
  reset() { this.state = "idle"; this.startCount = 0; this.endCount = 0; this.event = null; }
  process(sample) {
    const force = sample.smooth[this.definition.axis] * this.definition.direction;
    const aboveStart = force >= this.config.eventStartThresholdG;
    const belowEnd = force < this.config.eventEndThresholdG;
    if (this.state === "idle") {
      this.startCount = aboveStart ? this.startCount + 1 : 0;
      if (this.startCount >= this.config.startConfirmationSamples) this.begin(sample);
      return { active: this.event, completed: null };
    }
    this.add(sample, force);
    if (belowEnd) this.endCount += 1; else this.endCount = 0;
    if (this.endCount >= this.config.endConfirmationSamples) return { active: null, completed: this.complete(sample.timestamp) };
    return { active: this.event, completed: null };
  }
  begin(sample) {
    this.state = "active"; this.endCount = 0;
    this.event = { id: crypto.randomUUID(), type: this.definition.id, name: this.definition.name, axis: this.definition.axis, direction: this.definition.direction, startedAt: sample.timestamp, endedAt: null, samples: [] };
    this.add(sample, sample.smooth[this.definition.axis] * this.definition.direction);
  }
  add(sample, directedForce) {
    const magnitude = Math.max(0, directedForce);
    this.event.samples.push({ timestamp: sample.timestamp, raw: { ...sample.raw }, smooth: { ...sample.smooth }, magnitude });
  }
  complete(endedAt) {
    const event = this.event; event.endedAt = endedAt;
    event.durationMs = Math.max(0, event.endedAt - event.startedAt);
    const forces = event.samples.map((sample) => sample.magnitude);
    event.averageForce = forces.reduce((sum, force) => sum + force, 0) / forces.length;
    event.peakForce = Math.max(...forces);
    const deltas = forces.slice(1).map((force, index) => Math.abs(force - forces[index]));
    const meanDelta = deltas.length ? deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length : 0;
    event.smoothness = Math.max(0, Math.round(100 * (1 - Math.min(1, meanDelta / .025))));
    this.reset(); return event;
  }
  finalize(timestamp) { return this.event ? this.complete(timestamp) : null; }
}

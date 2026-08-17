import { EVENT_DEFINITIONS } from "../config.js";
import { EventStateMachine } from "./event-state-machine.js";

export class AppState {
  constructor(config) {
    this.config = config;
    this.recording = false;
    this.liveSamples = [];
    this.completedEvents = [];
    this.activeEvents = new Map();
    this.eventVersion = 0;
    this.selectedEventId = null;
    this.latestSample = null;
    this.rateTimestamps = [];
    this.machines = EVENT_DEFINITIONS.map((definition) => new EventStateMachine(definition, config));
    this.recordingStartedAt = 0;
  }
  start(now) { this.recording = true; this.recordingStartedAt = now; this.liveSamples = []; this.activeEvents.clear(); this.machines.forEach((machine) => machine.reset()); this.eventVersion += 1; }
  addSample(sample) {
    this.latestSample = sample;
    this.rateTimestamps.push(sample.timestamp);
    while (this.rateTimestamps[0] < sample.timestamp - 1000) this.rateTimestamps.shift();
    if (!this.recording) return;
    this.liveSamples.push(sample);
    while (this.liveSamples[0]?.timestamp < sample.timestamp - this.config.liveHistoryMs) this.liveSamples.shift();
    for (const machine of this.machines) {
      const { active, completed } = machine.process(sample);
      if (active && !this.activeEvents.has(active.id)) { this.activeEvents.set(active.id, active); this.eventVersion += 1; }
      if (completed) { this.activeEvents.delete(completed.id); this.completedEvents.unshift(completed); this.eventVersion += 1; }
    }
  }
  stop(now) {
    if (!this.recording) return;
    for (const machine of this.machines) {
      const completed = machine.finalize(now);
      if (completed) { this.activeEvents.delete(completed.id); this.completedEvents.unshift(completed); this.eventVersion += 1; }
    }
    this.recording = false;
  }
  get sampleRate() { return Math.max(0, this.rateTimestamps.length - 1); }
  get selectedEvent() { return this.completedEvents.find((event) => event.id === this.selectedEventId) || null; }
  selectEvent(id) { this.selectedEventId = id; this.eventVersion += 1; }
  showLive() { this.selectedEventId = null; this.eventVersion += 1; }
}

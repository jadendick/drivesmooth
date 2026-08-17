const formatG = (value) => `${value.toFixed(2)} g`;
const formatDuration = (milliseconds) => `${(milliseconds / 1000).toFixed(milliseconds < 10_000 ? 1 : 0)}s`;

export class Dashboard {
  constructor({ state, onCalibrate, onToggleRecording, onShowLive, onSelectEvent }) {
    this.state = state;
    this.elements = {
      status: document.querySelector("#status-message"), mode: document.querySelector("#input-mode"), calibrate: document.querySelector("#calibrate-button"), record: document.querySelector("#record-button"),
      x: document.querySelector("#x-reading"), y: document.querySelector("#y-reading"), rawX: document.querySelector("#x-raw-reading"), rawY: document.querySelector("#y-raw-reading"), rate: document.querySelector("#sample-rate"), time: document.querySelector("#recording-time"),
      title: document.querySelector("#chart-title"), liveView: document.querySelector("#live-view-button"), log: document.querySelector("#event-log"), count: document.querySelector("#event-count"),
    };
    this.lastEventVersion = -1;
    this.elements.calibrate.addEventListener("click", onCalibrate); this.elements.record.addEventListener("click", onToggleRecording); this.elements.liveView.addEventListener("click", onShowLive);
    this.elements.log.addEventListener("click", (event) => { const button = event.target.closest("button[data-event-id]"); if (button) onSelectEvent(button.dataset.eventId); });
  }
  setStatus(message) { this.elements.status.textContent = message; }
  setMode(simulating) { this.elements.mode.textContent = simulating ? "Simulator" : "Motion"; }
  setCalibrating(active) { this.elements.calibrate.disabled = active; this.elements.calibrate.textContent = active ? "Calibrating…" : "Calibrate"; }
  render(now) {
    const sample = this.state.latestSample;
    if (sample) { this.elements.x.textContent = formatG(sample.smooth.x); this.elements.y.textContent = formatG(sample.smooth.y); this.elements.rawX.textContent = formatG(sample.raw.x); this.elements.rawY.textContent = formatG(sample.raw.y); }
    this.elements.rate.textContent = `${this.state.sampleRate} Hz`;
    this.elements.record.textContent = this.state.recording ? "Stop drive" : "Start drive";
    this.elements.record.classList.toggle("is-recording", this.state.recording);
    this.elements.time.textContent = this.state.recording ? `Recording ${formatDuration(now - this.state.recordingStartedAt)}` : "Not recording";
    const selected = this.state.selectedEvent;
    this.elements.title.textContent = selected ? `${selected.name} event` : "Live forces";
    this.elements.liveView.hidden = !selected;
    if (this.lastEventVersion !== this.state.eventVersion) {
      this.renderEvents(selected);
      this.lastEventVersion = this.state.eventVersion;
    }
  }
  renderEvents(selected) {
    const active = [...this.state.activeEvents.values()]; const complete = this.state.completedEvents;
    this.elements.count.textContent = `${complete.length} saved`;
    if (!active.length && !complete.length) { this.elements.log.innerHTML = '<p class="empty-state">Start a drive to detect acceleration, braking, and cornering events.</p>'; return; }
    this.elements.log.innerHTML = [...active, ...complete].map((event) => {
      const isLive = !event.endedAt; const duration = (event.endedAt || performance.now()) - event.startedAt;
      const metrics = isLive ? "Measuring force…" : `avg ${formatG(event.averageForce)} · peak ${formatG(event.peakForce)} · smooth ${event.smoothness}`;
      return `<button class="event-item ${selected?.id === event.id ? "is-selected" : ""}" type="button" data-event-id="${event.id}" ${isLive ? "disabled" : ""}><span class="event-topline"><span class="event-name">${event.name}</span>${isLive ? '<span class="event-live">Live</span>' : `<span>${formatDuration(duration)}</span>`}</span><span class="event-metrics">${metrics}</span></button>`;
    }).join("");
  }
}

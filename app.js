const GRAVITY = 9.80665;
const CALIBRATION_MS = 3000;
const DISPLAY_SMOOTHING = 0.16;
const FORCE_PAD_RANGE_G = 0.55;
const JERK_SPIKE_THRESHOLD_G_PER_S = 0.9;

const elements = {
  motionButton: document.querySelector("#motion-button"),
  calibrateButton: document.querySelector("#calibrate-button"),
  recordButton: document.querySelector("#record-button"),
  status: document.querySelector("#sensor-status"),
  message: document.querySelector("#sensor-message"),
  sampleRate: document.querySelector("#sample-rate"),
  sampleCount: document.querySelector("#sample-count"),
  lateral: document.querySelector("#lateral-value"),
  longitudinal: document.querySelector("#longitudinal-value"),
  rawX: document.querySelector("#raw-x"),
  rawY: document.querySelector("#raw-y"),
  rawZ: document.querySelector("#raw-z"),
  correctedX: document.querySelector("#corrected-x"),
  correctedY: document.querySelector("#corrected-y"),
  correctedZ: document.querySelector("#corrected-z"),
  forceDot: document.querySelector("#force-dot"),
  forceStrength: document.querySelector("#force-strength"),
  recordingState: document.querySelector("#recording-state"),
  recordingDuration: document.querySelector("#recording-duration"),
  recordingSamples: document.querySelector("#recording-samples"),
  summaryPanel: document.querySelector("#summary-panel"),
  summaryDuration: document.querySelector("#summary-duration"),
  summarySamples: document.querySelector("#summary-samples"),
  summaryRate: document.querySelector("#summary-rate"),
  summaryBrake: document.querySelector("#summary-brake"),
  summaryAccel: document.querySelector("#summary-accel"),
  summaryLateral: document.querySelector("#summary-lateral"),
  summaryAvgJerk: document.querySelector("#summary-avg-jerk"),
  summaryMaxJerk: document.querySelector("#summary-max-jerk"),
  summaryJerkSpikes: document.querySelector("#summary-jerk-spikes")
};

const state = {
  enabled: false,
  calibrating: false,
  sampleCount: 0,
  rateWindow: [],
  latestRaw: null,
  smoothed: null,
  baseline: { x: 0, y: 0, z: 0 },
  recording: false,
  recordingStartedAt: 0,
  recordingTimer: null,
  recordingSamples: [],
  previousRecordingSample: null
};

elements.motionButton.addEventListener("click", enableMotion);
elements.calibrateButton.addEventListener("click", calibrate);
elements.recordButton.addEventListener("click", toggleRecording);

async function enableMotion() {
  if (!("DeviceMotionEvent" in window)) {
    setStatus("Motion unavailable", "This browser does not expose DeviceMotionEvent.");
    return;
  }

  try {
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      const result = await DeviceMotionEvent.requestPermission();

      if (result !== "granted") {
        setStatus("Permission denied", "Motion access was not granted.");
        return;
      }
    }

    if (!state.enabled) {
      window.addEventListener("devicemotion", handleMotion);
      state.enabled = true;
    }

    elements.motionButton.disabled = true;
    elements.calibrateButton.disabled = false;
    elements.recordButton.disabled = false;
    setStatus("Motion enabled", "Readings should update when the phone moves.");
  } catch (error) {
    setStatus("Permission failed", error.message || "Motion access could not be started.");
  }
}

function handleMotion(event) {
  const source = event.accelerationIncludingGravity || event.acceleration;

  if (!source) {
    setStatus("No acceleration", "Motion events are arriving without acceleration data.");
    return;
  }

  const raw = {
    x: toG(source.x),
    y: toG(source.y),
    z: toG(source.z)
  };

  const corrected = {
    x: raw.x - state.baseline.x,
    y: raw.y - state.baseline.y,
    z: raw.z - state.baseline.z
  };

  state.latestRaw = raw;
  state.smoothed = smooth(state.smoothed, corrected);
  state.sampleCount += 1;
  updateRate(event.timeStamp);
  recordSample(event.timeStamp, raw, corrected);
  renderReadings(raw, state.smoothed);
}

function toggleRecording() {
  if (state.recording) {
    stopRecording();
    return;
  }

  startRecording();
}

function startRecording() {
  if (!state.enabled || !state.latestRaw) {
    setStatus("No motion yet", "Enable motion and wait for readings before recording.");
    return;
  }

  state.recording = true;
  state.recordingStartedAt = performance.now();
  state.recordingSamples = [];
  state.previousRecordingSample = null;
  elements.summaryPanel.hidden = true;
  elements.recordButton.textContent = "Stop Recording";
  elements.recordButton.classList.add("is-recording");
  elements.calibrateButton.disabled = true;
  setStatus("Recording", "Collecting calibrated motion samples in memory.");
  updateRecordingDisplay();

  state.recordingTimer = window.setInterval(updateRecordingDisplay, 250);
}

function stopRecording() {
  state.recording = false;
  window.clearInterval(state.recordingTimer);
  state.recordingTimer = null;
  elements.recordButton.textContent = "Start Recording";
  elements.recordButton.classList.remove("is-recording");
  elements.calibrateButton.disabled = false;
  updateRecordingDisplay();

  const summary = summarizeRecording(state.recordingSamples);
  renderSummary(summary);
  setStatus("Recording stopped", "Summary calculated from this in-memory recording.");
}

function recordSample(timestamp, raw, corrected) {
  if (!state.recording) {
    return;
  }

  const previous = state.previousRecordingSample;
  const dt = previous ? Math.max((timestamp - previous.timestamp) / 1000, 0) : 0;
  const jerkLongitudinal = previous && dt > 0 ? (corrected.y - previous.longitudinal) / dt : 0;
  const jerkLateral = previous && dt > 0 ? (corrected.x - previous.lateral) / dt : 0;
  const jerkMagnitude = Math.hypot(jerkLongitudinal, jerkLateral);
  const sample = {
    timestamp,
    rawX: raw.x,
    rawY: raw.y,
    rawZ: raw.z,
    x: corrected.x,
    y: corrected.y,
    z: corrected.z,
    lateral: corrected.x,
    longitudinal: corrected.y,
    vertical: corrected.z,
    jerkLongitudinal,
    jerkLateral,
    jerkMagnitude
  };

  state.recordingSamples.push(sample);
  state.previousRecordingSample = sample;
  elements.recordingSamples.textContent = String(state.recordingSamples.length);
}

async function calibrate() {
  if (!state.latestRaw || state.calibrating) {
    return;
  }

  state.calibrating = true;
  elements.calibrateButton.disabled = true;
  setStatus("Calibrating", "Keep the phone still and screen-up for 3 seconds.");

  const samples = [];
  const start = performance.now();

  await new Promise((resolve) => {
    const timer = window.setInterval(() => {
      if (state.latestRaw) {
        samples.push({ ...state.latestRaw });
      }

      if (performance.now() - start >= CALIBRATION_MS) {
        window.clearInterval(timer);
        resolve();
      }
    }, 50);
  });

  state.baseline = average(samples);
  state.calibrating = false;
  elements.calibrateButton.disabled = false;
  setStatus("Calibrated", "Corrected values now subtract the stationary baseline.");
}

function updateRate(timestamp) {
  state.rateWindow.push(timestamp);

  while (state.rateWindow.length > 0 && timestamp - state.rateWindow[0] > 1000) {
    state.rateWindow.shift();
  }
}

function renderReadings(raw, corrected) {
  elements.sampleCount.textContent = String(state.sampleCount);
  elements.sampleRate.textContent = `${state.rateWindow.length} Hz`;

  elements.rawX.textContent = formatG(raw.x);
  elements.rawY.textContent = formatG(raw.y);
  elements.rawZ.textContent = formatG(raw.z);

  elements.correctedX.textContent = formatG(corrected.x);
  elements.correctedY.textContent = formatG(corrected.y);
  elements.correctedZ.textContent = formatG(corrected.z);

  elements.lateral.textContent = formatG(corrected.x);
  elements.longitudinal.textContent = formatG(corrected.y);

  renderForceDot(corrected);
}

function updateRecordingDisplay() {
  elements.recordingState.textContent = state.recording ? "Recording" : "Idle";
  elements.recordingDuration.textContent = formatDuration(getRecordingDurationMs());
  elements.recordingSamples.textContent = String(state.recordingSamples.length);
}

function renderForceDot(corrected) {
  const x = clamp(corrected.x / FORCE_PAD_RANGE_G, -1, 1);
  const y = clamp(corrected.y / FORCE_PAD_RANGE_G, -1, 1);
  const magnitude = Math.hypot(corrected.x, corrected.y);

  elements.forceDot.style.left = `${50 + x * 42}%`;
  elements.forceDot.style.top = `${50 + y * -42}%`;
  elements.forceStrength.textContent = formatG(magnitude);
}

function average(samples) {
  if (samples.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  const total = samples.reduce(
    (sum, sample) => ({
      x: sum.x + sample.x,
      y: sum.y + sample.y,
      z: sum.z + sample.z
    }),
    { x: 0, y: 0, z: 0 }
  );

  return {
    x: total.x / samples.length,
    y: total.y / samples.length,
    z: total.z / samples.length
  };
}

function summarizeRecording(samples) {
  if (samples.length === 0) {
    return {
      durationMs: 0,
      sampleCount: 0,
      averageRate: 0,
      maxBrake: 0,
      maxAccel: 0,
      maxLateral: 0,
      averageJerk: 0,
      maxJerk: 0,
      jerkSpikes: 0
    };
  }

  const first = samples[0];
  const last = samples[samples.length - 1];
  const durationMs = Math.max(last.timestamp - first.timestamp, 0);
  const durationSeconds = durationMs / 1000;
  const totals = samples.reduce(
    (stats, sample) => ({
      maxBrake: Math.max(stats.maxBrake, sample.longitudinal),
      maxAccel: Math.max(stats.maxAccel, -sample.longitudinal),
      maxLateral: Math.max(stats.maxLateral, Math.abs(sample.lateral)),
      jerkTotal: stats.jerkTotal + sample.jerkMagnitude,
      maxJerk: Math.max(stats.maxJerk, sample.jerkMagnitude),
      jerkSpikes:
        stats.jerkSpikes + (sample.jerkMagnitude >= JERK_SPIKE_THRESHOLD_G_PER_S ? 1 : 0)
    }),
    {
      maxBrake: 0,
      maxAccel: 0,
      maxLateral: 0,
      jerkTotal: 0,
      maxJerk: 0,
      jerkSpikes: 0
    }
  );

  return {
    durationMs,
    sampleCount: samples.length,
    averageRate: durationSeconds > 0 ? samples.length / durationSeconds : 0,
    maxBrake: totals.maxBrake,
    maxAccel: totals.maxAccel,
    maxLateral: totals.maxLateral,
    averageJerk: totals.jerkTotal / samples.length,
    maxJerk: totals.maxJerk,
    jerkSpikes: totals.jerkSpikes
  };
}

function renderSummary(summary) {
  elements.summaryPanel.hidden = false;
  elements.summaryDuration.textContent = formatDuration(summary.durationMs);
  elements.summarySamples.textContent = String(summary.sampleCount);
  elements.summaryRate.textContent = `${summary.averageRate.toFixed(0)} Hz`;
  elements.summaryBrake.textContent = formatG(summary.maxBrake);
  elements.summaryAccel.textContent = formatG(summary.maxAccel);
  elements.summaryLateral.textContent = formatG(summary.maxLateral);
  elements.summaryAvgJerk.textContent = formatJerk(summary.averageJerk);
  elements.summaryMaxJerk.textContent = formatJerk(summary.maxJerk);
  elements.summaryJerkSpikes.textContent = String(summary.jerkSpikes);
}

function toG(value) {
  return Number.isFinite(value) ? value / GRAVITY : 0;
}

function smooth(previous, next) {
  if (!previous) {
    return { ...next };
  }

  return {
    x: previous.x + (next.x - previous.x) * DISPLAY_SMOOTHING,
    y: previous.y + (next.y - previous.y) * DISPLAY_SMOOTHING,
    z: previous.z + (next.z - previous.z) * DISPLAY_SMOOTHING
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatG(value) {
  return `${value.toFixed(2)} g`;
}

function formatJerk(value) {
  return `${value.toFixed(2)} g/s`;
}

function getRecordingDurationMs() {
  if (!state.recording) {
    const samples = state.recordingSamples;
    return samples.length > 1 ? samples[samples.length - 1].timestamp - samples[0].timestamp : 0;
  }

  return performance.now() - state.recordingStartedAt;
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(Math.floor(milliseconds / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function setStatus(status, message) {
  elements.status.textContent = status;
  elements.message.textContent = message;
}

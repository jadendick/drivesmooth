const GRAVITY = 9.80665;
const CALIBRATION_MS = 2000;
const DISPLAY_SMOOTHING = 0.5;
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
  summaryJerkSpikes: document.querySelector("#summary-jerk-spikes"),

  brakeEvents: document.querySelector("#brake-events"),
  brakeMaxG: document.querySelector("#brake-max-g"),
  brakeAvgG: document.querySelector("#brake-avg-g"),
  brakeScore: document.querySelector("#brake-score"),

  accelEvents: document.querySelector("#accel-events"),
  accelMaxG: document.querySelector("#accel-max-g"),
  accelAvgG: document.querySelector("#accel-avg-g"),
  accelScore: document.querySelector("#accel-score"),

  cornerEvents: document.querySelector("#corner-events"),
  cornerMaxG: document.querySelector("#corner-max-g"),
  cornerAvgG: document.querySelector("#corner-avg-g"),
  cornerScore: document.querySelector("#corner-score"),

  overallScore: document.querySelector("#summary-overall-score"),
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

const USE_SIMULATOR =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1";

async function enableMotion() {
  if (USE_SIMULATOR) {
    startSimulator();
  }

  if (!("DeviceMotionEvent" in window)) {
    setStatus("Motion unavailable", "This browser does not expose DeviceMotionEvent.");
    return false;
  }

  try {
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      const result = await DeviceMotionEvent.requestPermission();

      if (result !== "granted") {
        setStatus("Permission denied", "Motion access was not granted.");
        return false;
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
    return true;
  } catch (error) {
    setStatus("Permission failed", error.message || "Motion access could not be started.");
    return false;
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
  state.displayReading = state.smoothed;
}

function startSimulator() {

    const STEP_MS = 1000 / 60;

    let start = performance.now();

    setInterval(() => {

        const elapsed = (performance.now() - start) / 1000;

        let longitudinal = 0;
        let lateral = 0;

        // 0-2s idle

        if (elapsed < 2) {

        }

        // 2-5s accelerate to 0.35g

        else if (elapsed < 5) {

            const p = (elapsed - 2) / 3;
            longitudinal = 0.35 * Math.sin(p * Math.PI);

        }

        // 5-7s coast

        else if (elapsed < 7) {

        }

        // 7-10s brake to 0.55g

        else if (elapsed < 10) {

            const p = (elapsed - 7) / 3;
            longitudinal = -0.55 * Math.sin(p * Math.PI);

        }

        // 10-12s coast

        else if (elapsed < 12) {

        }

        // 12-16s right turn at 0.40g

        else if (elapsed < 16) {

            const p = (elapsed - 12) / 4;
            lateral = 0.40 * Math.sin(p * Math.PI);

        }

        // restart

        else {

            start = performance.now();
            return;

        }

        handleMotion({
          accelerationIncludingGravity: {
            x: lateral,
            y: longitudinal,
            z: 1,
          }
        });

    }, STEP_MS);
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
  // elements.summaryPanel.hidden = true;
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

  // const summary = summarizeRecording(state.recordingSamples);
  // renderSummary(summary);


  const brakingSummary =
    summarizeEvents(drivingEvents.braking);

  const accelSummary =
    summarizeEvents(drivingEvents.acceleration);

  const cornerSummary =
    summarizeEvents(drivingEvents.cornering);


  renderCategory(brakingSummary, "brake");
  renderCategory(accelSummary, "accel");
  renderCategory(cornerSummary, "corner");

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

  const now = performance.now();

  processAxis(
    "braking",
    -sample.longitudinal,
    jerkLongitudinal,
    now
  );

  processAxis(
    "acceleration",
    sample.longitudinal,
    jerkLongitudinal,
    now
  );

  processAxis(
    "cornering",
    Math.abs(sample.lateral),
    jerkLateral,
    now);
}

function renderCategory(summary, prefix) {
console.log(summary, prefix)
  elements[`${prefix}Events`].textContent =
    summary.events;

  elements[`${prefix}MaxG`].textContent =
    `${summary.maxG.toFixed(2)} g`;

  elements[`${prefix}AvgG`].textContent =
    `${summary.avgG.toFixed(2)} g`;

  elements[`${prefix}Score`].textContent =
    `${Math.round(summary.smoothness)}`;
}

async function calibrate() {
  if (!state.enabled) {
    const enabled = await enableMotion();

    if (!enabled) {
      return;
    }
  }

  if (state.calibrating) {
    return;
  }

  if (!state.latestRaw) {
    setStatus("Waiting for motion", "Keep the phone still while the first readings arrive.");
    await waitForFirstSample();
  }

  if (!state.latestRaw) {
    setStatus("No readings yet", "Motion is enabled, but acceleration samples have not arrived.");
    return;
  }

  state.calibrating = true;
  elements.calibrateButton.disabled = true;
  setStatus("Calibrating", "Keep the phone still and screen-up for 2 seconds.");

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

function renderReadings(corrected) {
  elements.sampleCount.textContent = String(state.sampleCount);
  elements.sampleRate.textContent = `${state.rateWindow.length} Hz`;

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

  const DISPLAY_G = 1.0;      // edge of the square
  const DISPLAY_RANGE = 46;   // % from center to edge

  const px = Math.max(-1, Math.min(1, x / DISPLAY_G));
  const py = Math.max(-1, Math.min(1, y / DISPLAY_G));

  const tx = px * DISPLAY_RANGE;
  const ty = -py * DISPLAY_RANGE;

  elements.forceDot.style.transform =
    `translate(calc(-50% + ${tx}%), calc(-50% + ${ty}%))`;

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

function waitForFirstSample() {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      if (state.latestRaw || performance.now() - startedAt > 1500) {
        window.clearInterval(timer);
        resolve();
      }
    }, 50);
  });
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
  if (Math.abs(value) < 0.005) {
    value = 0;
  }

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

// ---------- Driving Event Detection ----------

const EVENT_THRESHOLD = 0.05;     // g
const EVENT_RELEASE = 0.02;       // hysteresis
const JERK_SPIKE = 0.5;           // g/s

const drivingEvents = {
  braking: [],
  acceleration: [],
  cornering: []
};

const activeEvents = {
  braking: null,
  acceleration: null,
  cornering: null
};

function beginEvent(type, g, jerk, timestamp) {
  activeEvents[type] = {
    start: timestamp,
    end: timestamp,

    samples: 0,

    peakG: Math.abs(g),
    sumG: Math.abs(g),

    peakJerk: Math.abs(jerk),
    jerkSquared: jerk * jerk,

    spikes: Math.abs(jerk) > JERK_SPIKE ? 1 : 0,

    timeToPeak: 0
  };
}

function updateEvent(type, g, jerk, timestamp) {

  const e = activeEvents[type];

  e.end = timestamp;
  e.samples++;

  const absG = Math.abs(g);
  const absJerk = Math.abs(jerk);

  e.sumG += absG;
  e.jerkSquared += jerk * jerk;

  if (absG > e.peakG) {
    e.peakG = absG;
    e.timeToPeak = timestamp - e.start;
  }

  if (absJerk > e.peakJerk)
    e.peakJerk = absJerk;

  if (absJerk > JERK_SPIKE)
    e.spikes++;
}

function endEvent(type) {

  const e = activeEvents[type];
  if (!e) return;

  e.duration = e.end - e.start;
  e.averageG = e.sumG / Math.max(1, e.samples);
  e.rmsJerk = Math.sqrt(e.jerkSquared / Math.max(1, e.samples));

  drivingEvents[type].push(e);

  activeEvents[type] = null;
}

function processAxis(type, value, jerk, now) {

  const active = activeEvents[type];

  if (!active && value > EVENT_THRESHOLD) {
    beginEvent(type, value, jerk, now);
    return;
  }

  if (active) {

    updateEvent(type, value, jerk, now);

    if (value < EVENT_RELEASE)
      endEvent(type);
  }
}

function summarizeEvents(events) {

  if (!events.length)
    return {
      events: 0,
      maxG: 0,
      avgG: 0,
      smoothness: 100
    };

  const maxG =
    Math.max(...events.map(e => e.peakG));

  const avgG =
    events.reduce((s, e) => s + e.averageG, 0) / events.length;

  const avgRms =
    events.reduce((s, e) => s + e.rmsJerk, 0) / events.length;

  const spikes =
    events.reduce((s, e) => s + e.spikes, 0);

  // Temporary scoring model
  let score = 100;

  score -= avgRms * 20;
  score -= spikes * 2;

  score = Math.max(0, Math.min(100, score));

  return {
    events: events.length,
    maxG,
    avgG,
    smoothness: score,
    avgRms,
    spikes
  };
}




function animationLoop() {
  if (state.displayReading) {
    renderReadings(state.displayReading);
  }

  requestAnimationFrame(animationLoop);
}

requestAnimationFrame(animationLoop);
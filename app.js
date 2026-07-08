const GRAVITY = 9.80665;
const CALIBRATION_MS = 3000;
const DISPLAY_SMOOTHING = 0.16;
const FORCE_PAD_RANGE_G = 0.55;

const elements = {
  motionButton: document.querySelector("#motion-button"),
  calibrateButton: document.querySelector("#calibrate-button"),
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
  forceStrength: document.querySelector("#force-strength")
};

const state = {
  enabled: false,
  calibrating: false,
  sampleCount: 0,
  rateWindow: [],
  latestRaw: null,
  smoothed: null,
  baseline: { x: 0, y: 0, z: 0 }
};

elements.motionButton.addEventListener("click", enableMotion);
elements.calibrateButton.addEventListener("click", calibrate);

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
  renderReadings(raw, state.smoothed);
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

function setStatus(status, message) {
  elements.status.textContent = status;
  elements.message.textContent = message;
}

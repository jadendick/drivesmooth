import { CONFIG } from "./config.js";
import { Calibration } from "./processing/calibration.js";
import { smoothForce } from "./processing/force-smoother.js";
import { DeviceMotionInput } from "./input/device-motion.js";
import { LocalhostSimulator } from "./input/localhost-simulator.js";
import { AppState } from "./state/app-state.js";
import { ForceChart } from "./charts/force-chart.js";
import { Dashboard } from "./ui/dashboard.js";

const useSimulator = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
const calibration = new Calibration();
const state = new AppState(CONFIG);
let input; let dashboard; let calibrationTimer = null; let chartDirty = true;

const xChart = new ForceChart(document.querySelector("#x-chart"), "x", "#85b8ff", CONFIG);
const yChart = new ForceChart(document.querySelector("#y-chart"), "y", "#48d597", CONFIG);

function handleInput(reading) {
  if (calibration.active) calibration.add(reading);
  const raw = calibration.apply(reading); const smooth = smoothForce(raw);
  state.addSample({ timestamp: reading.timestamp, raw, smooth }); chartDirty = true;
}

input = useSimulator ? new LocalhostSimulator(handleInput) : new DeviceMotionInput(handleInput);
dashboard = new Dashboard({ state, onCalibrate: calibrate, onToggleRecording: toggleRecording, onShowLive: () => { state.showLive(); chartDirty = true; }, onSelectEvent: (id) => { state.selectEvent(id); chartDirty = true; } });
dashboard.setMode(useSimulator);

async function ensureInput() { await input.requestPermission(); input.start(); }

async function calibrate() {
  try {
    dashboard.setCalibrating(true); dashboard.setStatus("Hold still — zeroing forces");
    await ensureInput(); calibration.begin(CONFIG.calibrationMs, performance.now());
    window.clearTimeout(calibrationTimer);
    calibrationTimer = window.setTimeout(() => {
      const success = calibration.finish(); dashboard.setCalibrating(false);
      dashboard.setStatus(success ? "Calibrated — ready to drive" : "No readings received — try again");
      if (!state.recording) input.stop();
    }, CONFIG.calibrationMs);
  } catch (error) { dashboard.setCalibrating(false); dashboard.setStatus(error.message || "Could not access motion data"); }
}

async function toggleRecording() {
  if (state.recording) {
    state.stop(performance.now()); input.stop(); dashboard.setStatus("Drive stopped — events saved in memory"); chartDirty = true; return;
  }
  try {
    await ensureInput(); state.start(performance.now()); dashboard.setStatus("Recording drive events"); chartDirty = true;
  } catch (error) { dashboard.setStatus(error.message || "Could not start motion data"); }
}

function render(now) {
  dashboard.render(now);
  if (chartDirty || state.recording) {
    const selected = state.selectedEvent;
    const samples = selected?.samples || state.liveSamples;
    const end = selected?.endedAt || now;
    const durationMs = selected?.durationMs || CONFIG.liveHistoryMs;
    xChart.draw(samples, { durationMs, now: end }); yChart.draw(samples, { durationMs, now: end }); chartDirty = false;
  }
  requestAnimationFrame(render);
}

requestAnimationFrame(render);

const MEDIAN_WINDOW_SIZE = 3;

let samples = [];
let filteredForce = null;
let previousTimestamp = null;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function resetForceSmoother() {
  samples = [];
  filteredForce = null;
  previousTimestamp = null;
}

// Reject isolated road-bump spikes, then apply a timestamp-based low-pass filter.
export function smoothForce(rawForce, timestamp, tauMs) {
  samples.push({ x: rawForce.x, y: rawForce.y });
  if (samples.length > MEDIAN_WINDOW_SIZE) samples.shift();

  const medianForce = {
    x: median(samples.map((sample) => sample.x)),
    y: median(samples.map((sample) => sample.y)),
  };

  if (!filteredForce || !Number.isFinite(previousTimestamp) || timestamp <= previousTimestamp) {
    filteredForce = medianForce;
    previousTimestamp = timestamp;
    return { ...filteredForce };
  }

  const elapsedMs = timestamp - previousTimestamp;
  const safeTauMs = Math.max(1, Number(tauMs) || 250);
  const alpha = 1 - Math.exp(-elapsedMs / safeTauMs);
  filteredForce = {
    x: filteredForce.x + alpha * (medianForce.x - filteredForce.x),
    y: filteredForce.y + alpha * (medianForce.y - filteredForce.y),
  };
  previousTimestamp = timestamp;
  return { ...filteredForce };
}

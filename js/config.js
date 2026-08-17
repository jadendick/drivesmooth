export const CONFIG = {
  gravity: 9.80665,
  calibrationMs: 1000,
  liveHistoryMs: 10_000,
  maxDisplayForceG: 1,
  eventStartThresholdG: 0.12,
  eventEndThresholdG: 0.07,
  startConfirmationSamples: 3,
  endConfirmationSamples: 4,
};

export const EVENT_DEFINITIONS = [
  { id: "accelerating", name: "Acceleration", axis: "y", direction: 1, color: "#48d597" },
  { id: "braking", name: "Braking", axis: "y", direction: -1, color: "#ff8b73" },
  { id: "right-turn", name: "Right corner", axis: "x", direction: 1, color: "#85b8ff" },
  { id: "left-turn", name: "Left corner", axis: "x", direction: -1, color: "#c7a6ff" },
];

const STORAGE_KEY = "drivesmooth.settings.v1";
const DEFAULT_SETTINGS = Object.freeze({ xRangeG: 1, yRangeG: 1, phoneForward: "bottom" });
const VALID_DIRECTIONS = new Set(["top", "bottom", "left", "right"]);

function validRange(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(3, Math.max(.25, number)) : fallback;
}

export function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      xRangeG: validRange(stored.xRangeG, DEFAULT_SETTINGS.xRangeG),
      yRangeG: validRange(stored.yRangeG, DEFAULT_SETTINGS.yRangeG),
      phoneForward: VALID_DIRECTIONS.has(stored.phoneForward) ? stored.phoneForward : DEFAULT_SETTINGS.phoneForward,
    };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(settings) {
  const sanitized = {
    xRangeG: validRange(settings.xRangeG, DEFAULT_SETTINGS.xRangeG),
    yRangeG: validRange(settings.yRangeG, DEFAULT_SETTINGS.yRangeG),
    phoneForward: VALID_DIRECTIONS.has(settings.phoneForward) ? settings.phoneForward : DEFAULT_SETTINGS.phoneForward,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  return sanitized;
}

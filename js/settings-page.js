import { loadSettings, saveSettings } from "./settings.js";

const settings = loadSettings();
const form = document.querySelector("#settings-form");
form.elements.xRangeG.value = settings.xRangeG;
form.elements.yRangeG.value = settings.yRangeG;
form.elements.phoneForward.value = settings.phoneForward;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  saveSettings({
    xRangeG: form.elements.xRangeG.value,
    yRangeG: form.elements.yRangeG.value,
    phoneForward: form.elements.phoneForward.value,
  });
  location.assign("./index.html");
});

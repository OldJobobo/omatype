"use strict";

const QUICK_RESTART_KEYS = ["escape", "tab", "enter"];

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function decide(state, key, rawBehavior) {
  const behavior = object(rawBehavior);
  if (!state || typeof state !== "object" || state.completed) return "ignore";
  if (typeof state.target !== "string" || !Number.isInteger(state.cursor)
      || state.cursor < 0 || state.cursor >= state.target.length) return "ignore";
  if (key === "Backspace") return behavior.backspace === "off" ? "ignore" : "backspace";
  if (typeof key !== "string" || Array.from(key).length !== 1) return "ignore";
  const expected = state.target[state.cursor];
  if (behavior.strictSpace === true && key === " " && expected !== " ") return "ignore";
  if (behavior.stopOnError === "letter" && key !== expected) return "blocked-error";
  return "input";
}

function isQuickRestart(configured, pressed) {
  return QUICK_RESTART_KEYS.indexOf(configured) >= 0 && configured === pressed;
}

function shouldQuickEnd(mode, enabled, started) {
  return mode === "time" && enabled === true && started === true;
}

function completionFor(mode, amount, elapsedMs, requested) {
  const durationReached = mode === "time" && Number.isFinite(Number(amount))
    && Number.isFinite(Number(elapsedMs)) && Number(elapsedMs) >= Number(amount) * 1000;
  return requested === "quick-ended" && !durationReached ? "quick-ended" : "completed";
}

const api = {decide, isQuickRestart, shouldQuickEnd, completionFor};
if (typeof module !== "undefined" && module.exports) module.exports = api;

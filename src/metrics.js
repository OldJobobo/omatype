"use strict";

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(number, digits) {
  const factor = Math.pow(10, digits || 0);
  return Math.round(finite(number, 0) * factor) / factor;
}

function intervalWpm(currentKeystrokes, previousKeystrokes, elapsedMs) {
  const current = finite(currentKeystrokes, 0);
  const previous = finite(previousKeystrokes, 0);
  const elapsed = finite(elapsedMs, 0);
  if (elapsed <= 0) return 0;
  const delta = Math.max(0, current - previous);
  return round(delta / 5 / (elapsed / 60000), 2);
}

function summarize(input) {
  input = input || {};
  const minutes = Math.max(finite(input.elapsedMs, 0), 1) / 60000;
  const correct = Math.max(0, finite(input.correct, 0));
  const total = Math.max(0, finite(input.total, 0));
  const samples = (input.samples || []).filter(Number.isFinite);
  let consistency = 0;
  if (samples.length) {
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const variance = samples.reduce((a, b) => a + (b - mean) * (b - mean), 0) / samples.length;
    consistency = mean ? Math.max(0, 100 - Math.sqrt(variance) / mean * 100) : 0;
  }
  return {
    wpm: round(correct / 5 / minutes, 2),
    rawWpm: round(total / 5 / minutes, 2),
    accuracy: round(total ? correct / total * 100 : 100, 2),
    consistency: round(consistency, 2)
  };
}

if (typeof module !== "undefined") module.exports = {summarize, intervalWpm};

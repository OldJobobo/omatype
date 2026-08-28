"use strict";

function create(target) {
  return {
    target: String(target || ""),
    typed: [],
    status: [],
    cursor: 0,
    errors: 0,
    totalKeystrokes: 0,
    errorKeystrokes: 0,
    correctedErrors: 0,
    pendingErrors: 0,
    corrections: 0,
    startedAt: null,
    endedAt: null,
    completed: false
  };
}

function oneCodePoint(value) {
  if (typeof value !== "string" || Array.from(value).length !== 1) return null;
  return value;
}

function isPrintable(value) {
  const text = oneCodePoint(value);
  if (text === null) return false;
  const codePoint = text.codePointAt(0);
  return codePoint >= 0x20 && codePoint !== 0x7f;
}

function input(state, key, now) {
  if (!state || state.completed || !isPrintable(key)) return false;
  if (state.startedAt === null) state.startedAt = now;
  const expected = state.target[state.cursor];
  const status = key === expected ? "correct" : "error";
  if (status === "correct" && state.pendingErrors > 0) {
    state.errors = Math.max(0, state.errors - state.pendingErrors);
    state.correctedErrors += state.pendingErrors;
    state.pendingErrors = 0;
  }
  state.typed.push(key);
  state.status.push(status);
  state.totalKeystrokes++;
  if (status === "error") {
    state.errors++;
    state.errorKeystrokes++;
  }
  state.cursor++;
  if (state.cursor >= state.target.length) {
    state.completed = true;
    state.endedAt = now;
  }
  return true;
}

function blockError(state, key, now) {
  if (!state || state.completed || !isPrintable(key)) return false;
  if (state.startedAt === null) state.startedAt = now;
  state.totalKeystrokes++;
  state.errorKeystrokes++;
  state.errors++;
  state.pendingErrors++;
  return true;
}

function backspace(state) {
  if (!state || state.cursor === 0) return false;
  if (state.completed) {
    state.completed = false;
    state.endedAt = null;
  }
  state.cursor--;
  state.typed.pop();
  state.corrections++;
  if (state.status.pop() === "error") {
    state.errors--;
    state.correctedErrors++;
  }
  return true;
}

function reset(state) {
  return create(state.target);
}

const api = {create, input, blockError, backspace, reset, isPrintable};
if (typeof module !== "undefined" && module.exports) module.exports = api;

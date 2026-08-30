"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Policy = require("../src/input-policy.js");
const State = require("../src/typing-state.js");

const behavior = overrides => ({stopOnError: "off", strictSpace: false, backspace: "full", quickEnd: false, ...overrides});

test("strict space ignores a space typed before the expected separator", () => {
  const state = State.create("cat dog");
  assert.equal(Policy.decide(state, " ", behavior({strictSpace: true})), "ignore");
  assert.equal(Policy.decide(state, "c", behavior({strictSpace: true})), "input");
});

test("stop on error records effort without advancing and a correction clears the pending error", () => {
  const state = State.create("a");
  assert.equal(Policy.decide(state, "x", behavior({stopOnError: "letter"})), "blocked-error");
  State.blockError(state, "x", 1000);
  assert.equal(state.cursor, 0);
  assert.equal(state.totalKeystrokes, 1);
  assert.equal(state.errorKeystrokes, 1);
  assert.equal(state.errors, 1);
  State.input(state, "a", 1100);
  assert.equal(state.cursor, 1);
  assert.equal(state.errors, 0);
  assert.equal(state.correctedErrors, 1);
});

test("backspace and quick end policies return explicit actions", () => {
  const state = State.create("a");
  assert.equal(Policy.decide(state, "Backspace", behavior({backspace: "off"})), "ignore");
  assert.equal(Policy.decide(state, "Backspace", behavior()), "backspace");
  assert.equal(Policy.shouldQuickEnd("time", true, true), true);
  assert.equal(Policy.shouldQuickEnd("words", true, true), false);
  assert.equal(Policy.shouldQuickEnd("time", false, true), false);
});

test("timed completion wins at the exact duration boundary before the timer tick", () => {
  assert.equal(Policy.completionFor("time", 30, 29999, "quick-ended"), "quick-ended");
  assert.equal(Policy.completionFor("time", 30, 30000, "quick-ended"), "completed");
  assert.equal(Policy.completionFor("time", 30, 30001, "quick-ended"), "completed");
  assert.equal(Policy.completionFor("words", 25, 999999, "quick-ended"), "quick-ended");
  assert.equal(Policy.completionFor("words", 25, 1000), "completed");
});

test("malformed typing state fails closed without throwing", () => {
  for (const state of [{}, {cursor: 0}, {target: null, cursor: 0}, {target: "a", cursor: -1}]) {
    assert.doesNotThrow(() => Policy.decide(state, "a", behavior()));
    assert.equal(Policy.decide(state, "a", behavior()), "ignore");
  }
});

test("quick restart key matching is bounded and explicit", () => {
  assert.equal(Policy.isQuickRestart("tab", "tab"), true);
  assert.equal(Policy.isQuickRestart("escape", "tab"), false);
  assert.equal(Policy.isQuickRestart("enter", "enter"), true);
  assert.equal(Policy.isQuickRestart("off", "tab"), false);
  assert.equal(Policy.isQuickRestart("anything", "anything"), false);
});

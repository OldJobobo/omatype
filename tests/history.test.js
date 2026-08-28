"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const History = require("../src/history.js");
const Languages = require("../src/languages.js");

test("history normalization migrates malformed legacy input into bounded schema v1", () => {
  const input = {tests: [{timestamp: "2026-01-01", wpm: "42", accuracy: 101, mode: "wat"}, null], junk: true};
  const history = History.normalize(input);
  assert.equal(history.schemaVersion, 1);
  assert.equal(history.entries.length, 1);
  assert.equal(history.entries[0].wpm, 42);
  assert.equal(history.entries[0].accuracy, 100);
  assert.equal(history.entries[0].mode, "words");
});

test("adding results is newest-first and capped at one hundred", () => {
  let history = History.normalize();
  for (let index = 0; index < 105; index++) history = History.add(history, {timestamp: index, wpm: index});
  assert.equal(history.entries.length, 100);
  assert.equal(history.entries[0].wpm, 104);
  assert.equal(history.entries.at(-1).wpm, 5);
});

test("history preserves only known local language identifiers", () => {
  for (const option of Languages.options()) {
    assert.equal(History.cleanEntry({language: option.id}).language, option.id);
  }
  assert.equal(History.cleanEntry({language: "../../nix"}).language, "english");
});

test("history rejects non-finite telemetry and bounds untrusted strings and options", () => {
  const history = History.normalize({entries: [{
    timestamp: "x".repeat(10000), mode: "broken", amount: Infinity,
    wpm: Infinity, rawWpm: "Infinity", accuracy: NaN, consistency: -Infinity,
    characters: Infinity, errors: Infinity, corrected: Infinity,
    uncorrectedErrors: Infinity, corrections: Infinity, seed: "s".repeat(10000)
  }]});
  const entry = history.entries[0];
  for (const key of ["wpm", "rawWpm", "accuracy", "consistency", "characters", "errors", "corrected", "uncorrectedErrors", "corrections"])
    assert.ok(Number.isFinite(entry[key]), key);
  assert.equal(entry.mode, "words");
  assert.equal(entry.amount, 25);
  assert.ok(entry.seed.length <= 128);
  assert.ok(entry.timestamp.length <= 64);
});

"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const History = require("../src/history.js");
const Languages = require("../src/languages.js");

function run(index, extra) {
  const timestamp = new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString();
  return Object.assign({
    timestamp, mode: "time", amount: 30, language: "english", punctuation: false,
    numbers: false, completion: "completed", metricsVersion: 1, elapsedMs: 30000,
    localDay: "2026-01-01", timezoneOffsetMinutes: 0, wpm: 40 + index,
    rawWpm: 42 + index, accuracy: 98, consistency: 80, characters: 100,
    correct: 98, errors: 2, corrected: 2, uncorrectedErrors: 0, corrections: 2,
    seed: "seed-" + index, samples: [30, 40]
  }, extra || {});
}

test("history normalization migrates schema v1 without fabricating analytic context", () => {
  const input = {schemaVersion: 1, tests: [{timestamp: "2026-01-01", wpm: "42", accuracy: 101, mode: "wat", punctuation: true}, null], junk: true};
  const history = History.normalize(input);
  assert.equal(history.schemaVersion, 2);
  assert.equal(history.entries.length, 1);
  assert.equal(history.entries[0].wpm, 42);
  assert.equal(history.entries[0].accuracy, 100);
  assert.equal(history.entries[0].mode, "words");
  assert.equal(history.entries[0].punctuation, null);
  assert.equal(history.entries[0].numbers, null);
  assert.equal(history.entries[0].completion, "legacy-unknown");
  assert.equal(history.entries[0].metricsVersion, null);
  assert.equal(history.entries[0].localDay, null);
});

test("history accepts array-like QML JsonAdapter sequences for legacy tests", () => {
  const qmlSequence = {0: run(0), length: 1};
  const migrated = History.normalize({schemaVersion: 1, entries: {length: 0}, tests: qmlSequence});
  assert.equal(migrated.entries.length, 1);
  assert.equal(migrated.entries[0].wpm, 40);
  assert.equal(migrated.entries[0].completion, "legacy-unknown");
});

test("schema v2 normalization is deterministic, idempotent, deduplicated, and newest first", () => {
  const duplicate = run(1);
  const once = History.normalize({schemaVersion: 2, entries: [run(0), duplicate, duplicate]});
  const twice = History.normalize(once);
  assert.deepEqual(twice, once);
  assert.equal(once.entries.length, 2);
  assert.equal(once.entries[0].timestamp, duplicate.timestamp);
  assert.match(once.entries[0].id, /^run-/);
});

test("adding results replaces a duplicate id and keeps newest first", () => {
  let history = History.add(History.clear(), run(0));
  const replacement = Object.assign({}, run(1), {id: history.entries[0].id, wpm: 99});
  history = History.add(history, replacement);
  assert.equal(history.entries.length, 1);
  assert.equal(history.entries[0].wpm, 99);
});

test("history retains two thousand raw entries and compacts overflow without losing totals or PB", () => {
  const input = [];
  for (let index = 0; index < 2005; index++) input.push(run(index, {wpm: index === 0 ? 500 : 50}));
  const history = History.normalize({schemaVersion: 2, entries: input});
  assert.equal(history.entries.length, History.MAX_ENTRIES);
  assert.equal(history.rollups.reduce((sum, value) => sum + value.count, 0), 5);
  assert.equal(history.entries.length + history.rollups.reduce((sum, value) => sum + value.count, 0), 2005);
  const bestRollup = history.rollups.find(value => value.maxWpm === 500);
  assert.ok(bestRollup);
  assert.equal(bestRollup.maxWpmTimestamp, input[0].timestamp);
  assert.deepEqual(History.normalize(history), history);
});

test("rollup retention archives overflow without a lossy final cap", () => {
  const rollups = [];
  for (let index = 0; index < 3; index++) {
    const day = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
    rollups.push({localDay: day, mode: "time", amount: 30, language: "english",
      punctuation: false, numbers: false, completion: "completed", metricsVersion: 1,
      count: 1, qualifiedCount: 1, sumWpm: 40, sumRawWpm: 42, sumAccuracy: 98,
      sumConsistency: 80, sumElapsedMs: 30000, sumCharacters: 100, maxWpm: index === 0 ? 500 : 40,
      maxWpmTimestamp: day + "T10:00:00.000Z", latestTimestamp: day + "T12:00:00.000Z"});
  }
  const history = History.normalize({schemaVersion: 2, entries: [], rollups}, {maxRollups: 2});
  assert.equal(history.rollups.length, 2);
  assert.equal(history.archive.reduce((sum, value) => sum + value.count, 0), 1);
  assert.equal(history.rollups.reduce((sum, value) => sum + value.count, 0) + history.archive.reduce((sum, value) => sum + value.count, 0), 3);
  assert.equal(Math.max(...history.rollups.concat(history.archive).map(value => value.maxWpm)), 500);
  assert.equal(history.archive[0].maxWpmTimestamp, "2026-01-01T10:00:00.000Z");
});

test("rollup cleaning strips comparative metrics from incomplete or unqualified cohorts", () => {
  for (const malformed of [
    {completion: "quick-ended", punctuation: false, numbers: false, metricsVersion: 1},
    {completion: "legacy-unknown", punctuation: false, numbers: false, metricsVersion: 1},
    {completion: "completed", punctuation: null, numbers: false, metricsVersion: 1},
    {completion: "completed", punctuation: false, numbers: false, metricsVersion: null}
  ]) {
    const rollup = History.cleanRollup(Object.assign({mode: "time", amount: 30, language: "english",
      count: 3, qualifiedCount: 3, sumWpm: 300, sumRawWpm: 330, sumAccuracy: 270,
      sumConsistency: 240, maxWpm: 120, maxWpmTimestamp: "2026-01-01T10:00:00.000Z"}, malformed));
    assert.equal(rollup.qualifiedCount, 0);
    assert.equal(rollup.sumWpm, 0);
    assert.equal(rollup.sumRawWpm, 0);
    assert.equal(rollup.sumAccuracy, 0);
    assert.equal(rollup.sumConsistency, 0);
    assert.equal(rollup.maxWpm, 0);
    assert.equal(rollup.maxWpmTimestamp, null);
  }
});

test("unknown future schema versions fail closed and remain unchanged by mutation APIs", () => {
  const future = {schemaVersion: 3, entries: [run(0)], rollups: [{future: true}], archive: [{future: true}], futureTier: [{opaque: true}]};
  assert.equal(History.normalize(future), null);
  assert.equal(History.add(future, run(1)), future);
  const removed = History.remove(future, "anything");
  assert.equal(removed.history, future);
  assert.equal(removed.deleted, false);
  assert.equal(removed.reason, "unsupported-schema");
  assert.equal(History.toCsv(future), "");
});

test("history preserves only known local language identifiers", () => {
  for (const option of Languages.options()) {
    assert.equal(History.cleanEntry({language: option.id}).language, option.id);
  }
  assert.equal(History.cleanEntry({language: "../../nix"}).language, "english");
});

test("history rejects non-finite telemetry and bounds strings, samples, offsets, and options", () => {
  const history = History.normalize({schemaVersion: 2, entries: [{
    timestamp: "x".repeat(10000), mode: "broken", amount: Infinity,
    wpm: Infinity, rawWpm: "Infinity", accuracy: NaN, consistency: -Infinity,
    characters: Infinity, errors: Infinity, corrected: Infinity,
    uncorrectedErrors: Infinity, corrections: Infinity, seed: "s".repeat(10000),
    timezoneOffsetMinutes: 99999, samples: Array(1000).fill(42).concat([Infinity])
  }]});
  const entry = history.entries[0];
  for (const key of ["wpm", "rawWpm", "accuracy", "consistency", "characters", "errors", "corrected", "uncorrectedErrors", "corrections"])
    assert.ok(Number.isFinite(entry[key]), key);
  assert.equal(entry.mode, "words");
  assert.equal(entry.amount, 25);
  assert.ok(entry.seed.length <= 128);
  assert.ok(entry.timestamp.length <= 64);
  assert.equal(entry.timezoneOffsetMinutes, 840);
  assert.equal(entry.samples.length, History.MAX_SAMPLES);
});

test("local day calculation observes the stored timezone offset", () => {
  assert.equal(History.localDayAt("2026-01-02T01:00:00.000Z", 300), "2026-01-01");
  assert.equal(History.localDayAt("2026-01-01T23:00:00.000Z", -120), "2026-01-02");
  assert.equal(History.localDayAt("not-a-date", 0), null);
});

test("selective deletion only removes retained raw results and clear removes all history", () => {
  const history = History.normalize({schemaVersion: 2, entries: [run(0)], rollups: [{
    id: "ignored", localDay: "2025-01-01", mode: "time", amount: 30, language: "english",
    punctuation: false, numbers: false, completion: "completed", metricsVersion: 1,
    count: 1, qualifiedCount: 1, maxWpm: 90
  }]});
  const removed = History.remove(history, history.entries[0].id);
  assert.equal(removed.deleted, true);
  assert.equal(removed.history.entries.length, 0);
  assert.equal(History.remove(history, history.rollups[0].id).reason, "compacted");
  assert.equal(History.remove(history, "missing").reason, "missing");
  assert.deepEqual(History.clear(), {schemaVersion: 2, entries: [], rollups: [], archive: []});
});

test("serialized full-document queue preserves coalesced mutations across rollback", () => {
  const base = History.normalize({schemaVersion: 2, entries: [run(0)], rollups: [], archive: []});
  const firstResult = run(1, {id: "first-queued"});
  const secondResult = run(2, {id: "second-queued"});
  const inFlight = History.add(base, firstResult);
  const queued = History.add(inFlight, secondResult);
  const rolledBack = History.normalize(base);
  assert.deepEqual(rolledBack.entries.map(value => value.id), base.entries.map(value => value.id));
  const retried = History.normalize(queued);
  assert.deepEqual(retried.entries.slice(0, 2).map(value => value.id), ["second-queued", "first-queued"]);
  assert.equal(retried.entries.length, base.entries.length + 2);
});

test("CSV serialization escapes values and exports retained raw rows only", () => {
  const history = History.add(History.clear(), run(0, {seed: 'comma,"quote"'}));
  const csv = History.toCsv(history);
  assert.match(csv, /^id,timestamp,/);
  assert.match(csv, /"comma,""quote"""/);
  assert.equal(csv.trim().split("\n").length, 2);
});

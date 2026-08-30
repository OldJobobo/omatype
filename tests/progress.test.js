"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const History = require("../src/history.js");
const Progress = require("../src/progress.js");

let nextId = 0;
function run(day, wpm, extra) {
  nextId++;
  return Object.assign({
    id: day + "-" + wpm + "-" + nextId, timestamp: day + "T12:00:00.000Z",
    localDay: day, timezoneOffsetMinutes: 0, mode: "time", amount: 30,
    language: "english", punctuation: false, numbers: false, completion: "completed",
    metricsVersion: 1, elapsedMs: 30000, wpm, rawWpm: wpm + 3, accuracy: 98,
    consistency: 80, characters: 100, correct: 98, errors: 2, corrected: 2,
    uncorrectedErrors: 0, corrections: 2, seed: "seed", samples: [wpm - 2, wpm]
  }, extra || {});
}

function history(values, rollups) {
  return History.normalize({schemaVersion: 2, entries: values || [], rollups: rollups || []});
}

function cohort(extra) {
  return Object.assign({mode: "time", amount: 30, language: "english",
    punctuation: false, numbers: false, metricsVersion: 1}, extra || {});
}

test("strict cohort keys separate every test configuration dimension", () => {
  const base = run("2026-01-01", 50);
  const key = Progress.strictCohortKey(base);
  for (const change of [
    {mode: "words", amount: 25}, {amount: 60}, {language: "rust"},
    {punctuation: true}, {numbers: true}, {metricsVersion: 2}
  ]) assert.notEqual(Progress.strictCohortKey(Object.assign({}, base, change)), key);
  assert.equal(Progress.strictCohortKey(Object.assign({}, base, {punctuation: null})), null);
});

test("comparative APIs require one complete cohort and never pool mixed dimensions", () => {
  const values = [];
  for (let index = 0; index < 10; index++) values.push(run("2026-01-" + String(index + 1).padStart(2, "0"), index < 5 ? 40 : 60));
  values.push(run("2026-01-11", 300, {language: "rust", accuracy: 10}));
  values.push(run("2026-01-12", 400, {mode: "words", amount: 25, accuracy: 5}));
  const data = history(values);
  assert.equal(Progress.personalBest(data, {}), null);
  assert.equal(Progress.recentAccuracy(data, {}), null);
  assert.equal(Progress.recentMedianDelta(data, {}, 5).reason, "cohort-required");
  assert.equal(Progress.personalBest(data, cohort()).wpm, 60);
  assert.equal(Progress.recentAccuracy(data, cohort()), 98);
  assert.equal(Progress.recentMedianDelta(data, cohort(), 5).delta, 20);
  assert.equal(Progress.dailySeries(data, {}).every(day => day.wpm === null), true);
  assert.equal(Progress.dailySeries(data, cohort()).every(day => day.wpm !== null), true);
  const key = Progress.strictCohortKey(values[0]);
  assert.equal(Progress.personalBest(data, {cohortKey: key}).wpm, 60);
});

test("quick-ended and legacy timed tests count as activity but never PB or trend", () => {
  const data = history([
    run("2026-01-03", 200, {completion: "quick-ended"}),
    run("2026-01-02", 180, {completion: "legacy-unknown", punctuation: null, numbers: null, metricsVersion: null}),
    run("2026-01-01", 60)
  ]);
  assert.equal(Progress.totals(data, {}).tests, 3);
  assert.equal(Progress.totals(data, {}).qualifiedTests, 1);
  assert.equal(Progress.personalBest(data, cohort()).wpm, 60);
  assert.equal(Progress.latest(data, {}).wpm, 60);
});

test("all-time bounds omit both day limits so dayless legacy archives contribute", () => {
  assert.deepEqual(Progress.periodBounds("all", "2026-01-31"), {});
  assert.deepEqual(Progress.periodBounds("30d", "2026-01-31"), {fromDay: "2026-01-02", toDay: "2026-01-31"});
  const daylessArchive = {
    localDay: null, mode: "time", amount: 30, language: "english", punctuation: null,
    numbers: null, completion: "legacy-unknown", metricsVersion: null, count: 7,
    qualifiedCount: 0, sumWpm: 0, sumRawWpm: 0, sumAccuracy: 0, sumConsistency: 0,
    sumElapsedMs: 210000, sumCharacters: 700, maxWpm: 0, maxWpmTimestamp: null,
    latestTimestamp: "2025-01-01T00:00:00.000Z"
  };
  const data = History.normalize({schemaVersion: 2, entries: [], rollups: [], archive: [daylessArchive]});
  assert.equal(Progress.totals(data, Progress.periodBounds("all", "2026-01-31")).tests, 7);
  assert.equal(Progress.totals(data, Progress.periodBounds("30d", "2026-01-31")).tests, 0);
  const migrated = History.normalize({schemaVersion: 1, entries: [run("2024-01-01", 44)]});
  assert.equal(migrated.entries[0].localDay, null);
  assert.equal(Progress.totals(migrated, Progress.periodBounds("all", "2026-01-31")).tests, 1);
  assert.equal(Progress.totals(migrated, Progress.periodBounds("30d", "2026-01-31")).tests, 0);
});

test("mixed summaries suppress every comparative claim and chart series", () => {
  const data = history([
    run("2026-01-01", 50),
    run("2026-01-02", 300, {language: "rust"}),
    run("2026-01-03", 400, {mode: "words", amount: 25})
  ]);
  const mixed = Progress.summary(data, {}, {today: "2026-01-03"});
  assert.equal(mixed.latest, null);
  assert.equal(mixed.personalBest, null);
  assert.equal(mixed.recentAccuracy, null);
  assert.equal(mixed.pace.delta, null);
  assert.equal(mixed.pace.reason, "cohort-required");
  assert.deepEqual(mixed.daily, []);
  assert.equal(mixed.totals.tests, 3);
});

test("available filters expose actual retained languages, modes, amounts, and strict cohorts", () => {
  const data = history([
    run("2026-01-01", 50),
    run("2026-01-02", 60, {language: "rust"}),
    run("2026-01-03", 70, {mode: "words", amount: 25})
  ]);
  const options = Progress.filterOptions(data);
  assert.deepEqual(options.languages, ["english", "rust"]);
  assert.deepEqual(options.modes, ["time", "words"]);
  assert.deepEqual(options.amounts, [{mode: "time", amount: 30}, {mode: "words", amount: 25}]);
  assert.equal(options.cohorts.length, 3);
});

test("filters constrain mode, amount, language, modifiers, and day range", () => {
  const data = history([
    run("2026-01-01", 40),
    run("2026-01-02", 50, {language: "rust"}),
    run("2026-01-03", 60, {punctuation: true}),
    run("2026-01-04", 70, {mode: "words", amount: 25})
  ]);
  assert.deepEqual(Progress.entries(data, {language: "rust"}, true).map(e => e.wpm), [50]);
  assert.deepEqual(Progress.entries(data, {fromDay: "2026-01-02", toDay: "2026-01-03"}, true).map(e => e.wpm), [60, 50]);
  assert.deepEqual(Progress.entries(data, {mode: "words", amount: 25, punctuation: false}, true).map(e => e.wpm), [70]);
});

test("recent pace uses median windows and sparse history reports no delta", () => {
  const values = [];
  for (let index = 0; index < 10; index++) values.push(run("2026-01-" + String(index + 1).padStart(2, "0"), index < 5 ? 40 : 60));
  const trend = Progress.recentMedianDelta(history(values), cohort(), 5);
  assert.equal(trend.current, 60);
  assert.equal(trend.previous, 40);
  assert.equal(trend.delta, 20);
  assert.equal(Progress.recentMedianDelta(history(values.slice(0, 3)), cohort(), 5).delta, null);
  assert.equal(Progress.median([1, 9, 3, 5]), 4);
});

test("daily series combines raw and compacted records without double counting", () => {
  const compacted = {
    localDay: "2025-12-31", mode: "time", amount: 30, language: "english",
    punctuation: false, numbers: false, completion: "completed", metricsVersion: 1,
    count: 3, qualifiedCount: 3, sumWpm: 150, sumRawWpm: 159,
    sumAccuracy: 294, sumConsistency: 240, sumElapsedMs: 90000,
    sumCharacters: 300, maxWpm: 60, maxWpmTimestamp: "2025-12-31T10:00:00.000Z",
    latestTimestamp: "2025-12-31T12:00:00.000Z"
  };
  const data = history([run("2026-01-01", 70)], [compacted]);
  const totals = Progress.totals(data, {});
  assert.equal(totals.tests, 4);
  assert.equal(totals.characters, 400);
  assert.equal(totals.minutes, 2);
  const series = Progress.dailySeries(data, cohort());
  assert.deepEqual(series.map(value => value.tests), [3, 1]);
  assert.equal(series[0].wpm, 50);
  assert.equal(Progress.personalBest(data, cohort()).wpm, 70);
});

test("compacted personal best reports the timestamp of the maximum, not the latest run", () => {
  const compacted = {
    localDay: "2025-12-31", mode: "time", amount: 30, language: "english",
    punctuation: false, numbers: false, completion: "completed", metricsVersion: 1,
    count: 3, qualifiedCount: 3, sumWpm: 250, sumRawWpm: 260,
    sumAccuracy: 294, sumConsistency: 240, sumElapsedMs: 90000, sumCharacters: 300,
    maxWpm: 100, maxWpmTimestamp: "2025-12-31T08:00:00.000Z",
    latestTimestamp: "2025-12-31T20:00:00.000Z"
  };
  const best = Progress.personalBest(history([], [compacted]), cohort());
  assert.equal(best.wpm, 100);
  assert.equal(best.timestamp, "2025-12-31T08:00:00.000Z");
  assert.equal(best.compacted, true);
});

test("trailing 90-day heatmap remains independent from the selected activity period", () => {
  const data = history([run("2026-01-15", 40), run("2026-03-31", 50)]);
  const periodActivity = Progress.totals(data, Progress.periodBounds("30d", "2026-03-31"));
  const heatmap = Progress.activityHeatmap(data, {}, "2026-03-31", 90);
  assert.equal(periodActivity.tests, 1);
  assert.equal(heatmap.reduce((sum, day) => sum + day.tests, 0), 2);
  assert.equal(heatmap.length, 90);
});

test("90-day heatmap, streaks, and goal progress observe local day boundaries", () => {
  const data = history([
    run("2026-01-01", 40), run("2026-01-02", 45), run("2026-01-03", 50),
    run("2026-01-03", 55, {id: "second", elapsedMs: 60000, characters: 200})
  ]);
  const heatmap = Progress.activityHeatmap(data, {}, "2026-01-03", 90);
  assert.equal(heatmap.length, 90);
  assert.equal(heatmap.at(-1).tests, 2);
  assert.deepEqual(Progress.streaks(data, {}, "2026-01-03"), {current: 3, longest: 3, activeDays: 3});
  assert.equal(Progress.streaks(data, {}, "2026-01-04").current, 0);
  assert.deepEqual(Progress.goalProgress(data, {}, "2026-01-03", {metric: "tests", target: 2}),
    {metric: "tests", target: 2, value: 2, ratio: 1, complete: true});
  assert.equal(Progress.goalProgress(data, {}, "2026-01-03", {metric: "minutes", target: 2}).value, 1.5);
});

test("per-language comparison includes activity and qualified averages", () => {
  const data = history([
    run("2026-01-01", 40), run("2026-01-02", 60),
    run("2026-01-03", 70, {language: "rust"}),
    run("2026-01-04", 999, {language: "rust", completion: "quick-ended"})
  ]);
  assert.deepEqual(Progress.languageComparison(data, {}), []);
  const languages = Progress.languageComparison(data, {mode: "time", amount: 30,
    punctuation: false, numbers: false, metricsVersion: 1});
  assert.deepEqual(languages.map(value => value.language), ["english", "rust"]);
  assert.equal(languages[0].averageWpm, 50);
  assert.equal(languages[1].averageWpm, 70);
  assert.equal(languages[1].tests, 2);
});

test("selected retained result exposes bounded historical interval samples", () => {
  const data = history([run("2026-01-01", 50, {id: "chosen", samples: [30, 40, 50]})]);
  assert.deepEqual(Progress.historicalSampleSeries(data.entries[0]), [
    {second: 1, wpm: 30}, {second: 2, wpm: 40}, {second: 3, wpm: 50}
  ]);
  assert.equal(Progress.selectedResult(data, "chosen").sampleSeries.length, 3);
  assert.equal(Progress.selectedResult(data, "missing"), null);
});

test("summary remains finite and useful with empty or sparse history", () => {
  const empty = Progress.summary(History.clear(), cohort(), {today: "2026-01-01"});
  assert.equal(empty.latest, null);
  assert.equal(empty.personalBest, null);
  assert.equal(empty.recentAccuracy, null);
  assert.equal(empty.totals.tests, 0);
  assert.equal(empty.heatmap.length, 90);
  const sparse = Progress.summary(history([run("2026-01-01", 42)]), cohort(), {today: "2026-01-01"});
  assert.equal(sparse.pace.delta, null);
  assert.equal(sparse.recentAccuracy, 98);
});

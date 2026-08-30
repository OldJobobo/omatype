"use strict";

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(value, digits) {
  const factor = Math.pow(10, digits || 0);
  return Math.round(number(value, 0) * factor) / factor;
}

function strictCohortKey(value) {
  const entry = object(value);
  const amounts = entry.mode === "time" ? [15, 30, 60, 120] : entry.mode === "words" ? [10, 25, 50, 100] : [];
  if (amounts.indexOf(Number(entry.amount)) < 0) return null;
  if (typeof entry.language !== "string" || !entry.language || typeof entry.punctuation !== "boolean" || typeof entry.numbers !== "boolean") return null;
  if (!Number.isInteger(entry.metricsVersion) || entry.metricsVersion < 1) return null;
  return [entry.mode, Number(entry.amount), entry.language, entry.punctuation ? 1 : 0,
    entry.numbers ? 1 : 0, entry.metricsVersion].join("|");
}

function completeCohortKey(filters) {
  const selected = object(filters);
  if (typeof selected.cohortKey === "string") {
    const parts = selected.cohortKey.split("|");
    if (parts.length !== 6) return null;
    return strictCohortKey({
      mode: parts[0], amount: Number(parts[1]), language: parts[2],
      punctuation: parts[3] === "1" ? true : parts[3] === "0" ? false : null,
      numbers: parts[4] === "1" ? true : parts[4] === "0" ? false : null,
      metricsVersion: Number(parts[5])
    });
  }
  return strictCohortKey(selected);
}

function comparisonFilters(filters) {
  const key = completeCohortKey(filters);
  return key ? Object.assign({}, object(filters), {cohortKey: key}) : null;
}

function isQualified(value) {
  const entry = object(value);
  return entry.completion === "completed" && strictCohortKey(entry) !== null;
}

function matches(value, filters) {
  const entry = object(value);
  const selected = object(filters);
  const dimensions = ["mode", "amount", "language", "punctuation", "numbers", "metricsVersion", "completion"];
  for (let index = 0; index < dimensions.length; index++) {
    const key = dimensions[index];
    if (selected[key] !== undefined && selected[key] !== null && entry[key] !== selected[key]) return false;
  }
  if (selected.cohortKey && strictCohortKey(entry) !== selected.cohortKey) return false;
  if (selected.fromDay && (!entry.localDay || entry.localDay < selected.fromDay)) return false;
  if (selected.toDay && (!entry.localDay || entry.localDay > selected.toDay)) return false;
  return true;
}

function entries(history, filters, qualifiedOnly) {
  const source = object(history);
  return (Array.isArray(source.entries) ? source.entries : []).filter(function(entry) {
    return matches(entry, filters) && (!qualifiedOnly || isQualified(entry));
  });
}

function rollups(history, filters, qualifiedOnly) {
  const source = object(history);
  const retained = Array.isArray(source.rollups) ? source.rollups : [];
  const archive = Array.isArray(source.archive) ? source.archive : [];
  return retained.concat(archive).filter(function(rollup) {
    return matches(rollup, filters) && (!qualifiedOnly || (rollup.completion === "completed" && strictCohortKey(rollup) !== null && rollup.qualifiedCount > 0));
  });
}

function median(values) {
  const sorted = (values || []).map(Number).filter(Number.isFinite).sort(function(a, b) { return a - b; });
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function recentMedianDelta(history, filters, size) {
  const selectedFilters = comparisonFilters(filters);
  if (!selectedFilters) return {delta: null, current: null, previous: null, sampleSize: 0, reason: "cohort-required"};
  const count = Math.max(1, Math.min(100, Math.round(number(size, 5))));
  const recent = entries(history, selectedFilters, true);
  if (recent.length < count * 2) return {delta: null, current: median(recent.slice(0, count).map(function(e) { return e.wpm; })), previous: null, sampleSize: recent.length};
  const current = median(recent.slice(0, count).map(function(e) { return e.wpm; }));
  const previous = median(recent.slice(count, count * 2).map(function(e) { return e.wpm; }));
  return {delta: round(current - previous, 2), current: round(current, 2), previous: round(previous, 2), sampleSize: count * 2};
}

function latest(history, filters) {
  const selected = entries(history, filters, true);
  return selected.length ? selected[0] : null;
}

function personalBest(history, filters) {
  const selectedFilters = comparisonFilters(filters);
  if (!selectedFilters) return null;
  let best = null;
  entries(history, selectedFilters, true).forEach(function(entry) {
    if (!best || entry.wpm > best.wpm) best = {wpm: entry.wpm, id: entry.id, timestamp: entry.timestamp, compacted: false};
  });
  rollups(history, selectedFilters, true).forEach(function(rollup) {
    if (!best || rollup.maxWpm > best.wpm) best = {wpm: rollup.maxWpm, id: rollup.id, timestamp: rollup.maxWpmTimestamp, compacted: true};
  });
  return best;
}

function recentAccuracy(history, filters, size) {
  const selectedFilters = comparisonFilters(filters);
  if (!selectedFilters) return null;
  const selected = entries(history, selectedFilters, true).slice(0, Math.max(1, Math.min(100, Math.round(number(size, 10)))));
  if (!selected.length) return null;
  return round(selected.reduce(function(sum, entry) { return sum + entry.accuracy; }, 0) / selected.length, 2);
}

function dayFromDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function shiftDay(day, delta) {
  const time = Date.parse(day + "T00:00:00.000Z");
  return Number.isFinite(time) ? dayFromDate(time + delta * 86400000) : null;
}

function periodBounds(period, today) {
  const end = /^\d{4}-\d{2}-\d{2}$/.test(String(today)) ? String(today) : dayFromDate(Date.now());
  if (period === "30d") return {fromDay: shiftDay(end, -29), toDay: end};
  if (period === "90d") return {fromDay: shiftDay(end, -89), toDay: end};
  return {};
}

function filterOptions(history) {
  const source = object(history);
  const values = (Array.isArray(source.entries) ? source.entries : [])
    .concat(Array.isArray(source.rollups) ? source.rollups : [])
    .concat(Array.isArray(source.archive) ? source.archive : []);
  const modes = {};
  const languages = {};
  const amounts = {};
  const cohorts = {};
  values.forEach(function(value) {
    if (value.mode === "time" || value.mode === "words") modes[value.mode] = true;
    if (typeof value.language === "string" && value.language) languages[value.language] = true;
    if ((value.mode === "time" || value.mode === "words") && Number.isFinite(Number(value.amount))) {
      amounts[value.mode + "|" + Number(value.amount)] = {mode: value.mode, amount: Number(value.amount)};
    }
    const key = strictCohortKey(value);
    if (key) cohorts[key] = key;
  });
  return {
    modes: Object.keys(modes).sort(),
    languages: Object.keys(languages).sort(),
    amounts: Object.keys(amounts).map(function(key) { return amounts[key]; }).sort(function(a, b) {
      return a.mode.localeCompare(b.mode) || a.amount - b.amount;
    }),
    cohorts: Object.keys(cohorts).sort()
  };
}

function accumulator(day) {
  return {day, tests: 0, qualifiedTests: 0, sumWpm: 0, sumRawWpm: 0, sumAccuracy: 0,
    sumConsistency: 0, elapsedMs: 0, characters: 0, maxWpm: 0};
}

function addRaw(bucket, entry, comparisonKey) {
  bucket.tests += 1;
  bucket.elapsedMs += number(entry.elapsedMs, 0);
  bucket.characters += number(entry.characters, 0);
  if (comparisonKey && isQualified(entry) && strictCohortKey(entry) === comparisonKey) {
    bucket.qualifiedTests += 1;
    bucket.sumWpm += number(entry.wpm, 0);
    bucket.sumRawWpm += number(entry.rawWpm, 0);
    bucket.sumAccuracy += number(entry.accuracy, 0);
    bucket.sumConsistency += number(entry.consistency, 0);
    bucket.maxWpm = Math.max(bucket.maxWpm, number(entry.wpm, 0));
  }
}

function addRollup(bucket, rollup, comparisonKey) {
  bucket.tests += number(rollup.count, 0);
  if (comparisonKey && strictCohortKey(rollup) === comparisonKey && rollup.completion === "completed") {
    bucket.qualifiedTests += number(rollup.qualifiedCount, 0);
    bucket.sumWpm += number(rollup.sumWpm, 0);
    bucket.sumRawWpm += number(rollup.sumRawWpm, 0);
    bucket.sumAccuracy += number(rollup.sumAccuracy, 0);
    bucket.sumConsistency += number(rollup.sumConsistency, 0);
    bucket.maxWpm = Math.max(bucket.maxWpm, number(rollup.maxWpm, 0));
  }
  bucket.elapsedMs += number(rollup.sumElapsedMs, 0);
  bucket.characters += number(rollup.sumCharacters, 0);
}

function finishBucket(bucket) {
  const count = bucket.qualifiedTests;
  return {
    day: bucket.day,
    tests: bucket.tests,
    qualifiedTests: count,
    wpm: count ? round(bucket.sumWpm / count, 2) : null,
    rawWpm: count ? round(bucket.sumRawWpm / count, 2) : null,
    accuracy: count ? round(bucket.sumAccuracy / count, 2) : null,
    consistency: count ? round(bucket.sumConsistency / count, 2) : null,
    elapsedMs: bucket.elapsedMs,
    characters: bucket.characters,
    maxWpm: bucket.maxWpm
  };
}

function dailySeries(history, filters) {
  const buckets = {};
  const comparisonKey = completeCohortKey(filters);
  entries(history, filters, false).forEach(function(entry) {
    if (!entry.localDay) return;
    if (!buckets[entry.localDay]) buckets[entry.localDay] = accumulator(entry.localDay);
    addRaw(buckets[entry.localDay], entry, comparisonKey);
  });
  rollups(history, filters, false).forEach(function(rollup) {
    if (!rollup.localDay) return;
    if (!buckets[rollup.localDay]) buckets[rollup.localDay] = accumulator(rollup.localDay);
    addRollup(buckets[rollup.localDay], rollup, comparisonKey);
  });
  return Object.keys(buckets).sort().map(function(day) { return finishBucket(buckets[day]); });
}

function activityHeatmap(history, filters, today, days) {
  const end = /^\d{4}-\d{2}-\d{2}$/.test(String(today)) ? String(today) : dayFromDate(Date.now());
  const count = Math.max(1, Math.min(366, Math.round(number(days, 90))));
  const activity = {};
  dailySeries(history, filters).forEach(function(day) { activity[day.day] = day; });
  const result = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const day = shiftDay(end, -offset);
    const value = activity[day] || finishBucket(accumulator(day));
    result.push(value);
  }
  return result;
}

function streaks(history, filters, today) {
  const days = dailySeries(history, filters).filter(function(day) { return day.tests > 0; }).map(function(day) { return day.day; });
  const active = {};
  days.forEach(function(day) { active[day] = true; });
  const end = /^\d{4}-\d{2}-\d{2}$/.test(String(today)) ? String(today) : dayFromDate(Date.now());
  let current = 0;
  let cursor = end;
  while (active[cursor]) { current++; cursor = shiftDay(cursor, -1); }
  let longest = 0;
  let run = 0;
  let previous = null;
  days.forEach(function(day) {
    run = previous && shiftDay(previous, 1) === day ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  });
  return {current, longest, activeDays: days.length};
}

function totals(history, filters) {
  const total = {tests: 0, qualifiedTests: 0, elapsedMs: 0, characters: 0};
  entries(history, filters, false).forEach(function(entry) {
    total.tests++;
    if (isQualified(entry)) total.qualifiedTests++;
    total.elapsedMs += number(entry.elapsedMs, 0);
    total.characters += number(entry.characters, 0);
  });
  rollups(history, filters, false).forEach(function(rollup) {
    total.tests += number(rollup.count, 0);
    total.qualifiedTests += number(rollup.qualifiedCount, 0);
    total.elapsedMs += number(rollup.sumElapsedMs, 0);
    total.characters += number(rollup.sumCharacters, 0);
  });
  total.minutes = round(total.elapsedMs / 60000, 2);
  return total;
}

function languageComparison(history, filters) {
  const selected = object(filters);
  const baseComplete = (selected.mode === "time" || selected.mode === "words")
    && Number.isFinite(Number(selected.amount)) && typeof selected.punctuation === "boolean"
    && typeof selected.numbers === "boolean" && Number.isInteger(selected.metricsVersion);
  if (!baseComplete) return [];
  const baseFilters = Object.assign({}, selected);
  delete baseFilters.language;
  delete baseFilters.cohortKey;
  const groups = {};
  function sameBase(value) {
    return value.mode === baseFilters.mode && Number(value.amount) === Number(baseFilters.amount)
      && value.punctuation === baseFilters.punctuation && value.numbers === baseFilters.numbers
      && value.metricsVersion === baseFilters.metricsVersion;
  }
  function group(language) {
    if (!groups[language]) groups[language] = {language, tests: 0, qualifiedTests: 0, sumWpm: 0, maxWpm: 0, characters: 0};
    return groups[language];
  }
  entries(history, baseFilters, false).forEach(function(entry) {
    if (!sameBase(entry)) return;
    const value = group(entry.language);
    value.tests++;
    value.characters += number(entry.characters, 0);
    if (isQualified(entry)) { value.qualifiedTests++; value.sumWpm += entry.wpm; value.maxWpm = Math.max(value.maxWpm, entry.wpm); }
  });
  rollups(history, baseFilters, false).forEach(function(rollup) {
    if (!sameBase(rollup)) return;
    const value = group(rollup.language);
    value.tests += number(rollup.count, 0);
    value.characters += number(rollup.sumCharacters, 0);
    value.qualifiedTests += number(rollup.qualifiedCount, 0);
    value.sumWpm += number(rollup.sumWpm, 0);
    value.maxWpm = Math.max(value.maxWpm, number(rollup.maxWpm, 0));
  });
  return Object.keys(groups).map(function(key) {
    const value = groups[key];
    value.averageWpm = value.qualifiedTests ? round(value.sumWpm / value.qualifiedTests, 2) : null;
    delete value.sumWpm;
    return value;
  }).sort(function(a, b) { return b.tests - a.tests || a.language.localeCompare(b.language); });
}

function goalProgress(history, filters, today, goal) {
  const target = Math.max(1, number(object(goal).target, 10));
  const metric = ["tests", "minutes", "characters"].indexOf(object(goal).metric) >= 0 ? goal.metric : "tests";
  const dayTotals = totals(history, Object.assign({}, object(filters), {fromDay: today, toDay: today}));
  const value = metric === "minutes" ? dayTotals.minutes : dayTotals[metric];
  return {metric, target, value, ratio: Math.min(1, round(value / target, 4)), complete: value >= target};
}

function selectedResult(history, id) {
  const source = object(history);
  const found = (Array.isArray(source.entries) ? source.entries : []).find(function(entry) { return entry.id === id; });
  if (!found) return null;
  return Object.assign({}, found, {sampleSeries: historicalSampleSeries(found)});
}

function historicalSampleSeries(entry) {
  return (Array.isArray(object(entry).samples) ? entry.samples : []).map(function(wpm, index) {
    return {second: index + 1, wpm: number(wpm, 0)};
  });
}

function summary(history, filters, options) {
  const settings = object(options);
  const activity = object(filters);
  const comparable = comparisonFilters(filters);
  const trend = comparable
    ? recentMedianDelta(history, comparable, settings.windowSize || 5)
    : {delta: null, current: null, previous: null, sampleSize: 0, reason: "cohort-required"};
  return {
    latest: comparable ? latest(history, comparable) : null,
    personalBest: comparable ? personalBest(history, comparable) : null,
    recentAccuracy: comparable ? recentAccuracy(history, comparable, settings.accuracyWindow || 10) : null,
    pace: trend,
    totals: totals(history, activity),
    streaks: streaks(history, activity, settings.today),
    daily: comparable ? dailySeries(history, comparable) : [],
    heatmap: activityHeatmap(history, activity, settings.today, settings.heatmapDays || 90),
    languages: comparable ? languageComparison(history, comparable) : []
  };
}

const api = {
  strictCohortKey, completeCohortKey, isQualified, matches, entries, rollups, median, recentMedianDelta,
  latest, personalBest, recentAccuracy, dailySeries, activityHeatmap, streaks, totals,
  languageComparison, goalProgress, selectedResult, historicalSampleSeries, shiftDay, periodBounds,
  filterOptions, summary
};
if (typeof module !== "undefined" && module.exports) module.exports = api;

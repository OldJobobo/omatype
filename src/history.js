"use strict";

const SCHEMA_VERSION = 2;
const MAX_ENTRIES = 2000;
const MAX_ROLLUPS = 20000;
const MAX_ARCHIVE = 20000;
const MAX_SAMPLES = 600;
const MAX_EFFECTS = 1000;
const MODES = ["time", "words"];
const AMOUNTS = {time: [15, 30, 60, 120], words: [10, 25, 50, 100]};
const COMPLETIONS = ["completed", "quick-ended", "legacy-unknown"];
const LANGUAGE_IDS = [
  "english", "ada", "assembly", "bash", "c", "clojure", "cpp", "csharp", "css",
  "dart", "elixir", "go", "haskell", "html", "java", "javascript", "json", "julia",
  "kotlin", "lua", "nix", "objective-c", "ocaml", "perl", "php", "powershell",
  "python", "r", "ruby", "rust", "scala", "solidity", "sql", "swift", "typescript",
  "yaml", "zig"
];

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

// JsonAdapter exposes JSON arrays as QML sequences in some Qt runtimes.
// Copy only the bounded prefix; never trust or iterate an attacker-supplied length.
function list(value, maximum, rejectOversize) {
  const limit = Math.max(0, Math.floor(Number(maximum) || 0));
  if (Array.isArray(value)) {
    if (rejectOversize && value.length > limit) return null;
    return value.slice(0, limit);
  }
  if (!value || typeof value !== "object" || !Number.isInteger(value.length) || value.length < 0) return [];
  if (rejectOversize && value.length > limit) return null;
  const count = Math.min(value.length, limit);
  const result = [];
  for (let index = 0; index < count; index++) result.push(value[index]);
  return result;
}

function finite(value, minimum, maximum, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function nullableInteger(value, minimum, maximum) {
  const parsed = finite(value, minimum, maximum, null);
  return parsed === null ? null : Math.round(parsed);
}

function boundedText(value, fallback, maximumLength) {
  const source = value === null || value === undefined ? fallback : value;
  return String(source === null || source === undefined ? "" : source).slice(0, maximumLength);
}

function nullableBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function validDay(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function localDayAt(timestamp, timezoneOffsetMinutes) {
  const offset = nullableInteger(timezoneOffsetMinutes, -840, 840);
  const time = Date.parse(timestamp);
  if (offset === null || !Number.isFinite(time)) return null;
  return new Date(time - offset * 60000).toISOString().slice(0, 10);
}

function stableHash(text) {
  let hash = 2166136261;
  const source = String(text);
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function deterministicId(entry) {
  const source = object(entry) || {};
  const basis = [
    boundedText(source.timestamp, "", 64), boundedText(source.seed, "", 128),
    boundedText(source.mode, "", 16), String(source.amount ?? ""),
    String(source.wpm ?? ""), String(source.characters ?? "")
  ].join("|");
  return "run-" + stableHash(basis);
}

function cleanSamples(value) {
  return list(value, MAX_SAMPLES, false)
    .map(function(sample) { return finite(sample, 0, 9999, null); })
    .filter(function(sample) { return sample !== null; });
}

function cleanEntry(entry, sourceSchemaVersion) {
  const source = object(entry);
  if (!source) return null;
  const mode = MODES.indexOf(source.mode) >= 0 ? source.mode : "words";
  const requestedAmount = Number(source.amount);
  const amount = Number.isFinite(requestedAmount) && AMOUNTS[mode].indexOf(requestedAmount) >= 0
    ? requestedAmount
    : (mode === "time" ? 30 : 25);
  const timestamp = boundedText(source.timestamp, new Date(0).toISOString(), 64);
  const timezoneOffsetMinutes = nullableInteger(source.timezoneOffsetMinutes, -840, 840);
  const explicitDay = validDay(source.localDay);
  const completion = COMPLETIONS.indexOf(source.completion) >= 0
    ? source.completion
    : "legacy-unknown";
  const metricsVersion = nullableInteger(source.metricsVersion, 1, 1000000);
  const suppliedId = boundedText(source.id, "", 128).trim();
  const cleaned = {
    id: suppliedId || deterministicId(source),
    timestamp,
    mode,
    amount,
    language: LANGUAGE_IDS.indexOf(source.language) >= 0 ? source.language : "english",
    punctuation: nullableBoolean(source.punctuation),
    numbers: nullableBoolean(source.numbers),
    completion,
    metricsVersion,
    elapsedMs: nullableInteger(source.elapsedMs, 1, 86400000),
    localDay: explicitDay || localDayAt(timestamp, timezoneOffsetMinutes),
    timezoneOffsetMinutes,
    wpm: finite(source.wpm, 0, 9999, 0),
    rawWpm: finite(source.rawWpm, 0, 9999, 0),
    accuracy: finite(source.accuracy, 0, 100, 0),
    consistency: finite(source.consistency, 0, 100, 0),
    characters: finite(source.characters, 0, 1000000, 0),
    correct: finite(source.correct, 0, 1000000, 0),
    errors: finite(source.errors, 0, 1000000, 0),
    corrected: finite(source.corrected, 0, 1000000, 0),
    uncorrectedErrors: finite(source.uncorrectedErrors, 0, 1000000, 0),
    corrections: finite(source.corrections, 0, 1000000, 0),
    seed: boundedText(source.seed, "", 128),
    samples: cleanSamples(source.samples)
  };
  if (sourceSchemaVersion !== SCHEMA_VERSION) {
    cleaned.punctuation = null;
    cleaned.numbers = null;
    cleaned.completion = "legacy-unknown";
    cleaned.metricsVersion = null;
    cleaned.elapsedMs = null;
    cleaned.localDay = null;
    cleaned.timezoneOffsetMinutes = null;
    cleaned.samples = [];
  }
  return cleaned;
}

function cohortKey(entry) {
  if (!entry || typeof entry !== "object") return null;
  if (typeof entry.punctuation !== "boolean" || typeof entry.numbers !== "boolean") return null;
  if (!Number.isInteger(entry.metricsVersion)) return null;
  return [entry.mode, entry.amount, entry.language, entry.punctuation ? 1 : 0,
    entry.numbers ? 1 : 0, entry.metricsVersion].join("|");
}

function isQualified(entry) {
  return !!cohortKey(entry) && entry.completion === "completed";
}

function archiveKey(value) {
  return [value.mode, value.amount, value.language,
    value.punctuation === true ? 1 : value.punctuation === false ? 0 : "u",
    value.numbers === true ? 1 : value.numbers === false ? 0 : "u",
    value.metricsVersion === null ? "u" : value.metricsVersion,
    value.completion].join("|");
}

function rollupKey(value) {
  return [value.localDay || "unknown", archiveKey(value)].join("|");
}

function emptyRollup(entry) {
  return {
    id: "rollup-" + stableHash(rollupKey(entry)),
    localDay: entry.localDay,
    mode: entry.mode,
    amount: entry.amount,
    language: entry.language,
    punctuation: entry.punctuation,
    numbers: entry.numbers,
    completion: entry.completion,
    metricsVersion: entry.metricsVersion,
    count: 0,
    qualifiedCount: 0,
    sumWpm: 0,
    sumRawWpm: 0,
    sumAccuracy: 0,
    sumConsistency: 0,
    sumElapsedMs: 0,
    sumCharacters: 0,
    maxWpm: 0,
    maxWpmTimestamp: null,
    latestTimestamp: entry.timestamp
  };
}

function cleanRollup(value) {
  const source = object(value);
  if (!source) return null;
  const mode = MODES.indexOf(source.mode) >= 0 ? source.mode : "words";
  const completion = COMPLETIONS.indexOf(source.completion) >= 0 ? source.completion : "legacy-unknown";
  const rollup = {
    id: boundedText(source.id, "rollup-" + stableHash(JSON.stringify(source)), 128),
    localDay: validDay(source.localDay),
    mode,
    amount: AMOUNTS[mode].indexOf(Number(source.amount)) >= 0 ? Number(source.amount) : (mode === "time" ? 30 : 25),
    language: LANGUAGE_IDS.indexOf(source.language) >= 0 ? source.language : "english",
    punctuation: nullableBoolean(source.punctuation),
    numbers: nullableBoolean(source.numbers),
    completion,
    metricsVersion: nullableInteger(source.metricsVersion, 1, 1000000),
    count: Math.round(finite(source.count, 0, 1000000000, 0)),
    qualifiedCount: Math.round(finite(source.qualifiedCount, 0, 1000000000, 0)),
    sumWpm: finite(source.sumWpm, 0, 1000000000000, 0),
    sumRawWpm: finite(source.sumRawWpm, 0, 1000000000000, 0),
    sumAccuracy: finite(source.sumAccuracy, 0, 1000000000000, 0),
    sumConsistency: finite(source.sumConsistency, 0, 1000000000000, 0),
    sumElapsedMs: finite(source.sumElapsedMs, 0, 100000000000000, 0),
    sumCharacters: finite(source.sumCharacters, 0, 100000000000000, 0),
    maxWpm: finite(source.maxWpm, 0, 9999, 0),
    maxWpmTimestamp: source.maxWpmTimestamp === null || source.maxWpmTimestamp === undefined
      ? null : boundedText(source.maxWpmTimestamp, null, 64),
    latestTimestamp: boundedText(source.latestTimestamp, new Date(0).toISOString(), 64)
  };
  const completeCohort = rollup.completion === "completed"
    && typeof rollup.punctuation === "boolean" && typeof rollup.numbers === "boolean"
    && Number.isInteger(rollup.metricsVersion);
  rollup.qualifiedCount = completeCohort ? Math.min(rollup.count, rollup.qualifiedCount) : 0;
  if (rollup.qualifiedCount === 0) {
    rollup.sumWpm = 0;
    rollup.sumRawWpm = 0;
    rollup.sumAccuracy = 0;
    rollup.sumConsistency = 0;
    rollup.maxWpm = 0;
    rollup.maxWpmTimestamp = null;
  }
  rollup.id = "rollup-" + stableHash(rollupKey(rollup));
  return rollup;
}

function addEntryToRollup(rollup, entry) {
  const next = rollup || emptyRollup(entry);
  next.count += 1;
  next.sumElapsedMs += entry.elapsedMs || 0;
  next.sumCharacters += entry.characters || 0;
  if (isQualified(entry)) {
    next.qualifiedCount += 1;
    next.sumWpm += entry.wpm;
    next.sumRawWpm += entry.rawWpm;
    next.sumAccuracy += entry.accuracy;
    next.sumConsistency += entry.consistency;
    if (entry.wpm > next.maxWpm || (entry.wpm === next.maxWpm && !next.maxWpmTimestamp)) {
      next.maxWpm = entry.wpm;
      next.maxWpmTimestamp = entry.timestamp;
    }
  }
  if (String(entry.timestamp) > String(next.latestTimestamp)) next.latestTimestamp = entry.timestamp;
  return next;
}

function mergeRollups(left, right) {
  const next = Object.assign({}, left);
  next.count += right.count;
  next.qualifiedCount += right.qualifiedCount;
  next.sumWpm += right.sumWpm;
  next.sumRawWpm += right.sumRawWpm;
  next.sumAccuracy += right.sumAccuracy;
  next.sumConsistency += right.sumConsistency;
  next.sumElapsedMs += right.sumElapsedMs;
  next.sumCharacters += right.sumCharacters;
  if (right.maxWpm > next.maxWpm || (right.maxWpm === next.maxWpm && !next.maxWpmTimestamp && right.maxWpmTimestamp)) {
    next.maxWpm = right.maxWpm;
    next.maxWpmTimestamp = right.maxWpmTimestamp;
  }
  if (String(right.latestTimestamp) > String(next.latestTimestamp)) next.latestTimestamp = right.latestTimestamp;
  return next;
}

function normalize(raw, limits) {
  const source = object(raw) || {};
  if (source.schemaVersion !== undefined && source.schemaVersion !== 1 && source.schemaVersion !== SCHEMA_VERSION) return null;
  const sourceSchemaVersion = source.schemaVersion === SCHEMA_VERSION ? SCHEMA_VERSION : 1;
  const requestedLimits = object(limits) || {};
  const entryLimit = Math.max(1, Math.min(MAX_ENTRIES, Math.round(finite(requestedLimits.maxEntries, 1, MAX_ENTRIES, MAX_ENTRIES))));
  const rollupLimit = Math.max(1, Math.min(MAX_ROLLUPS, Math.round(finite(requestedLimits.maxRollups, 1, MAX_ROLLUPS, MAX_ROLLUPS))));
  const entriesList = list(source.entries, MAX_ENTRIES + 1, true);
  const legacyTests = entriesList && entriesList.length ? [] : list(source.tests, MAX_ENTRIES + 1, true);
  if (entriesList === null || legacyTests === null) return null;
  const sourceEntries = entriesList.length ? entriesList : legacyTests;
  const seen = {};
  const entries = [];
  sourceEntries.forEach(function(value) {
    const entry = cleanEntry(value, sourceSchemaVersion);
    if (!entry || seen[entry.id]) return;
    seen[entry.id] = true;
    entries.push(entry);
  });
  entries.sort(function(a, b) { return String(b.timestamp).localeCompare(String(a.timestamp)); });

  const byKey = {};
  const archiveByKey = {};
  if (sourceSchemaVersion === SCHEMA_VERSION) {
    const sourceRollups = list(source.rollups, MAX_ROLLUPS, true);
    if (sourceRollups === null) return null;
    sourceRollups.forEach(function(value) {
      const rollup = cleanRollup(value);
      if (!rollup || rollup.count <= 0) return;
      const key = rollupKey(rollup);
      byKey[key] = byKey[key] ? mergeRollups(byKey[key], rollup) : rollup;
    });
  }
  if (sourceSchemaVersion === SCHEMA_VERSION) {
    const sourceArchive = list(source.archive, MAX_ARCHIVE, true);
    if (sourceArchive === null) return null;
    sourceArchive.forEach(function(value) {
      const rollup = cleanRollup(value);
      if (!rollup || rollup.count <= 0) return;
      rollup.localDay = null;
      rollup.id = "archive-" + stableHash(archiveKey(rollup));
      const key = archiveKey(rollup);
      archiveByKey[key] = archiveByKey[key] ? mergeRollups(archiveByKey[key], rollup) : rollup;
    });
  }
  entries.slice(entryLimit).forEach(function(entry) {
    const key = rollupKey(entry);
    byKey[key] = addEntryToRollup(byKey[key], entry);
  });
  const allRollups = Object.keys(byKey).map(function(key) { return byKey[key]; })
    .sort(function(a, b) { return String(b.latestTimestamp).localeCompare(String(a.latestTimestamp)); });
  allRollups.slice(rollupLimit).forEach(function(rollup) {
    const key = archiveKey(rollup);
    const archived = Object.assign({}, rollup, {localDay: null, id: "archive-" + stableHash(key)});
    archiveByKey[key] = archiveByKey[key] ? mergeRollups(archiveByKey[key], archived) : archived;
  });
  const rollups = allRollups.slice(0, rollupLimit);
  const archive = Object.keys(archiveByKey).map(function(key) { return archiveByKey[key]; })
    .sort(function(a, b) { return String(b.latestTimestamp).localeCompare(String(a.latestTimestamp)); });
  if (archive.length > MAX_ARCHIVE) return null;
  return {schemaVersion: SCHEMA_VERSION, entries: entries.slice(0, entryLimit), rollups, archive};
}

function add(raw, result) {
  const history = normalize(raw);
  if (!history) return raw;
  const entry = cleanEntry(result, SCHEMA_VERSION);
  if (!entry) return history;
  history.entries = history.entries.filter(function(existing) { return existing.id !== entry.id; });
  history.entries.unshift(entry);
  return normalize(history);
}

function remove(raw, id) {
  const history = normalize(raw);
  if (!history) return {history: raw, deleted: false, reason: "unsupported-schema"};
  const target = boundedText(id, "", 128);
  const before = history.entries.length;
  history.entries = history.entries.filter(function(entry) { return entry.id !== target; });
  if (history.entries.length !== before) return {history, deleted: true, reason: "deleted"};
  const compacted = history.rollups.concat(history.archive).some(function(rollup) { return rollup.id === target; });
  return {history, deleted: false, reason: compacted ? "compacted" : "missing"};
}

function applyEffects(raw, effects) {
  let history = normalize(raw);
  const effectList = list(effects, MAX_EFFECTS, true);
  if (!history || effectList === null) return null;
  for (const effect of effectList) {
    const value = object(effect);
    if (!value) continue;
    if (value.kind === "result" && value.entry) history = add(history, value.entry);
    else if (value.kind === "delete") history = remove(history, value.targetId).history;
    else if (value.kind === "clear") history = clear();
    if (!history) return null;
  }
  return normalize(history);
}

function clear() {
  return {schemaVersion: SCHEMA_VERSION, entries: [], rollups: [], archive: []};
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[\t\r\n]/.test(text) || /^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function toCsv(raw) {
  const history = normalize(raw);
  if (!history) return "";
  const columns = ["id", "timestamp", "localDay", "mode", "amount", "language", "punctuation", "numbers",
    "completion", "metricsVersion", "elapsedMs", "wpm", "rawWpm", "accuracy", "consistency",
    "characters", "correct", "errors", "corrected", "uncorrectedErrors", "corrections", "seed"];
  const rows = [columns.join(",")];
  history.entries.forEach(function(entry) {
    rows.push(columns.map(function(column) { return csvCell(entry[column]); }).join(","));
  });
  return rows.join("\n") + "\n";
}

const api = {
  SCHEMA_VERSION, MAX_ENTRIES, MAX_ROLLUPS, MAX_ARCHIVE, MAX_SAMPLES, MAX_EFFECTS, MODES, AMOUNTS, LANGUAGE_IDS,
  normalize, add, remove, applyEffects, clear, cleanEntry, cleanRollup, cohortKey, isQualified,
  localDayAt, deterministicId, toCsv
};
if (typeof module !== "undefined" && module.exports) module.exports = api;

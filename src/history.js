"use strict";

const MAX_ENTRIES = 100;
const MODES = ["time", "words"];
const AMOUNTS = {time: [15, 30, 60, 120], words: [10, 25, 50, 100]};
const LANGUAGE_IDS = [
  "english", "ada", "assembly", "bash", "c", "clojure", "cpp", "csharp", "css",
  "dart", "elixir", "go", "haskell", "html", "java", "javascript", "json", "julia",
  "kotlin", "lua", "nix", "objective-c", "ocaml", "perl", "php", "powershell",
  "python", "r", "ruby", "rust", "scala", "solidity", "sql", "swift", "typescript",
  "yaml", "zig"
];

function number(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function boundedText(value, fallback, maximumLength) {
  return String(value ?? fallback).slice(0, maximumLength);
}

function cleanEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const mode = MODES.includes(entry.mode) ? entry.mode : "words";
  const requestedAmount = Number(entry.amount);
  const amount = Number.isFinite(requestedAmount) && AMOUNTS[mode].includes(requestedAmount)
    ? requestedAmount
    : (mode === "time" ? 30 : 25);
  return {
    id: boundedText(entry.id, entry.timestamp ?? Date.now(), 128),
    timestamp: boundedText(entry.timestamp, new Date().toISOString(), 64),
    mode,
    amount,
    language: LANGUAGE_IDS.includes(entry.language) ? entry.language : "english",
    wpm: number(entry.wpm, 0, 9999, 0),
    rawWpm: number(entry.rawWpm, 0, 9999, 0),
    accuracy: number(entry.accuracy, 0, 100, 0),
    consistency: number(entry.consistency, 0, 100, 0),
    characters: number(entry.characters, 0, 1000000, 0),
    correct: number(entry.correct, 0, 1000000, 0),
    errors: number(entry.errors, 0, 1000000, 0),
    corrected: number(entry.corrected, 0, 1000000, 0),
    uncorrectedErrors: number(entry.uncorrectedErrors, 0, 1000000, 0),
    corrections: number(entry.corrections, 0, 1000000, 0),
    seed: boundedText(entry.seed, "", 128)
  };
}

function normalize(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const entries = Array.isArray(source.entries) ? source.entries : (Array.isArray(source.tests) ? source.tests : []);
  return {
    schemaVersion: 1,
    entries: entries.map(cleanEntry).filter(Boolean).slice(0, MAX_ENTRIES)
  };
}

function add(raw, result) {
  const history = normalize(raw);
  const entry = cleanEntry(result);
  if (entry) history.entries.unshift(entry);
  history.entries = history.entries.slice(0, MAX_ENTRIES);
  return history;
}

const api = {MAX_ENTRIES, normalize, add, cleanEntry};
if (typeof module !== "undefined" && module.exports) module.exports = api;

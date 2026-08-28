"use strict";

const MAX_WORDS = 1000;
const MAX_SEED_LENGTH = 128;

function boundedSeed(value) {
  return String(value ?? "omatype").slice(0, MAX_SEED_LENGTH);
}

function boundedCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 25;
  return Math.min(MAX_WORDS, Math.max(1, Math.floor(number)));
}

function hashSeed(value) {
  let hash = 2166136261 >>> 0;
  const seed = boundedSeed(value);
  for (let index = 0; index < seed.length; index++) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rng(seed) {
  let state = hashSeed(seed);
  return function() {
    state |= 0;
    state = state + 0x6D2B79F5 | 0;
    let mixed = Math.imul(state ^ state >>> 15, 1 | state);
    mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed;
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

function generate(options) {
  options = options || {};
  const source = Array.isArray(options.words) && options.words.length ? options.words : ["type", "calm", "focus"];
  const count = boundedCount(options.amount);
  const seed = boundedSeed(options.seed);
  const random = rng(seed);
  const output = [];
  for (let index = 0; index < count; index++) {
    let word = String(source[Math.floor(random() * source.length)]);
    if (options.numbers && random() < 0.14) word += String(Math.floor(random() * 100));
    if (options.punctuation && random() < 0.22) {
      const marks = [",", ".", "?", "!"];
      word += marks[Math.floor(random() * marks.length)];
    }
    output.push(word);
  }
  return {seed, mode: options.mode || "words", words: output, text: output.join(" ")};
}

if (typeof module !== "undefined") module.exports = {MAX_WORDS, MAX_SEED_LENGTH, hashSeed, rng, generate};

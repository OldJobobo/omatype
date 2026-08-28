const test = require("node:test");
const assert = require("node:assert/strict");
const Generator = require("../src/generator.js");
const words = require("../data/words-en.json");

test("same seed produces the same bounded word test", () => {
  const a = Generator.generate({ mode: "words", amount: 25, seed: "oma", words });
  const b = Generator.generate({ mode: "words", amount: 25, seed: "oma", words });
  assert.equal(a.text, b.text);
  assert.equal(a.words.length, 25);
  assert.ok(a.words.every(word => words.includes(word)));
});

test("punctuation and numbers are deterministic opt-in transformations", () => {
  const result = Generator.generate({ mode: "words", amount: 100, seed: "options", words, punctuation: true, numbers: true });
  assert.match(result.text, /[.,?!]/);
  assert.match(result.text, /\d/);
  assert.equal(result.text, Generator.generate({ mode: "words", amount: 100, seed: "options", words, punctuation: true, numbers: true }).text);
});

test("generation bounds untrusted counts and seed size", () => {
  const huge = Generator.generate({ amount: 1e12, seed: "s".repeat(1000), words: ["a"] });
  assert.equal(huge.words.length, 1000);
  assert.equal(huge.seed.length, 128);
  const nonFinite = Generator.generate({ amount: Infinity, words: ["a"] });
  assert.equal(nonFinite.words.length, 25);
});

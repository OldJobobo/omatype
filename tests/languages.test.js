"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Languages = require("../src/languages.js");
const Generator = require("../src/generator.js");

const expectedNaturalPacks = [
  ["english", "English"], ["german", "Deutsch"], ["spanish", "Español"],
  ["french", "Français"], ["italian", "Italiano"], ["portuguese", "Português"],
  ["dutch", "Nederlands"]
];

const expectedProgrammingPacks = [
  "ada", "assembly", "bash", "c", "clojure", "cpp", "csharp", "css",
  "dart", "elixir", "go", "haskell", "html", "java", "javascript", "json",
  "julia", "kotlin", "lua", "nix", "objective-c", "ocaml", "perl", "php",
  "powershell", "python", "r", "ruby", "rust", "scala", "solidity", "sql",
  "swift", "typescript", "yaml", "zig"
];

test("registry exposes an extensive original programming-language catalog", () => {
  const options = Languages.options();
  assert.equal(options[0].id, "english");
  assert.equal(options[0].category, "natural");
  for (const id of expectedProgrammingPacks) {
    assert.ok(options.some(option => option.id === id && option.category === "programming"), id);
  }
  assert.ok(options.filter(option => option.category === "programming").length >= 36);
});

test("registry exposes curated common natural-language packs", () => {
  const options = Languages.options();
  assert.deepEqual(options.slice(0, expectedNaturalPacks.length).map(option => [option.id, option.label]), expectedNaturalPacks);
  for (const [id] of expectedNaturalPacks) {
    const pack = Languages.get(id);
    assert.equal(pack.category, "natural");
    assert.equal(pack.words.length, 500, `${id} natural vocabulary`);
    if (id !== "english") assert.ok(pack.words.some(word => /[^\x00-\x7f]/.test(word)), `${id} native spelling`);
    const generated = Generator.generate({words: pack.words, amount: 80, seed: `natural-${id}`, punctuation: true, numbers: true});
    assert.equal(generated.words.length, 80);
    assert.ok(generated.words.every(word => pack.words.some(source => word.startsWith(source))), `${id} generated vocabulary`);
  }
});

test("every pack has bounded unique typing tokens and provenance metadata", () => {
  for (const option of Languages.options()) {
    const pack = Languages.get(option.id);
    assert.equal(pack.id, option.id);
    assert.ok(pack.words.length >= 24, `${option.id} vocabulary`);
    assert.equal(new Set(pack.words).size, pack.words.length, `${option.id} duplicates`);
    assert.ok(pack.words.every(word => typeof word === "string" && word.length >= 1 && word.length <= 40 && !/\s/.test(word)), option.id);
    assert.equal(pack.origin, option.category === "natural"
      ? "OmaType curation with MIT-licensed thousand-most-common-words data"
      : "OmaType original curated vocabulary");
  }
});

test("unknown and malformed identifiers fail closed to English", () => {
  assert.equal(Languages.get("../../etc/passwd").id, "english");
  assert.equal(Languages.get(null).id, "english");
  assert.equal(Languages.has("rust"), true);
  assert.equal(Languages.has("Rust"), false);
  assert.equal(Languages.has({}), false);
});

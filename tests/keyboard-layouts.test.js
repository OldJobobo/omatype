"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Layouts = require("../src/keyboard-layouts.js");

const example = name => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "examples", name), "utf8"));

test("ships the six standard presets without an Engrammer built-in", () => {
  assert.deepEqual(Layouts.BUILT_INS.map(layout => layout.id), ["qwerty", "qwertz", "azerty", "dvorak", "colemak", "workman"]);
  assert.equal(Layouts.ENGRAMMER, undefined);
  assert.ok(Layouts.QWERTY.layers[0].keys.length >= 100);
  assert.equal(Layouts.QWERTZ.name, "German QWERTZ");
  assert.ok(Layouts.QWERTZ.layers[0].keys.some(item => item.label === "Ü"));
  assert.ok(Layouts.QWERTZ.layers[0].keys.some(item => item.label === "ß" && item.shift === "?"));
  assert.ok(Layouts.QWERTZ.layers[0].keys.some(item => item.label === "<" && item.shift === ">"));
  assert.ok(Layouts.QWERTZ.layers[0].keys.some(item => item.label === "ß" && item.altGr === "\\"));
  assert.ok(Layouts.QWERTZ.layers[0].keys.some(item => item.label === "0" && item.altGr === "}"));
  assert.ok(Layouts.QWERTZ.layers[0].keys.some(item => item.label === "Q" && item.altGr === "@"));
});

test("remapped presets carry their own punctuation instead of QWERTY leftovers", () => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  for (const layout of Layouts.BUILT_INS) {
    const main = layout.layers[0].keys.filter(item => !item.numpad && item.y >= 1 && item.y <= 4 && Array.from(item.label).length === 1);
    const labels = main.map(item => item.label);
    assert.deepEqual(labels.filter((label, index) => labels.indexOf(label) !== index), [], layout.id + " repeats a main-block key");
    for (const letter of letters)
      assert.equal(labels.filter(label => label === letter).length, 1, layout.id + " has exactly one " + letter);
    for (const item of main.filter(candidate => letters.indexOf(candidate.label) >= 0))
      assert.ok(item.shift === "" || item.shift === item.label, layout.id + " " + item.label + " shows a foreign shift legend " + item.shift);
  }
  const key = (layout, label) => layout.layers[0].keys.find(item => !item.numpad && item.label === label);
  assert.equal(key(Layouts.DVORAK, ",").shift, "<");
  assert.equal(key(Layouts.DVORAK, "'").shift, "\"");
  assert.equal(key(Layouts.DVORAK, ";").shift, ":");
  assert.equal(key(Layouts.DVORAK, "/").shift, "?");
  assert.equal(key(Layouts.DVORAK, "[").y, 1);
  assert.equal(key(Layouts.COLEMAK, ";").y, 2);
  assert.equal(key(Layouts.COLEMAK, "O").y, 3);
  assert.equal(key(Layouts.WORKMAN, ";").shift, ":");
  assert.equal(key(Layouts.AZERTY, "&").shift, "1");
  assert.equal(key(Layouts.AZERTY, "à").altGr, "@");
  assert.equal(key(Layouts.AZERTY, "M").y, 3);
  assert.equal(key(Layouts.AZERTY, ",").shift, "?");
  assert.equal(key(Layouts.AZERTY, "<").shift, ">");
  assert.ok(Layouts.AZERTY.layers[0].keys.some(item => item.label === "AltGr"));
});

test("built-in keys stay inside their declared bounds", () => {
  for (const layout of Layouts.BUILT_INS) {
    const layer = layout.layers[0];
    for (const item of layer.keys) {
      assert.ok(item.x + item.width <= layer.bounds.width + 0.001, layout.id + " " + item.label);
      assert.ok(item.y + item.height <= layer.bounds.height + 0.001, layout.id + " " + item.label);
    }
  }
});

test("marks only the numeric cluster as numpad so shared labels stay unambiguous", () => {
  const keys = Layouts.QWERTY.layers[0].keys;
  const numpad = keys.filter(item => item.numpad);
  assert.ok(numpad.length >= 17);
  assert.ok(numpad.every(item => item.x >= 19));
  assert.equal(keys.filter(item => item.label === "-").length, 2);
  assert.equal(keys.filter(item => item.label === "-" && item.numpad).length, 1);
  assert.equal(keys.filter(item => item.label === "/").length, 2);
  assert.equal(keys.filter(item => item.label === "/" && item.numpad).length, 1);
});

test("ships Engrammer as a positioned custom layout file", () => {
  const source = example("omatype-keyboard.json");
  const result = Layouts.parse(JSON.stringify(source));
  assert.equal(result.status, "ready");
  assert.equal(result.value.id, "custom");
  assert.equal(result.value.name, "Engrammer Remnant");
  assert.equal(result.value.layers.length, 7);
  assert.equal(result.value.layers[0].keys.length, 58);
  assert.equal(result.value.layers[0].keys[13].label, "B");
  assert.equal(result.value.layers[0].keys[28].label, "A");
  assert.deepEqual(result.value.layers[0].bounds, {width: 17, height: 5.45});
  assert.deepEqual(result.value.layers[0].layerThumbKeys, [50, 51, 52, 53, 54, 55]);
  assert.equal(result.value.layers[1].name, "Cursor");
  assert.equal(result.value.layers[6].name, "System");
  assert.ok(result.value.layers[0].keys[0].y > result.value.layers[0].keys[3].y);
  assert.equal(result.value.layers[0].keys[12].shift, "|");
});

test("normalizes the simple rows example and keeps the two formats distinct", () => {
  const source = example("omatype-keyboard-simple.json");
  const result = Layouts.parse(JSON.stringify(source));
  assert.equal(result.status, "ready");
  assert.equal(result.value.name, "Example split keyboard");
  assert.equal(result.value.layers.length, 2);
  assert.equal(result.value.layers[0].keys, undefined);
  assert.deepEqual(result.value.layers[0].rows[3][0], {label: "Space", shift: "", altGr: "", shiftAltGr: "", width: 5});
});

test("rejects executable, malformed, oversized, and unsupported structures", () => {
  assert.equal(Layouts.parse("not json").status, "invalid");
  assert.equal(Layouts.normalize({schemaVersion: 2, layers: []}), null);
  assert.equal(Layouts.normalize({schemaVersion: 1, layers: [{rows: [[{label: "x".repeat(40)}]]}]}), null);
  assert.equal(Layouts.normalize({schemaVersion: 1, layers: Array.from({length: 13}, () => ({rows: [["A"]]}))}), null);
  assert.equal(Layouts.normalize({schemaVersion: 1, layers: [{image: "file:///tmp/run.qml", rows: []}]}), null);
});

test("bounds positioned layers with required geometry and thumb indices", () => {
  const base = {label: "A", x: 0, y: 0, width: 1, height: 1};
  const positioned = keys => ({schemaVersion: 1, name: "Mine", layers: [{bounds: {width: 4, height: 2}, keys}]});
  assert.equal(Layouts.normalize(positioned([base])).layers[0].keys[0].label, "A");
  assert.equal(Layouts.normalize(positioned([{label: "A", x: -1, y: 0}])), null);
  assert.equal(Layouts.normalize(positioned([{label: "A", x: 3.5, y: 0, width: 1, height: 1}])), null, "keys must end inside the bounds width");
  assert.equal(Layouts.normalize(positioned([{label: "A", x: 0, y: 1.5, width: 1, height: 1}])), null, "keys must end inside the bounds height");
  assert.equal(Layouts.normalize(positioned([{label: "A", x: 3, y: 1, width: 1, height: 1}])).layers[0].keys.length, 1);
  assert.equal(Layouts.normalize({schemaVersion: 1, layers: [{keys: [base]}]}), null, "positioned layers require bounds");
  assert.equal(Layouts.normalize({schemaVersion: 1, layers: [{bounds: {width: 4, height: 2}, keys: [base], layerThumbKeys: [3]}]}), null);
  assert.equal(Layouts.normalize(positioned(Array.from({length: 129}, () => base))), null);
  const blank = Layouts.normalize(positioned([{label: "", x: 0, y: 0}]));
  assert.equal(blank.layers[0].keys[0].label, "", "blank positioned keys are allowed");
  const thumbed = Layouts.normalize({schemaVersion: 1, layers: [{bounds: {width: 4, height: 2}, keys: [base, base], layerThumbKeys: [1]}]});
  assert.deepEqual(thumbed.layers[0].layerThumbKeys, [1]);
});

test("custom option appears only after a valid file is loaded", () => {
  assert.deepEqual(Layouts.options(null).map(option => option.id), ["qwerty", "qwertz", "azerty", "dvorak", "colemak", "workman"]);
  const custom = Layouts.normalize({schemaVersion: 1, name: "Mine", layers: [{rows: [["A"]]}]});
  assert.deepEqual(Layouts.options(custom).map(option => option.id), ["qwerty", "qwertz", "azerty", "dvorak", "colemak", "workman", "custom"]);
  assert.equal(Layouts.get("custom", custom), custom);
  assert.equal(Layouts.get("missing", custom).id, "qwerty");
});

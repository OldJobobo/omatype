"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Layouts = require("../src/keyboard-layouts.js");

test("ships themeable QWERTY and Engrammer presets", () => {
  assert.deepEqual(Layouts.BUILT_INS.map(layout => layout.id), ["qwerty", "qwertz", "azerty", "dvorak", "colemak", "workman", "engrammer"]);
  assert.equal(Layouts.ENGRAMMER.layers.length, 7);
  assert.equal(Layouts.ENGRAMMER.layers[0].keys[13].label, "B");
  assert.equal(Layouts.ENGRAMMER.layers[0].keys[28].label, "A");
  assert.equal(Layouts.ENGRAMMER.layers[0].keys.length, 58);
  assert.equal(Layouts.ENGRAMMER.layers[1].name, "Cursor");
  assert.equal(Layouts.ENGRAMMER.layers[6].name, "System");
  assert.ok(Layouts.ENGRAMMER.layers[0].keys[0].y > Layouts.ENGRAMMER.layers[0].keys[3].y);
  assert.deepEqual(Layouts.ENGRAMMER.layers[0].layerThumbKeys, [50, 51, 52, 53, 54, 55]);
  assert.deepEqual(Layouts.ENGRAMMER.layers[0].keys[12], {label: "\\", x: 0, y: 1.3, width: 0.9, height: 0.88, shift: "|", altGr: "", shiftAltGr: ""});
  assert.ok(Layouts.QWERTY.layers[0].keys.length >= 100);
  assert.equal(Layouts.QWERTZ.name, "German QWERTZ");
  assert.ok(Layouts.QWERTZ.layers[0].keys.some(item => item.label === "Ü"));
  assert.ok(Layouts.QWERTZ.layers[0].keys.some(item => item.label === "ß" && item.shift === "?"));
  assert.ok(Layouts.QWERTZ.layers[0].keys.some(item => item.label === "<" && item.shift === ">"));
  assert.ok(Layouts.QWERTZ.layers[0].keys.some(item => item.label === "ß" && item.altGr === "\\"));
  assert.ok(Layouts.QWERTZ.layers[0].keys.some(item => item.label === "0" && item.altGr === "}"));
  assert.ok(Layouts.QWERTZ.layers[0].keys.some(item => item.label === "Q" && item.altGr === "@"));
});

test("normalizes bounded declarative custom layouts", () => {
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "examples", "omatype-keyboard.json"), "utf8"));
  const result = Layouts.parse(JSON.stringify(source));
  assert.equal(result.status, "ready");
  assert.equal(result.value.id, "custom");
  assert.equal(result.value.layers.length, 2);
  assert.deepEqual(result.value.layers[0].rows[3][0], {label: "Space", shift: "", altGr: "", shiftAltGr: "", width: 5});
});

test("rejects executable, malformed, oversized, and unsupported structures", () => {
  assert.equal(Layouts.parse("not json").status, "invalid");
  assert.equal(Layouts.normalize({schemaVersion: 2, layers: []}), null);
  assert.equal(Layouts.normalize({schemaVersion: 1, layers: [{rows: [[{label: "x".repeat(40)}]]}]}), null);
  assert.equal(Layouts.normalize({schemaVersion: 1, layers: Array.from({length: 13}, () => ({rows: [["A"]]}))}), null);
  assert.equal(Layouts.normalize({schemaVersion: 1, layers: [{image: "file:///tmp/run.qml", rows: []}]}), null);
});

test("custom option appears only after a valid file is loaded", () => {
  assert.deepEqual(Layouts.options(null).map(option => option.id), ["qwerty", "qwertz", "azerty", "dvorak", "colemak", "workman", "engrammer"]);
  const custom = Layouts.normalize({schemaVersion: 1, name: "Mine", layers: [{rows: [["A"]]}]});
  assert.deepEqual(Layouts.options(custom).map(option => option.id), ["qwerty", "qwertz", "azerty", "dvorak", "colemak", "workman", "engrammer", "custom"]);
  assert.equal(Layouts.get("custom", custom), custom);
  assert.equal(Layouts.get("missing", custom).id, "qwerty");
});

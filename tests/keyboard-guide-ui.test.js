"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

test("overlay integrates a selectable, keyboard-accessible layout guide", () => {
  const qml = read("OmaType.qml");
  for (const token of [
    'import "src/keyboard-layouts.js" as KeyboardLayouts',
    'import "components/keyboard" as KeyboardUi',
    "KeyboardUi.KeyboardGuide",
    'event.key === Qt.Key_K && controlHeld',
    'id: keyboardLayoutStore',
    'KeyboardLayouts.parse(text)',
    'root.addKeyboardLayout(modelData.id)',
    'root.removeKeyboardLayout(addedLayoutOption.modelData.id)',
    'acceptedButtons: Qt.LeftButton | Qt.RightButton',
    'mouse.button === Qt.RightButton',
    'root.cycleKeyboardLayer(-1)',
    'root.cycleKeyboardLayer(1)',
    'nextCharacter: root.nextCharacter'
  ]) assert.ok(qml.includes(token), token);
});

test("guide renders data-driven layers with next-key highlighting", () => {
  const guide = read("components/keyboard/KeyboardGuide.qml");
  for (const token of ["activeLayer", "layerSelected", "activeLayer.rows", "activeLayer.keys", "diagram.positioned", "isLayerThumb", "layerThumb", "characterModifiers", "neededModifiers", "needsShift", "needsAltGr", "modifierHighlight", "layerAccentColor", "shiftAltGr", "highlighted", "Accessible.name"])
    assert.ok(guide.includes(token), token);
  assert.ok(guide.includes('color: "transparent"'));
  assert.doesNotMatch(guide, /Qt\.resolvedUrl|\bImage\s*\{/);
});

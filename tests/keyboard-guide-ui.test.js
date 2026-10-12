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
    'root.cycleKeyboardLayout(-1)',
    'root.cycleKeyboardLayout(1)',
    'root.toggleKeyboardLayoutPicker()',
    'root.moveKeyboardLayoutPicker(-1)',
    'root.moveKeyboardLayoutPicker(1)',
    'root.confirmKeyboardLayoutPicker()',
    'root.removeActiveKeyboardLayout()',
    'event.key === Qt.Key_A',
    'event.key === Qt.Key_D',
    'event.key === Qt.Key_Up',
    'event.key === Qt.Key_Down',
    'nextCharacter: root.nextCharacter'
  ]) assert.ok(qml.includes(token), token);
});

test("guide renders data-driven layers with unambiguous next-key highlighting", () => {
  const guide = read("components/keyboard/KeyboardGuide.qml");
  for (const token of ["activeLayer", "layerSelected", "activeLayer.rows", "activeLayer.keys", "diagram.positioned", "isLayerThumb", "layerThumb", "characterModifiers", "neededModifiers", "needsShift", "needsAltGr", "modifierHighlight", "layerAccentColor", "shiftAltGr", "highlighted", "keyMatchesCharacter", "characterKeyIndex", "numpad", "Accessible.name"])
    assert.ok(guide.includes(token), token);
  assert.match(guide, /highlighted:\s*root\.characterKeyIndex === index/);
  assert.ok(guide.includes('color: "transparent"'));
  assert.doesNotMatch(guide, /Qt\.resolvedUrl|\bImage\s*\{/);
});

test("layout shortcuts and the add picker act only while the guide is on screen", () => {
  const qml = read("OmaType.qml");
  assert.ok(qml.includes("readonly property bool keyboardGuideActive: root.userSettings.appearance.keyboardGuide && !root.result && !root.settingsOpen && !root.languagePanelOpen && !root.progressOpen"));
  assert.ok(qml.includes("readonly property bool keyboardLayoutPickerVisible: root.keyboardLayoutPickerOpen && root.keyboardGuideActive && root.availableKeyboardLayouts.length > 0"));
  assert.ok(qml.includes("onKeyboardGuideActiveChanged: if (!root.keyboardGuideActive) root.keyboardLayoutPickerOpen = false"));
  assert.ok(qml.includes("if (!root.keyboardGuideActive || root.availableKeyboardLayouts.length === 0) {"));
  // The key-capturing branch follows what is drawn, never the bare open flag.
  assert.ok(qml.includes("if (root.keyboardLayoutPickerVisible) {"));
  assert.doesNotMatch(qml, /if \(root\.keyboardLayoutPickerOpen &&/);
  for (const key of ["Left", "Right", "Up", "Down", "A", "D"]) {
    assert.ok(qml.includes(`if (root.keyboardGuideActive && controlHeld && (event.modifiers & Qt.ShiftModifier) && event.key === Qt.Key_${key}) {`), key);
    assert.ok(!qml.includes(`                if (controlHeld && (event.modifiers & Qt.ShiftModifier) && event.key === Qt.Key_${key}) {`), key + " must be gated");
  }
  assert.ok(qml.includes("visible: root.keyboardGuideActive"));
  assert.ok(qml.includes("visible: !root.keyboardLayoutPickerVisible"));
  assert.ok(qml.includes("anchors.verticalCenter: keyboardLayoutSelector.verticalCenter"));
  assert.doesNotMatch(qml, /anchors\.bottom: keyboardLayoutSelector\.top/);
});

test("guide scales rows layers and fits labels without breaking words", () => {
  const guide = read("components/keyboard/KeyboardGuide.qml");
  for (const token of ["rowUnit", "rowHeight", "width: diagram.rowUnit * modelData.width", "height: diagram.rowHeight", "fontSizeMode: Text.Fit", "wrapMode: Text.WordWrap"])
    assert.ok(guide.includes(token), token);
  assert.doesNotMatch(guide, /wrapMode: Text\.Wrap\b/);
  assert.doesNotMatch(guide, /Math\.max\(34, 43 \* modelData\.width\)/);
});

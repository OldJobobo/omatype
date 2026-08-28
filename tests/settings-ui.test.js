"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

function includesAll(source, values) {
  for (const value of values) assert.ok(source.includes(value), value);
}

test("settings drawer is componentized into navigable local sections", () => {
  const root = read("OmaType.qml");
  const drawer = read("components/settings/SettingsDrawer.qml");
  const row = read("components/settings/OptionRow.qml");
  includesAll(root, [
    'import "components/settings" as SettingsUi',
    "SettingsUi.SettingsDrawer",
    "onSettingChanged: function(category, key, value)",
    "root.applySetting(category, key, value)",
    "onCategoryReset: function(category)",
    "root.resetSettingsCategory(category)"
  ]);
  includesAll(drawer, [
    'property var settings',
    'signal settingChanged(string category, string key, var value)',
    'signal categoryReset(string category)',
    'model: ["test", "behavior", "display", "caret", "access"]',
    'OptionRow',
    'text: "settings"',
    'text: "reset section"',
    'function moveSection(delta)',
    'function scrollBy(delta)',
    'function measuredColumnHeight(column)',
    'contentHeight: root.measuredColumnHeight(activeColumn)',
    'property bool compactRows: true',
    'OptionRow { compact: true; label: "timer"',
    'OptionRow { compact: true; label: "focus footer"',
    'scroller.visibleArea.yPosition'
  ]);
  for (const setting of [
    "quick restart", "stop on error", "strict space", "backspace", "quick end",
    "timer", "live wpm", "live accuracy", "highlight", "typed text", "smooth scroll",
    "lines", "font size", "line width", "line height", "word spacing",
    "caret style", "caret motion", "caret color", "blink", "blink speed", "custom caret color", "thickness",
    "reduced motion", "high contrast", "error indicator"
  ]) assert.ok(drawer.includes(setting), setting);
  includesAll(row, ["property string label", "property var options", "property var value", "property bool compact", "property bool narrowLayout: width < 620", "signal selected(var value)", "implicitHeight: narrowLayout ? 68 : (compact ? 36 : Math.max(52, choiceRow.implicitHeight + 18))", "height: implicitHeight", "id: choiceViewport", "contentWidth: choiceRow.implicitWidth", "interactive: root.narrowLayout && contentWidth > width", "clip: root.narrowLayout"]);
});

test("settings controls expose keyboard selection and accessibility metadata", () => {
  const root = read("OmaType.qml");
  const drawer = read("components/settings/SettingsDrawer.qml");
  const row = read("components/settings/OptionRow.qml");
  includesAll(row, [
    "activeFocusOnTab: true",
    "function selectNext(delta)",
    "Accessible.role: Accessible.ListItem",
    "Accessible.name: root.label",
    "Accessible.onPressAction:",
    "Keys.onPressed: function(event)",
    "Qt.Key_Space",
    "root.selected(root.options[next])"
  ]);
  includesAll(drawer, [
    "function focusRow(delta)",
    "function activateFocusedRow(delta)",
    "Accessible.role: Accessible.Dialog",
    "Accessible.name: \"OmaType settings\""
  ]);
  includesAll(root, [
    "settingsPanel.focusRow(event.modifiers & Qt.ShiftModifier ? -1 : 1)",
    "settingsPanel.activateFocusedRow(1)",
    "settingsPanel.resetCurrentSection()",
    "event.key === Qt.Key_Comma && (event.modifiers & Qt.ControlModifier)",
    "event.key === Qt.Key_L && (event.modifiers & Qt.ControlModifier)",
    "languageGrid.currentIndex",
    "root.chooseLanguage(root.languageOptions[languageGrid.currentIndex].id)",
    "Accessible.role: Accessible.Button",
    "Accessible.name: \"Language \" + modelData.label"
  ]);
});

test("settings persistence migrates the previous state-scoped preference file", () => {
  const q = read("OmaType.qml");
  includesAll(q, [
    'id: legacySettingsStore',
    '"/.local/state/omarchy/omatype-settings.json"',
    "if (!settingsStore.loaded && legacySettingsStore.loaded)",
    "Settings.normalize({",
    "root.persistSettings()"
  ]);
});

test("settings persistence uses config storage and includes every schema category", () => {
  const root = read("OmaType.qml");
  includesAll(root, [
    '/.config/omarchy/omatype-settings.json',
    'property var accessibility: ({})',
    'accessibility: settingsAdapter.accessibility',
    'settingsAdapter.accessibility = root.userSettings.accessibility'
  ]);
  assert.ok(root.includes('id: settingsStore\n        path: Quickshell.env("HOME") + "/.config/omarchy/omatype-settings.json"'));
});

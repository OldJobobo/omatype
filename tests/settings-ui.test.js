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
    "event.key === Qt.Key_Comma && controlHeld",
    "event.key === Qt.Key_L && controlHeld",
    "languageGrid.currentIndex",
    "root.chooseLanguage(root.languageOptions[languageGrid.currentIndex].id)",
    "Accessible.role: Accessible.Button",
    "Accessible.name: \"Language \" + modelData.label"
  ]);
});

test("quick end takes precedence over the optional Enter restart alias during an active run", () => {
  const qml = read("OmaType.qml");
  const enterBlock = qml.slice(qml.indexOf("if (event.key === Qt.Key_Enter || event.key === Qt.Key_Return)"));
  const quickEnd = enterBlock.indexOf("InputPolicy.shouldQuickEnd");
  const enterRestart = enterBlock.indexOf('InputPolicy.isQuickRestart(root.activeSettings.behavior.quickRestart, "enter")');
  assert.ok(quickEnd >= 0 && enterRestart >= 0 && quickEnd < enterRestart);
});

test("keyboard-only operation covers every state and keeps offscreen choices visible", () => {
  const root = read("OmaType.qml");
  const drawer = read("components/settings/SettingsDrawer.qml");
  const row = read("components/settings/OptionRow.qml");
  const readme = read("README.md");

  includesAll(root, [
    "function openSettingsPanel(section)",
    "function closeSettingsPanel()",
    "event.key === Qt.Key_Escape && (event.modifiers & Qt.ControlModifier)",
    "event.key === Qt.Key_R && (event.modifiers & Qt.ControlModifier)",
    "settingsPanel.focusRow(event.modifiers & Qt.ShiftModifier ? -1 : 1)",
    "settingsPanel.focusRow(-1)",
    "settingsPanel.focusRow(1)",
    "settingsPanel.activateFocusedRow(-1)",
    "settingsPanel.activateFocusedRow(1)",
    "settingsPanel.focusBoundary(false)",
    "settingsPanel.focusBoundary(true)",
    "settingsPanel.moveSection(-1)",
    "settingsPanel.moveSection(1)",
    "settingsPanel.openSection(event.key - Qt.Key_1)",
    "languageGrid.currentIndex = 0",
    "languageGrid.currentIndex = root.languageOptions.length - 1",
    "nextLanguage -= 6",
    "nextLanguage += 6",
    'text: "ctrl+r  restart"',
    'text: "ctrl+esc  close"'
  ]);

  includesAll(drawer, [
    "function focusBoundary(last)",
    "function openSection(index)",
    "function focusFirstRow()",
    'text: "ctrl+1–5 section   tab/↑/↓ row   ←/→ value   r reset   esc done"'
  ]);

  includesAll(row, [
    "function ensureOptionVisible(index)",
    "optionRepeater.itemAt(index)",
    "choiceViewport.contentX",
    "Qt.callLater(function() { root.ensureOptionVisible(next) })",
    "onValueChanged:",
    "onWidthChanged:"
  ]);

  for (const token of ["Ctrl+Escape", "Ctrl+R", "Ctrl+1", "Home/End", "Page Up/Page Down", "Left/Right changes the focused value"])
    assert.ok(readme.includes(token), token);
});

test("language picker owns activation keys instead of letting GridView consume them", () => {
  const root = read("OmaType.qml");
  includesAll(root, [
    "function closeLanguagePanel()",
    "languageGrid.forceActiveFocus()",
    "id: languageGrid",
    "keyNavigationEnabled: false",
    "Keys.priority: Keys.BeforeItem",
    "Keys.onPressed: function(event)",
    "else if (event.key === Qt.Key_End) nextLanguage = root.languageOptions.length - 1",
    "root.chooseLanguage(root.languageOptions[languageGrid.currentIndex].id)"
  ]);
});

test("child controls preserve invariant global and section shortcuts", () => {
  const root = read("OmaType.qml");
  const row = read("components/settings/OptionRow.qml");
  includesAll(root, [
    "if (event.modifiers & Qt.ControlModifier) root.dismiss()",
    "else root.closeLanguagePanel()"
  ]);
  includesAll(row, [
    "if (event.modifiers & Qt.ControlModifier) return",
    "if (event.key === Qt.Key_Left) root.selectNext(-1)"
  ]);
});

test("ready and running setup controls have direct keyboard shortcuts", () => {
  const root = read("OmaType.qml");
  includesAll(root, [
    "function cycleAmount(delta)",
    "event.key === Qt.Key_M && controlHeld",
    "event.key === Qt.Key_Up && controlHeld",
    "event.key === Qt.Key_Down && controlHeld",
    "event.key === Qt.Key_P && controlHeld",
    "event.key === Qt.Key_N && controlHeld",
    'text: "ctrl+m mode   ctrl+↑/↓ length   ctrl+p punctuation   ctrl+n numbers"',
    'Accessible.name: "Toggle punctuation"',
    'Accessible.name: "Toggle numbers"',
    'Accessible.name: "Use " + modelData + " mode"',
    'Accessible.name: "Use test length " + modelData'
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
    'property var progress: ({})',
    'accessibility: settingsAdapter.accessibility',
    'progress: settingsAdapter.progress',
    'settingsAdapter.accessibility = root.userSettings.accessibility',
    'settingsAdapter.progress = root.userSettings.progress'
  ]);
  assert.ok(root.includes('id: settingsStore\n        path: Quickshell.env("HOME") + "/.config/omarchy/omatype-settings.json"'));
});

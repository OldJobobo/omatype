"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

function includesAll(source, values) {
  for (const value of values) assert.ok(source.includes(value), value);
}

test("SecureFile uses fixed argv, isolated Python, framed stdin, generations, and timeouts", () => {
  const qml = read("components/SecureFile.qml");
  includesAll(qml, [
    '["/usr/bin/python3", "-I", "-S", root.helperPath, operation, root.path, String(root.maxBytes)]',
    "clearEnvironment: true",
    '"HOME": Quickshell.env("HOME")',
    '"LANG": "C.UTF-8"',
    'String(byteLength) + "\\n" + text',
    "stdinEnabled: true",
    "onStarted: writeProcess.write(writeProcess.frame)",
    "property int requestGeneration: 0",
    "property var queuedWrite: null",
    "property bool readQueued: false",
    "readProcess.signal(9)",
    "writeProcess.signal(9)"
  ]);
  assert.doesNotMatch(qml, /(?:bash|sh)\s*,\s*"-c"|execDetached|startDetached/);
});

test("FileView is watcher-only and never carries OmaType content", () => {
  const secure = read("components/SecureFile.qml");
  const watcher = secure.slice(secure.indexOf("FileView {"), secure.indexOf("Timer {", secure.indexOf("FileView {")));
  includesAll(watcher, ["preload: false", "blockAllReads: true", "watchChanges: root.watchChanges", "onFileChanged:"]);
  assert.doesNotMatch(watcher, /adapter:|\.text\(|\.data\(|reload\(|writeAdapter|setText|setData/);
  for (const name of ["OmaType.qml", "BarWidget.qml"]) {
    assert.doesNotMatch(read(name), /\bFileView\s*\{/, name);
  }
});

test("all persistence paths use secure caps and explicit normalization", () => {
  const overlay = read("OmaType.qml");
  const bar = read("BarWidget.qml");
  includesAll(overlay, [
    'id: historyStore', 'maxBytes: 16777216',
    'id: csvStore',
    'id: legacySettingsStore', 'maxBytes: 262144',
    'id: settingsStore',
    'History.normalize(JSON.parse(text))',
    'Settings.readDocument(parsed)',
    'settingsStore.save(JSON.stringify(normalized))',
    'historyStore.save(serialized)',
    'csvStore.save(History.toCsv(document))'
  ]);
  includesAll(bar, ["Components.SecureFile", "History.normalize(JSON.parse(text))", "maxBytes: 16777216"]);
});

test("future current settings fail closed before normalization or persistence", () => {
  const settings = read("src/settings.js");
  const reader = settings.slice(settings.indexOf("function readDocument"), settings.indexOf("function normalize"));
  assert.ok(reader.indexOf("documentStatus(raw)") < reader.indexOf('status === "supported" ? normalize(raw) : null'));
  const qml = read("OmaType.qml");
  const parse = qml.slice(qml.indexOf("function parseSettingsText"), qml.indexOf("function loadSettings"));
  includesAll(parse, ["Settings.readDocument(parsed)"]);
  assert.doesNotMatch(parse, /Settings\.normalize\(parsed\)/);
  const persist = qml.slice(qml.indexOf("function persistSettings"), qml.indexOf("function applySetting(category"));
  assert.ok(persist.indexOf('settingsCurrentStatus === "unsupported"') < persist.indexOf("Settings.normalize(root.userSettings)"));
  assert.ok(persist.indexOf('settingsCurrentStatus === "unsupported"') < persist.indexOf("settingsStore.save"));
  includesAll(qml, [
    'property string settingsCurrentStatus: "pending"',
    'root.settingsCurrentStatus = error ? "unavailable" : !exists ? "absent" : document.status',
    'settings use a newer schema · changes not saved'
  ]);
});

test("async startup coordinates both settings sources and queues history results", () => {
  const qml = read("OmaType.qml");
  includesAll(qml, [
    "property bool settingsCurrentResolved: false",
    "property bool legacySettingsResolved: false",
    "if (root.settingsReady || !root.settingsCurrentResolved || !root.legacySettingsResolved) return",
    "if (!root.settingsReady)",
    "root.pendingOpenPayload = JSON.stringify(payload)",
    "property bool historyReady: false",
    "property var pendingHistoryResults: []",
    "if (!root.historyReady || !root.historyAvailable) return null",
    "root.pendingHistoryResults = root.pendingHistoryResults.concat([summary])",
    "function persistPendingHistoryResults()",
    "root.persistPendingHistoryResults()"
  ]);
  const completed = qml.slice(qml.indexOf("Component.onCompleted:"), qml.indexOf("Timer {", qml.indexOf("Component.onCompleted:")));
  assert.doesNotMatch(completed, /newTest\(\)/);
});

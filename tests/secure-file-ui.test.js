"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

function includesAll(source, values) {
  for (const value of values) assert.ok(source.includes(value), value);
}

test("SecureFile uses fixed argv, isolated Python, revision CAS, framed stdin, and timeouts", () => {
  const qml = read("components/SecureFile.qml");
  includesAll(qml, [
    'property string helperInterpreter: "/usr/bin/python3"',
    '[root.helperInterpreter, "-I", "-S", root.helperPath, operation, root.path, String(root.maxBytes)]',
    'if (operation === "write") result.push(expectedRevision)',
    "clearEnvironment: true",
    '"HOME": Quickshell.env("HOME")',
    '"LANG": "C.UTF-8"',
    'String(byteLength) + "\\n" + text',
    "stdinEnabled: true",
    "onStarted: writeProcess.write(writeProcess.frame)",
    "property int requestGeneration: 0",
    "property var queuedWrite: null",
    'property string revision: "unknown"',
    "property bool readQueued: false",
    "function cancelQueuedWrite()",
    "signal saveConflict(string error)",
    "stdout: StdioCollector { id: readStdout; waitForEnd: true }",
    "stderr: StdioCollector { id: writeStderr; waitForEnd: true }",
    'root.queuedWrite = {text: text, chain: true, expectedRevision: ""}',
    'root.queuedWrite = {text: text, chain: false, expectedRevision: expected}',
    "readProcess.signal(9)",
    "writeProcess.signal(9)"
  ]);
  assert.doesNotMatch(qml, /(?:bash|sh)\s*,\s*"-c"|execDetached|startDetached|SplitParser/);
  // Only fixtures may point the helper at another interpreter.
  for (const name of ["OmaType.qml", "BarWidget.qml"]) assert.doesNotMatch(read(name), /helperInterpreter/, name);
});

test("persistence failures are visible in the overlay footer and bar tooltip", () => {
  const overlay = read("OmaType.qml");
  includesAll(overlay, [
    'property string persistenceStatus: ""',
    "readonly property string footerStatus",
    "function shortError(error)",
    'if (error) root.persistenceStatus = "settings unavailable · " + root.shortError(error)',
    'root.persistenceStatus = "history unavailable · " + root.shortError(error)',
    'root.settingsStatus = "settings were not saved · " + root.shortError(error)'
  ]);
  const footer = overlay.slice(overlay.indexOf("text: root.footerStatus"), overlay.indexOf("}", overlay.indexOf("text: root.footerStatus")));
  includesAll(footer, ["textFormat: Text.PlainText"]);
  includesAll(read("BarWidget.qml"), ['property string historyError: ""', 'root.historyError = error ? String(error) : ""', "OmaType • history unavailable"]);
});

test("SecureFile reports a helper that cannot start instead of waiting forever", () => {
  const qml = read("components/SecureFile.qml");
  includesAll(qml, [
    "property int startGraceMs",
    "property int handledGeneration: 0",
    "function readStartFailed()",
    "function writeStartFailed()",
    'root.loadFailed("secure helper could not start")',
    'root.saveFailed("secure helper could not start")',
    "if (!readProcess.running) readGrace.restart()",
    "if (!writeProcess.running) writeGrace.restart()",
    "onRunningChanged:"
  ]);
  for (const process of ["readProcess", "writeProcess"]) {
    const block = qml.slice(qml.indexOf(`id: ${process}`), qml.indexOf("Qt.callLater(root.continueQueue)", qml.indexOf(`id: ${process}`)));
    includesAll(block, [`${process}.handledGeneration = ${process}.generation`, "onExited: function(exitCode)"]);
    assert.ok(block.indexOf(`${process}.handledGeneration = ${process}.generation`) > block.indexOf("onExited"));
  }
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
    'id: csvStore', 'compareAndSwap: false',
    'id: legacySettingsStore', 'maxBytes: 262144',
    'id: settingsStore',
    'History.normalize(JSON.parse(text))',
    'Settings.readDocument(parsed)',
    'settingsStore.save(JSON.stringify(normalized))',
    'historyStore.save(serialized)',
    'csvStore.save(History.toCsv(document))'
  ]);
  includesAll(bar, ["Components.SecureFile", "History.cleanEntry(entries[0]", "maxBytes: 16777216"]);
  // The widget shows one number; it must not normalize the whole document.
  assert.doesNotMatch(bar, /History\.normalize|historyAdapter/);
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
    'settings use a newer schema · changes not saved',
    'if (root.settingsCurrentStatus === "unsupported") settingsStore.cancelQueuedWrite()',
    'onSaveConflict: function(error)'
  ]);
});

test("IPC and history seed text sinks force literal plain text", () => {
  const overlay = read("OmaType.qml");
  const progress = read("components/progress/ProgressView.qml");
  const footer = overlay.slice(overlay.indexOf('text: "seed  " + root.seed'), overlay.indexOf("}", overlay.indexOf('text: "seed  " + root.seed')));
  const selected = progress.slice(progress.indexOf("text: root.selectedEntry ?"), progress.indexOf("ProgressChart {", progress.indexOf("text: root.selectedEntry ?")));
  includesAll(footer, ["textFormat: Text.PlainText"]);
  includesAll(selected, ["root.selectedEntry.seed", "textFormat: Text.PlainText"]);
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

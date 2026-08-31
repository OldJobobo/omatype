"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
function includesAll(source, values) { for (const value of values) assert.ok(source.includes(value), value); }

test("overlay migrates legacy tests and serializes rollback-safe history writes", () => {
  const qml = read("OmaType.qml");
  includesAll(qml, [
    'id: historyAdapter', 'property int schemaVersion: 1', 'property var entries: []', 'property var tests: []',
    'tests: historyAdapter.tests', 'function historyAdapterSnapshot()',
    'property var historyWriteSnapshot: null', 'property var historyQueuedWrite: null',
    'property var historyPendingEffects: []', 'property var historyConflictEffects: []',
    'function persistHistory(document, operation, resultTimestamp, targetId, resultEntry)',
    'function applyHistoryEffects(document, effects)', 'entry: kind === "result" ? History.cleanEntry(resultEntry, History.SCHEMA_VERSION) : null',
    'request.effects = root.historyQueuedWrite.effects.concat(request.effects)',
    'root.historyQueuedWrite = request', 'function drainQueuedHistoryWrite()',
    'if (!saved && snapshot) root.applyHistoryAdapter(snapshot, false)',
    'root.historyWritePending = false',
    'var recoveryEffects = (conflict || queuedEffects.length) ? effects.concat(queuedEffects) : []',
    'root.historyConflictEffects = recoveryEffects',
    'root.historyReloadAfterFailure = true',
    'root.finishHistoryRead(text, exists, "")',
    'onLoadFailed: function(error) { root.finishHistoryRead("", false, error) }',
    'onSaved: root.completeHistoryWrite(true, "", false)',
    'onSaveFailed: function(error) { root.completeHistoryWrite(false, error, false) }',
    'onSaveConflict: function(error) { root.completeHistoryWrite(false, error, true) }',
    'historyAdapter.tests = clearLegacyTests ? [] : (document.tests || [])',
    'historyStore.save(serialized)'
  ]);
  const complete = qml.slice(qml.indexOf("function completeHistoryWrite"), qml.indexOf("function finishHistoryFailureReload"));
  assert.ok(complete.indexOf("root.applyHistoryAdapter(snapshot, false)") < complete.indexOf("root.historyWritePending = false"));
  assert.ok(complete.indexOf("root.historyWritePending = false") < complete.indexOf("root.historyReloadAfterFailure = true"));
  assert.ok(complete.indexOf("root.historyReloadAfterFailure = true") < complete.indexOf("historyStore.reload()"));
  assert.doesNotMatch(qml, /wait for the current history save to finish/);
});

test("history reload journals new operations and clears effects only after a successful rebase", () => {
  const qml = read("OmaType.qml");
  includesAll(qml, [
    'function markCurrentHistoryResultFailed(effects)',
    'effect.kind === "result" && root.result && root.result.timestamp === effect.resultTimestamp',
    'function queueHistoryReloadEffects(request)',
    'var combined = root.historyConflictEffects.concat(request.effects || [])',
    'if (combined.length > History.MAX_EFFECTS)',
    'if (root.historyReloadAfterFailure) return root.queueHistoryReloadEffects(request)',
    'var effects = root.historyConflictEffects.slice()',
    'history reload failed · local changes remain pending',
    'history rebase failed · local changes remain pending',
    'root.historyConflictEffects = []',
    'root.historyReloadAfterFailure = false',
    'root.persistHistory(null, "result", summary.timestamp, "", summary)'
  ]);
  const persist = qml.slice(qml.indexOf("function persistHistory"), qml.indexOf("function drainQueuedHistoryWrite"));
  assert.ok(persist.indexOf("historyReloadAfterFailure") < persist.indexOf("!document || document.schemaVersion"));
  const rebase = qml.slice(qml.indexOf("function finishHistoryFailureReload"), qml.indexOf("function finishHistoryRead"));
  assert.ok(rebase.indexOf("applyHistoryEffects") < rebase.indexOf("root.historyConflictEffects = []"));
  assert.ok(rebase.indexOf("root.historyConflictEffects = []") < rebase.indexOf("root.startHistoryWrite"));
  assert.doesNotMatch(rebase, /if \(root\.result\) \{\s*root\.resultSaved = false/);
  assert.ok((qml.match(/length > History\.MAX_EFFECTS/g) || []).length >= 4);
});

test("saved-state messaging follows successful clear and current-result deletion", () => {
  const qml = read("OmaType.qml");
  includesAll(qml, [
    'summary.id = History.deterministicId(summary)',
    'targetId: targetId || ""', 'root.persistHistory(removed.history, "delete", "", id)',
    'effect.kind === "delete" && root.result && root.result.id === effect.targetId', 'root.resultSaveStatus = "deleted"',
    'root.resultSaveStatus = "cleared"', 'root.resultSaved = false',
    'deleted from local history', 'history cleared · result no longer saved'
  ]);
});

test("result save copy waits for FileView saved and timed boundaries override quick end", () => {
  const qml = read("OmaType.qml");
  includesAll(qml, [
    'property string resultSaveStatus: "idle"', 'resultSaveStatus = "saving"',
    'root.resultSaveStatus = "saved"', 'root.resultSaveStatus = "failed"',
    'text: root.resultSaveStatus === "saving" ? "saving locally…"',
    'summary.completion = InputPolicy.completionFor(summary.mode, summary.amount, elapsed, completionReason)',
    'summary.elapsedMs = elapsed', 'summary.samples = samples.slice(0, History.MAX_SAMPLES)',
    'root.finishTest("quick-ended")'
  ]);
  const finish = qml.slice(qml.indexOf("function finishTest"), qml.indexOf("Component.onCompleted"));
  assert.ok(finish.indexOf('resultSaveStatus = "saving"') < finish.indexOf('persistHistory('));
  assert.doesNotMatch(finish, /resultSaved\s*=\s*currentHistory\s*\?/);
});

test("CSV and settings secure persistence surface asynchronous failure without eager success", () => {
  const qml = read("OmaType.qml");
  includesAll(qml, [
    'property bool csvWritePending: false', 'root.csvStatus = "exporting CSV…"',
    'csvStore.save(History.toCsv(document))', 'id: csvStore', 'onSaved: {',
    'root.csvStatus = "saved ~/.local/state/omarchy/omatype-history.csv"',
    'root.csvStatus = "CSV export failed"', 'OmaType CSV export failed:',
    'property bool settingsWritePending: false', 'root.settingsStatus = "settings were not saved"',
    'OmaType settings save failed:'
  ]);
  const exportFn = qml.slice(qml.indexOf("function exportHistoryCsv"), qml.indexOf("function finishTest"));
  assert.doesNotMatch(exportFn, /saved ~\/\.local\/state/);
  assert.match(qml, /id: csvStore[\s\S]*onSaved:[\s\S]*saved ~\/\.local\/state\/omarchy\/omatype-history\.csv/);
  assert.match(qml, /id: settingsStore[\s\S]*onSaveFailed: function\(error\)/);
});

test("progress refreshes local day, clamps selection, and resets confirmations on every open", () => {
  const qml = read("OmaType.qml");
  const view = read("components/progress/ProgressView.qml");
  includesAll(view, [
    'property string today: root.localToday()', 'function localToday()', 'root.today = root.localToday()',
    'function clampSelection()', 'root.resetConfirmations()', 'onVisibleChanged:',
    'onLedgerEntriesChanged: root.clampSelection()'
  ]);
  includesAll(qml, ['function openProgressPanel()', 'progressPanel.resetConfirmations()', 'root.progressOpen = true']);
  assert.doesNotMatch(view, /Progress\.todayLocal/);
  assert.doesNotMatch(view, /readonly property string today/);
});

test("all-time filters omit both day bounds and mixed scope suppresses comparison", () => {
  const view = read("components/progress/ProgressView.qml");
  includesAll(view, [
    'return Progress.periodBounds(root.period, root.today)',
    'if (bounds.fromDay) filters.fromDay = bounds.fromDay',
    'if (bounds.toDay) filters.toDay = bounds.toDay',
    'comparisonFilters: root.scope === "current" ? root.buildCurrentCohortFilters() : null',
    'chartSeries: root.comparisonSummary.daily',
    'visible: root.scope === "current"',
    'Mixed activity is shown for volume only. Comparative pace, accuracy, and personal bests require one exact setup.'
  ]);
  assert.doesNotMatch(view, /filters\.toDay = root\.today/);
});

test("keyboard regions reveal exact filter labels, skip hidden filters, and page contextually", () => {
  const view = read("components/progress/ProgressView.qml");
  includesAll(view, [
    'function visibleRegions()', 'root.scope === "current" ? [0, 1, 5, 6, 7, 8]',
    'id: scopeLabel; objectName: "scope-filter"', 'id: periodLabel; objectName: "period-filter"',
    'id: languageLabel; objectName: "language-filter"', 'id: modeLabel; objectName: "mode-filter"',
    'id: amountLabel; objectName: "amount-filter"',
    'if (region === 0) return scopeLabel', 'if (region === 1) return periodLabel',
    'if (region === 2) return languageLabel', 'if (region === 3) return modeLabel',
    'if (region === 4) return amountLabel',
    'function revealFocusedRegion()', 'item.mapToItem(scroller.contentItem, 0, 0)',
    'onFocusedRegionChanged: Qt.callLater', 'function scrollPage(delta)',
    'if (root.focusedRegion === 5) root.moveSelection(-10); else root.scrollPage(-1)',
    'if (root.focusedRegion === 5) root.moveSelection(10); else root.scrollPage(1)',
    'Accessible.focused: root.focusedRegion >= 0 && root.focusedRegion <= 4',
    'Accessible.selected: root.selectedIndex === index',
    'border.width: root.selectedIndex === index ? (root.focusedRegion === 5 ? 2 : 1) : 0'
  ]);
});

test("responsive pointer UI includes back, empty return, delete, confirmations, and wrapping", () => {
  const view = read("components/progress/ProgressView.qml");
  const button = read("components/progress/ProgressButton.qml");
  includesAll(view, [
    'Flow {', 'label: "back to typing"', 'label: "return to typing"',
    'label: root.deleteConfirmId ? "confirm delete" : "delete selected"',
    'Requires confirmation before deleting the selected retained result',
    'function closeFromPointer()', 'onActivated: root.closeFromPointer()',
    'root.resetConfirmations(); root.period = modelData',
    'id: statusText', 'Accessible.role: Accessible.StaticText', 'wrapMode: Text.WordWrap'
  ]);
  includesAll(button, ['implicitHeight: 40', 'Accessible.focused: activeFocus']);
  assert.doesNotMatch(view, /\n\s*Row \{\n/);
});

test("history-derived language, mode, and amount filters preserve current default", () => {
  const view = read("components/progress/ProgressView.qml");
  const progress = read("src/progress.js");
  includesAll(view, [
    'property string scope: "current"', 'property string languageFilter: "current"',
    'property string modeFilter: "current"', 'property var amountFilter: "current"',
    'Progress.filterOptions(root.history)', 'root.availableFilters.languages',
    'root.availableFilters.modes', 'root.availableFilters.amounts',
    'else if (root.languageFilter !== "all") filters.language = root.languageFilter',
    'filters.amount = Number(parts[1])'
  ]);
  includesAll(progress, ['function filterOptions(history)', 'modes:', 'languages:', 'amounts:', 'cohorts:']);
});

test("activity answer precedes the retained inspector and heatmap preserves non-date filters", () => {
  const view = read("components/progress/ProgressView.qml");
  includesAll(view, [
    'heatmapFilters: root.buildActivityFilters(false)',
    'Progress.activityHeatmap(root.history, root.heatmapFilters, root.today, 90)',
    'var filters = includePeriod === false ? ({}) : root.addPeriodFilters(({}))',
    'text: "activity totals"', 'id: ledgerGrid'
  ]);
  assert.ok(view.indexOf('id: heatmap') < view.indexOf('id: ledgerGrid'));
  assert.ok(view.indexOf('text: "activity totals"') < view.indexOf('id: ledgerGrid'));
});

test("language comparison is current-scope only and hidden with zero layout height", () => {
  const view = read("components/progress/ProgressView.qml");
  includesAll(view, [
    'id: languagePanel', 'visible: root.scope === "current"',
    'height: visible ? Math.max(76, languageColumn.height + 30) : 0',
    'text: "same-setup language comparison"'
  ]);
});

test("heatmap exposes date bounds, exact hover counts, and accessible day labels", () => {
  const heatmap = read("components/progress/ActivityHeatmap.qml");
  includesAll(heatmap, [
    'readonly property string startDay:', 'readonly property string endDay:',
    'root.startDay + " → " + root.endDay', 'id: dateLine',
    'Accessible.name: "Activity date range: " + text', 'property string hoveredDay: ""',
    'hoverEnabled: true', 'cursorShape: Qt.PointingHandCursor',
    'root.hoveredDay = String(parent.modelData.day)',
    'root.hoveredTests + (root.hoveredTests === 1 ? " test" : " tests")',
    'Accessible.name: modelData.day + ": " + Number(modelData.tests || 0)',
    'Accessible.description: "Each activity cell announces its exact day and test count"'
  ]);
});

test("chart rejects null pace, spaces chronology honestly, and exposes a compact legend", () => {
  const chart = read("components/progress/ProgressChart.qml");
  includesAll(chart, [
    'point.wpm !== null && point.wpm !== undefined', 'function finiteValue(point, key)',
    'Date.parse(points[axisIndex].day + "T00:00:00.000Z")',
    'ctx.arc(pointX(markerIndex)', 'ctx.fillText(String(maximum)',
    'ctx.fillText(firstLabel', 'ctx.fillText(lastLabel',
    'if (allRaw && !root.highContrast)', 'ctx.setLineDash(dashed ? [7, 5] : [])',
    'id: legend', 'width: Math.min(parent.width, 190)',
    'Solid line: net words per minute. Dashed line: raw words per minute.',
    'text: "net"', 'text: "raw"'
  ]);
  assert.doesNotMatch(chart, /Number\(points\[pointIndex\]\[key\]\) \|\| 0/);
});

test("bar history display supports v1 and v2 and fails closed for future schemas", () => {
  const bar = read("BarWidget.qml");
  includesAll(bar, [
    'historyAdapter.schemaVersion === 1 || historyAdapter.schemaVersion === 2',
    'historyAdapter.schemaVersion === 1 && historyAdapter.entries.length === 0',
    '? historyAdapter.tests : historyAdapter.entries',
    'root.supportedHistorySchema && root.visibleHistoryEntries.length > 0',
    'property var tests: []'
  ]);
});

test("visible narrow runtime harness covers exact filter reveal, reopen, null chart, and legacy migration", () => {
  const harness = read("tests/fixtures/ProgressRuntime.qml");
  includesAll(harness, [
    'ProgressUi.ProgressView', 'visible: true', 'progress.visible = false', 'progress.visible = true',
    'progress.deleteConfirmId !== ""', 'nullChart.validSeries.length !== 0',
    'progress.comparisonSummary.latest !== null', 'legacyHistoryAdapter.tests',
    'expectedFilterTargets = ["scope-filter", "period-filter", "language-filter", "mode-filter", "amount-filter"]',
    'progress.revealFocusedRegion()', 'target.objectName !== expectedFilterTargets[region]',
    'History.normalize({schemaVersion: legacyHistoryAdapter.schemaVersion',
    'migrated.entries.length !== 1', 'HARNESS_OK:'
  ]);
});

import QtQuick
import Quickshell
import Quickshell.Io
import "src/history.js" as History
import "components/progress" as ProgressUi

ShellRoot {
    FileView {
        path: Quickshell.env("PWD") + "/tests/fixtures/history-v1-tests.json"
        blockLoading: true
        adapter: JsonAdapter {
            id: legacyHistoryAdapter
            property int schemaVersion: 1
            property var entries: []
            property var tests: []
            property var rollups: []
            property var archive: []
        }
    }
    FloatingWindow {
        visible: true
        implicitWidth: 420
        implicitHeight: 700
        color: "#1f1f1f"

        ProgressUi.ProgressView {
            id: progress
            anchors.fill: parent
            visible: true
            history: ({
                schemaVersion: 2,
                entries: [
                    {id: "a", timestamp: "2026-01-01T12:00:00.000Z", localDay: "2026-01-01", timezoneOffsetMinutes: 0, mode: "time", amount: 30, language: "english", punctuation: false, numbers: false, completion: "completed", metricsVersion: 1, elapsedMs: 30000, wpm: 50, rawWpm: 54, accuracy: 98, consistency: 90, characters: 100, correct: 98, errors: 2, corrected: 2, uncorrectedErrors: 0, corrections: 2, seed: "a", samples: [45, 50]},
                    {id: "b", timestamp: "2026-01-02T12:00:00.000Z", localDay: "2026-01-02", timezoneOffsetMinutes: 0, mode: "words", amount: 25, language: "rust", punctuation: false, numbers: false, completion: "completed", metricsVersion: 1, elapsedMs: 30000, wpm: 90, rawWpm: 94, accuracy: 97, consistency: 88, characters: 100, correct: 97, errors: 3, corrected: 3, uncorrectedErrors: 0, corrections: 3, seed: "b", samples: [85, 90]}
                ],
                rollups: [],
                archive: []
            })
        }

        ProgressUi.ProgressChart {
            id: nullChart
            visible: false
            series: [{day: "2026-01-01", wpm: null, rawWpm: 80}, {day: "2026-01-02", wpm: undefined, rawWpm: 90}]
        }

        ProgressUi.ProgressChart {
            id: legendChart
            x: 10; y: 10; width: 180; height: 120; z: 20
            title: "legend runtime check"
            series: [{day: "2026-01-01", wpm: 40, rawWpm: 44}, {day: "2026-01-04", wpm: 50, rawWpm: 55}]
        }
    }

    Timer {
        interval: 250
        running: true
        onTriggered: {
            progress.deleteConfirmId = "armed"
            progress.clearConfirm = true
            progress.visible = false
            progress.visible = true
            var migrated = History.normalize({schemaVersion: legacyHistoryAdapter.schemaVersion, entries: legacyHistoryAdapter.entries, tests: legacyHistoryAdapter.tests, rollups: legacyHistoryAdapter.rollups, archive: legacyHistoryAdapter.archive})
            var expectedFilterTargets = ["scope-filter", "period-filter", "language-filter", "mode-filter", "amount-filter"]
            var filterTargetsOk = true
            for (var region = 0; region < expectedFilterTargets.length; ++region) {
                progress.focusedRegion = region
                progress.revealFocusedRegion()
                var target = progress.regionItem(region)
                if (!target || target.objectName !== expectedFilterTargets[region]) filterTargetsOk = false
            }
            var failed = progress.deleteConfirmId !== "" || progress.clearConfirm || nullChart.validSeries.length !== 0
                || progress.comparisonSummary.latest !== null || progress.chartSeries.length !== 0
                || legendChart.validSeries.length !== 2 || !migrated || migrated.entries.length !== 1 || migrated.entries[0].wpm !== 44
                || !filterTargetsOk
            if (failed) console.error("HARNESS_FAILURE: progress reopen, mixed-scope, filter reveal, or legacy adapter migration contract · delete=" + progress.deleteConfirmId + " clear=" + progress.clearConfirm + " null=" + nullChart.validSeries.length + " latest=" + progress.comparisonSummary.latest + " chart=" + progress.chartSeries.length + " filters=" + filterTargetsOk + " adapterTests=" + legacyHistoryAdapter.tests.length + " migrated=" + (migrated ? migrated.entries.length : -1) + " wpm=" + (migrated && migrated.entries.length ? migrated.entries[0].wpm : -1))
            else console.log("HARNESS_OK: narrow visible progress, exact filter reveal, reopen reset, null chart, and legacy adapter migration contract")
            Qt.quit()
        }
    }

    Component.onCompleted: progress.setScope("all")
}

import QtQuick
import Quickshell
import qs.Commons
import qs.Ui
import "src/history.js" as History
import "components" as Components

Item {
    id: root

    property var bar: null
    property bool historyReady: false
    property bool historyAvailable: false
    readonly property bool supportedHistorySchema: root.historyAvailable && (historyAdapter.schemaVersion === 1 || historyAdapter.schemaVersion === 2)
    readonly property var visibleHistoryEntries: historyAdapter.schemaVersion === 1 && historyAdapter.entries.length === 0
        ? historyAdapter.tests : historyAdapter.entries
    readonly property real lastWpm: root.supportedHistorySchema && root.visibleHistoryEntries.length > 0
        ? Number(root.visibleHistoryEntries[0].wpm || 0) : 0

    implicitWidth: button.implicitWidth
    implicitHeight: button.implicitHeight

    function finishHistoryRead(text, exists, error) {
        var document = null
        if (!error && !exists) document = History.clear()
        else if (!error) {
            try { document = History.normalize(JSON.parse(text)) }
            catch (parseError) { document = null }
        }
        root.historyReady = true
        root.historyAvailable = !!document
        if (!document) return
        historyAdapter.schemaVersion = document.schemaVersion
        historyAdapter.entries = document.entries || []
        historyAdapter.tests = document.tests || []
        historyAdapter.rollups = document.rollups || []
        historyAdapter.archive = document.archive || []
    }

    Components.SecureFile {
        id: historyStore
        path: Quickshell.env("HOME") + "/.local/state/omarchy/omatype-history.json"
        maxBytes: 16777216
        watchChanges: true
        onLoaded: function(text, exists) { root.finishHistoryRead(text, exists, "") }
        onLoadFailed: function(error) { root.finishHistoryRead("", false, error) }
    }

    QtObject {
        id: historyAdapter
        property int schemaVersion: 1
        property var entries: []
        property var tests: []
        property var rollups: []
        property var archive: []
    }

    BarIconButton {
        id: button
        anchors.fill: parent
        bar: root.bar
        text: "󰌌"
        fontFamily: "JetBrainsMono Nerd Font"
        tooltipText: !root.historyReady ? "OmaType • loading history…" : root.lastWpm > 0 ? "OmaType • " + Math.round(root.lastWpm) + " wpm" : "OmaType"
        slotSize: Style.bar.iconSlot
        onPressed: function(mouseButton) {
            if (mouseButton === Qt.LeftButton && root.bar)
                root.bar.run("omarchy-shell shell toggle jobo.omatype '{}'")
        }
    }
}

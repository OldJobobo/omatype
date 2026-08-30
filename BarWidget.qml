import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui

Item {
    id: root

    property var bar: null
    readonly property bool supportedHistorySchema: historyAdapter.schemaVersion === 1 || historyAdapter.schemaVersion === 2
    readonly property var visibleHistoryEntries: historyAdapter.schemaVersion === 1 && historyAdapter.entries.length === 0
        ? historyAdapter.tests : historyAdapter.entries
    readonly property real lastWpm: root.supportedHistorySchema && root.visibleHistoryEntries.length > 0
        ? Number(root.visibleHistoryEntries[0].wpm || 0) : 0

    implicitWidth: button.implicitWidth
    implicitHeight: button.implicitHeight

    FileView {
        id: historyStore
        path: Quickshell.env("HOME") + "/.local/state/omarchy/omatype-history.json"
        atomicWrites: true
        blockLoading: true
        watchChanges: true
        onFileChanged: reload()
        adapter: JsonAdapter {
            id: historyAdapter
            property int schemaVersion: 1
            property var entries: []
            property var tests: []
            property var rollups: []
            property var archive: []
        }
    }

    BarIconButton {
        id: button
        anchors.fill: parent
        bar: root.bar
        text: "󰌌"
        fontFamily: "JetBrainsMono Nerd Font"
        tooltipText: root.lastWpm > 0 ? "OmaType • " + Math.round(root.lastWpm) + " wpm" : "OmaType"
        slotSize: Style.bar.iconSlot
        onPressed: function(mouseButton) {
            if (mouseButton === Qt.LeftButton && root.bar)
                root.bar.run("omarchy-shell shell toggle jobo.omatype '{}'")
        }
    }
}

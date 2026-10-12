import QtQuick
import Quickshell
import qs.Commons
import qs.Ui
import "src/history.js" as History
import "components" as Components

Item {
    id: root

    property var bar: null
    // Injected by the bar host per the widget contract; the literal is only a
    // fallback. Cloned plugins toggle their own id instead of the original.
    property string moduleName: "jobo.omatype"
    readonly property string pluginId: /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(root.moduleName) ? root.moduleName : "jobo.omatype"
    property bool historyReady: false
    property bool historyAvailable: false
    property string historyError: ""
    property real lastWpm: 0

    implicitWidth: button.implicitWidth
    implicitHeight: button.implicitHeight

    function launchPayload() {
        var window = button.QsWindow.window
        var screenName = window && window.screen ? String(window.screen.name || "") : ""
        if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(screenName)) return "{}"
        return "{\"screen\":\"" + screenName + "\"}"
    }

    // Prefer the bar's shell facade, which toggles in-process without a login
    // shell. Fall back to the omarchy-shell CLI on hosts without the facade.
    function toggleOverlay() {
        var payload = root.launchPayload()
        var api = root.bar ? root.bar.shell : null
        if (api && typeof api.toggle === "function" && api.toggle(root.pluginId, payload) === true) return
        if (root.bar) root.bar.run("omarchy-shell shell toggle " + root.pluginId + " '" + payload + "'")
    }

    // The overlay always publishes a normalized document with the newest run
    // first, so the widget only cleans that one entry instead of normalizing
    // up to 2,000 runs plus rollups on every bar instance and every change.
    function finishHistoryRead(text, exists, error) {
        var available = false
        var latest = null
        if (!error && !exists) available = true
        else if (!error) {
            try {
                var document = JSON.parse(text)
                var schema = document && typeof document === "object" && !Array.isArray(document) ? document.schemaVersion : null
                if (schema === undefined || schema === 1 || schema === History.SCHEMA_VERSION) {
                    available = true
                    var entries = Array.isArray(document.entries) && document.entries.length > 0 ? document.entries
                        : Array.isArray(document.tests) ? document.tests : []
                    latest = entries.length > 0 ? History.cleanEntry(entries[0], schema === History.SCHEMA_VERSION ? schema : 1) : null
                }
            } catch (parseError) {
                available = false
            }
        }
        root.historyReady = true
        root.historyAvailable = available
        root.historyError = error ? String(error) : ""
        root.lastWpm = latest ? Number(latest.wpm || 0) : 0
    }

    Components.SecureFile {
        id: historyStore
        path: Quickshell.env("HOME") + "/.local/state/omarchy/omatype-history.json"
        maxBytes: 16777216
        watchChanges: true
        onLoaded: function(text, exists) { root.finishHistoryRead(text, exists, "") }
        onLoadFailed: function(error) { root.finishHistoryRead("", false, error) }
    }

    BarIconButton {
        id: button
        anchors.fill: parent
        bar: root.bar
        text: "󰌌"
        fontFamily: "JetBrainsMono Nerd Font"
        tooltipText: !root.historyReady ? "OmaType • loading history…" : root.historyError !== "" ? "OmaType • history unavailable" : root.lastWpm > 0 ? "OmaType • " + Math.round(root.lastWpm) + " wpm" : "OmaType"
        slotSize: Style.bar.iconSlot
        onPressed: function(mouseButton) {
            if (mouseButton === Qt.LeftButton) root.toggleOverlay()
        }
    }
}

import QtQuick
import Quickshell
import "components" as Components

ShellRoot {
    id: root
    property int phase: 0
    property int savesCompleted: 0
    property int externalSavesCompleted: 0
    property string firstPayload: "{\"schemaVersion\":1,\"label\":\"first café\"}"
    property string latestPayload: "{\"schemaVersion\":1,\"label\":\"latest λ\"}"
    property string externalPayload: "{\"schemaVersion\":1,\"label\":\"external watcher\"}"

    Components.SecureFile {
        id: store
        path: Quickshell.env("HOME") + "/.config/omarchy/omatype-settings.json"
        maxBytes: 262144
        watchChanges: true
        onLoaded: function(text, exists) {
            if (root.phase === 0) {
                if (exists) {
                    console.error("SECURE_HARNESS_FAILURE: expected missing initial file")
                    Qt.quit()
                    return
                }
                root.phase = 1
                if (!store.save(root.firstPayload) || !store.save(root.latestPayload)) {
                    console.error("SECURE_HARNESS_FAILURE: queued writes did not start")
                    Qt.quit()
                }
            } else if (root.phase === 1) {
                if (!exists || text !== root.latestPayload || root.savesCompleted !== 2) {
                    console.error("SECURE_HARNESS_FAILURE: stale queue result · saves=" + root.savesCompleted + " text=" + text)
                    Qt.quit()
                    return
                }
                root.phase = 2
                externalDelay.restart()
            } else if (root.phase === 3 && exists && text === root.externalPayload) {
                console.log("SECURE_HARNESS_OK: latest queued write wins and watcher reloads external replacement")
                Qt.quit()
            }
        }
        onLoadFailed: function(error) {
            console.error("SECURE_HARNESS_FAILURE: load " + error)
            Qt.quit()
        }
        onSaved: root.savesCompleted++
        onSaveFailed: function(error) {
            console.error("SECURE_HARNESS_FAILURE: save " + error)
            Qt.quit()
        }
    }

    Components.SecureFile {
        id: externalStore
        path: Quickshell.env("HOME") + "/.config/omarchy/omatype-settings.json"
        maxBytes: 262144
        preload: false
        onSaved: root.externalSavesCompleted++
        onSaveFailed: function(error) {
            console.error("SECURE_HARNESS_FAILURE: external save " + error)
            Qt.quit()
        }
    }

    Timer {
        id: externalDelay
        interval: 250
        repeat: false
        onTriggered: {
            root.phase = 3
            if (!externalStore.save(root.externalPayload)) {
                console.error("SECURE_HARNESS_FAILURE: external write did not start")
                Qt.quit()
            }
        }
    }

    Timer {
        interval: 12000
        running: true
        onTriggered: {
            console.error("SECURE_HARNESS_FAILURE: timeout at phase " + root.phase + " saves=" + root.savesCompleted + " external=" + root.externalSavesCompleted)
            Qt.quit()
        }
    }
}

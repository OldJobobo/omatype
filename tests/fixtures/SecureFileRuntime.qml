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
    property string futurePayload: "{\n  \"schemaVersion\": 99,\n  \"future\": true\n}"
    property string stalePayload: "{\"schemaVersion\":1,\"label\":\"must not overwrite\"}"

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
                root.phase = 4
                if (!externalStore.save(root.futurePayload)) {
                    console.error("SECURE_HARNESS_FAILURE: future write did not start")
                    Qt.quit()
                }
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
        onSaveConflict: function(error) {
            console.error("SECURE_HARNESS_FAILURE: unexpected primary conflict " + error)
            Qt.quit()
        }
    }

    Components.SecureFile {
        id: externalStore
        path: Quickshell.env("HOME") + "/.config/omarchy/omatype-settings.json"
        maxBytes: 262144
        compareAndSwap: false
        preload: false
        onSaved: {
            root.externalSavesCompleted++
            if (root.phase === 4) {
                root.phase = 5
                if (!futureStore.reload() || !futureStore.save(root.stalePayload)) {
                    console.error("SECURE_HARNESS_FAILURE: future read/write queue did not start")
                    Qt.quit()
                }
            }
        }
        onSaveFailed: function(error) {
            console.error("SECURE_HARNESS_FAILURE: external save " + error)
            Qt.quit()
        }
        onSaveConflict: function(error) {
            console.error("SECURE_HARNESS_FAILURE: external conflict " + error)
            Qt.quit()
        }
    }

    Components.SecureFile {
        id: futureStore
        path: Quickshell.env("HOME") + "/.config/omarchy/omatype-settings.json"
        maxBytes: 262144
        preload: false
        onLoaded: function(text, exists) {
            if (root.phase === 5) {
                var document = exists ? JSON.parse(text) : null
                if (!document || document.schemaVersion !== 99 || !futureStore.cancelQueuedWrite()) {
                    console.error("SECURE_HARNESS_FAILURE: future schema did not cancel stale queued write")
                    Qt.quit()
                    return
                }
                root.phase = 6
                futureStore.reload()
            } else if (root.phase === 6) {
                if (!exists || text !== root.futurePayload) {
                    console.error("SECURE_HARNESS_FAILURE: future settings were overwritten · text=" + text)
                } else {
                    console.log("SECURE_HARNESS_OK: CAS queue, watcher reload, exact newlines, and future-schema cancellation")
                }
                Qt.quit()
            }
        }
        onLoadFailed: function(error) {
            console.error("SECURE_HARNESS_FAILURE: future load " + error)
            Qt.quit()
        }
        onSaved: {
            console.error("SECURE_HARNESS_FAILURE: cancelled future-schema write was saved")
            Qt.quit()
        }
        onSaveFailed: function(error) {
            console.error("SECURE_HARNESS_FAILURE: future save " + error)
            Qt.quit()
        }
        onSaveConflict: function(error) {
            console.error("SECURE_HARNESS_FAILURE: future conflict should have been cancelled " + error)
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

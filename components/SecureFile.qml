import QtQuick
import Quickshell
import Quickshell.Io

Item {
    id: root

    property string path: ""
    property int maxBytes: 0
    property bool preload: true
    property bool watchChanges: false
    property bool compareAndSwap: true
    property int timeoutMs: 7000
    property bool ready: false
    property bool exists: false
    property string revision: "unknown"
    property bool readPending: readProcess.running
    property bool writePending: writeProcess.running || root.queuedWrite !== null
    property int requestGeneration: 0
    property bool readQueued: false
    property bool watcherArmed: true
    property var queuedWrite: null
    readonly property string helperPath: decodeURIComponent(String(Qt.resolvedUrl("../scripts/secure_file.py")).replace(/^file:\/\//, ""))
    readonly property var processEnvironment: ({"HOME": Quickshell.env("HOME"), "LANG": "C.UTF-8"})

    signal loaded(string text, bool exists)
    signal loadFailed(string error)
    signal saved()
    signal saveFailed(string error)
    signal saveConflict(string error)

    width: 0
    height: 0
    visible: false

    function command(operation, expectedRevision) {
        var result = ["/usr/bin/python3", "-I", "-S", root.helperPath, operation, root.path, String(root.maxBytes)]
        if (operation === "write") result.push(expectedRevision)
        return result
    }

    function utf8Length(text) {
        return unescape(encodeURIComponent(text)).length
    }

    function controlRevision(text) {
        var match = String(text || "").match(/(?:^|\n)revision:(absent|[0-9a-f]{64})(?:\n|$)/)
        return match ? match[1] : ""
    }

    function controlError(text) {
        return String(text || "").split("\n").filter(function(line) {
            return line && !/^revision:(?:absent|[0-9a-f]{64})$/.test(line)
        }).join(" · ").trim()
    }

    function reload() {
        if (!root.path || root.maxBytes <= 0) return false
        if (writeProcess.running) {
            root.readQueued = true
            return true
        }
        if (readProcess.running) {
            root.readQueued = true
            return true
        }
        root.readQueued = false
        root.requestGeneration++
        readProcess.generation = root.requestGeneration
        readProcess.timedOut = false
        readProcess.command = root.command("read", "")
        readProcess.running = true
        readTimeout.restart()
        return true
    }

    function save(text) {
        if (!root.path || root.maxBytes <= 0 || typeof text !== "string") return false
        var expected = root.compareAndSwap ? root.revision : "any"
        if (writeProcess.running) {
            root.queuedWrite = {text: text, chain: true, expectedRevision: ""}
            return true
        }
        if (readProcess.running) {
            root.queuedWrite = {text: text, chain: false, expectedRevision: expected}
            return true
        }
        return root.startWrite({text: text, chain: false, expectedRevision: expected})
    }

    function cancelQueuedWrite() {
        var cancelled = root.queuedWrite !== null
        root.queuedWrite = null
        return cancelled
    }

    function startWrite(request) {
        var text = request.text
        var expected = request.chain ? root.revision : request.expectedRevision
        if (root.compareAndSwap && expected !== "absent" && !/^[0-9a-f]{64}$/.test(expected)) {
            root.saveFailed("secure write has no current revision")
            return false
        }
        var byteLength = 0
        try { byteLength = root.utf8Length(text) }
        catch (error) {
            root.saveFailed("content is not valid Unicode")
            return false
        }
        if (byteLength > root.maxBytes) {
            root.saveFailed("content exceeds byte cap")
            return false
        }
        root.requestGeneration++
        writeProcess.generation = root.requestGeneration
        writeProcess.payload = text
        writeProcess.frame = String(byteLength) + "\n" + text
        writeProcess.expectedRevision = root.compareAndSwap ? expected : "any"
        writeProcess.timedOut = false
        writeProcess.command = root.command("write", writeProcess.expectedRevision)
        writeProcess.running = true
        writeTimeout.restart()
        return true
    }

    function continueQueue() {
        if (readProcess.running || writeProcess.running) return
        if (root.queuedWrite !== null) {
            var next = root.queuedWrite
            root.queuedWrite = null
            root.startWrite(next)
        } else if (root.readQueued) {
            root.reload()
        }
    }

    function rearmWatcher() {
        if (!root.watchChanges) return
        root.watcherArmed = false
        Qt.callLater(function() { root.watcherArmed = true })
    }

    Component.onCompleted: if (root.preload) root.reload()

    FileView {
        id: watcher
        path: root.path
        preload: false
        blockAllReads: true
        blockLoading: false
        printErrors: false
        watchChanges: root.watchChanges && root.watcherArmed
        onFileChanged: {
            root.readQueued = true
            root.rearmWatcher()
            watchDebounce.restart()
        }
    }

    Timer {
        id: watchDebounce
        interval: 80
        repeat: false
        onTriggered: root.reload()
    }

    Timer {
        id: readTimeout
        interval: root.timeoutMs
        repeat: false
        onTriggered: {
            readProcess.timedOut = true
            readProcess.signal(9)
        }
    }

    Timer {
        id: writeTimeout
        interval: root.timeoutMs
        repeat: false
        onTriggered: {
            writeProcess.timedOut = true
            writeProcess.signal(9)
        }
    }

    Process {
        id: readProcess
        property int generation: 0
        property bool timedOut: false
        clearEnvironment: true
        environment: root.processEnvironment
        stdout: StdioCollector { id: readStdout; waitForEnd: true }
        stderr: StdioCollector { id: readStderr; waitForEnd: true }
        onExited: function(exitCode) {
            readTimeout.stop()
            if (readProcess.generation !== root.requestGeneration) return
            root.ready = true
            var nextRevision = root.controlRevision(readStderr.text)
            if (readProcess.timedOut) {
                root.revision = "unknown"
                root.loadFailed("secure read timed out")
            } else if (exitCode === 0 && nextRevision) {
                root.revision = nextRevision
                root.exists = true
                root.loaded(readStdout.text, true)
            } else if (exitCode === 3 && nextRevision === "absent") {
                root.revision = "absent"
                root.exists = false
                root.loaded("", false)
            } else {
                root.revision = "unknown"
                root.loadFailed(root.controlError(readStderr.text) || "secure read failed")
            }
            Qt.callLater(root.continueQueue)
        }
    }

    Process {
        id: writeProcess
        property int generation: 0
        property string payload: ""
        property string frame: ""
        property string expectedRevision: ""
        property bool timedOut: false
        clearEnvironment: true
        environment: root.processEnvironment
        stdinEnabled: true
        stderr: StdioCollector { id: writeStderr; waitForEnd: true }
        onStarted: writeProcess.write(writeProcess.frame)
        onExited: function(exitCode) {
            writeTimeout.stop()
            writeProcess.payload = ""
            writeProcess.frame = ""
            if (writeProcess.generation !== root.requestGeneration) return
            var nextRevision = root.controlRevision(writeStderr.text)
            if (writeProcess.timedOut) root.saveFailed("secure write timed out")
            else if (exitCode === 0 && nextRevision) {
                root.revision = nextRevision
                root.exists = true
                if (root.watchChanges) {
                    root.readQueued = true
                    root.rearmWatcher()
                }
                root.saved()
            } else if (exitCode === 8) {
                root.queuedWrite = null
                root.readQueued = true
                root.revision = "unknown"
                root.saveConflict(root.controlError(writeStderr.text) || "destination revision conflict")
            } else root.saveFailed(root.controlError(writeStderr.text) || "secure write failed")
            Qt.callLater(root.continueQueue)
        }
    }
}

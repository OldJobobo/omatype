import QtQuick
import Quickshell
import Quickshell.Io

Item {
    id: root

    property string path: ""
    property int maxBytes: 0
    property bool preload: true
    property bool watchChanges: false
    property int timeoutMs: 7000
    property bool ready: false
    property bool exists: false
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

    width: 0
    height: 0
    visible: false

    function command(operation) {
        return ["/usr/bin/python3", "-I", "-S", root.helperPath, operation, root.path, String(root.maxBytes)]
    }

    function utf8Length(text) {
        return unescape(encodeURIComponent(text)).length
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
        readProcess.output = ""
        readProcess.errorOutput = ""
        readProcess.timedOut = false
        readProcess.command = root.command("read")
        readProcess.running = true
        readTimeout.restart()
        return true
    }

    function save(text) {
        if (!root.path || root.maxBytes <= 0 || typeof text !== "string") return false
        if (readProcess.running || writeProcess.running) {
            root.queuedWrite = text
            return true
        }
        return root.startWrite(text)
    }

    function startWrite(text) {
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
        writeProcess.errorOutput = ""
        writeProcess.timedOut = false
        writeProcess.command = root.command("write")
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
        property string output: ""
        property string errorOutput: ""
        property bool timedOut: false
        clearEnvironment: true
        environment: root.processEnvironment
        stdout: SplitParser { onRead: function(data) { readProcess.output += data } }
        stderr: SplitParser { onRead: function(data) { readProcess.errorOutput += data } }
        onExited: function(exitCode) {
            readTimeout.stop()
            if (readProcess.generation !== root.requestGeneration) return
            root.ready = true
            if (readProcess.timedOut) {
                root.loadFailed("secure read timed out")
            } else if (exitCode === 0) {
                root.exists = true
                root.loaded(readProcess.output, true)
            } else if (exitCode === 3) {
                root.exists = false
                root.loaded("", false)
            } else {
                root.loadFailed(readProcess.errorOutput.trim() || "secure read failed")
            }
            Qt.callLater(root.continueQueue)
        }
    }

    Process {
        id: writeProcess
        property int generation: 0
        property string payload: ""
        property string frame: ""
        property string errorOutput: ""
        property bool timedOut: false
        clearEnvironment: true
        environment: root.processEnvironment
        stdinEnabled: true
        stderr: SplitParser { onRead: function(data) { writeProcess.errorOutput += data } }
        onStarted: writeProcess.write(writeProcess.frame)
        onExited: function(exitCode) {
            writeTimeout.stop()
            writeProcess.payload = ""
            writeProcess.frame = ""
            if (writeProcess.generation !== root.requestGeneration) return
            if (writeProcess.timedOut) root.saveFailed("secure write timed out")
            else if (exitCode === 0) {
                if (root.watchChanges) {
                    root.readQueued = true
                    root.rearmWatcher()
                }
                root.saved()
            } else root.saveFailed(writeProcess.errorOutput.trim() || "secure write failed")
            Qt.callLater(root.continueQueue)
        }
    }
}

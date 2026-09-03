import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Wayland
import qs.Commons
import "src/generator.js" as Generator
import "src/typing-state.js" as TypingState
import "src/metrics.js" as Metrics
import "src/history.js" as History
import "src/settings.js" as Settings
import "src/input-policy.js" as InputPolicy
import "src/ipc-policy.js" as IpcPolicy
import "src/layout.js" as Layout
import "src/languages.js" as Languages
import "src/words.js" as WordList
import "components" as Components
import "components/settings" as SettingsUi
import "components/progress" as ProgressUi

Item {
    id: root

    property var shell: null
    property var manifest: null
    property bool opened: false
    property string mode: "time"
    property int amount: 30
    property string language: "english"
    property string activeLanguage: "english"
    property bool languagePanelOpen: false
    property bool punctuation: false
    property bool numbers: false
    property string seed: "omatype-" + Date.now()
    property var typing: null
    property var generated: null
    property var samples: []
    property var result: null
    property bool resultSaved: false
    property string resultSaveStatus: "idle"
    property bool historyWritePending: false
    property string historyPendingOperation: ""
    property string historyPendingResultTimestamp: ""
    property string historyPendingTargetId: ""
    property var historyPendingEffects: []
    property var historyWriteSnapshot: null
    property var historyQueuedWrite: null
    property var historyConflictEffects: []
    property bool historyReloadAfterFailure: false
    property bool historyReady: false
    property bool historyAvailable: false
    property var pendingHistoryResults: []
    property bool csvWritePending: false
    property bool settingsWritePending: false
    property string settingsStatus: ""
    property bool settingsReady: false
    property bool settingsCurrentResolved: false
    property bool settingsCurrentExists: false
    property string settingsCurrentStatus: "pending"
    property var settingsCurrentValue: null
    property bool legacySettingsResolved: false
    property bool legacySettingsExists: false
    property var legacySettingsValue: null
    property string pendingOpenPayload: ""
    // Epoch milliseconds exceed a QML int. Keeping this as double prevents
    // elapsed time from collapsing to one millisecond on real sessions.
    property double nowMs: Date.now()
    property bool settingsOpen: false
    property bool progressOpen: false
    property string csvStatus: ""
    property real activeWordY: 0
    property int generationBatch: 0
    property int sampledKeystrokes: 0
    property double lastSampleMs: 0
    property var userSettings: Settings.defaults()
    property var activeSettings: Settings.defaults()
    readonly property var runtimeSettings: root.activeSettings
    readonly property string activeMode: root.activeSettings.test.mode
    readonly property int activeAmount: root.activeSettings.test.mode === "time" ? root.activeSettings.test.time : root.activeSettings.test.words
    property var wordLayout: []

    readonly property var timeOptions: [15, 30, 60, 120]
    readonly property var wordOptions: [10, 25, 50, 100]
    readonly property var settingsSections: ["test", "behavior", "display", "caret", "access"]
    readonly property var settingsCategories: ["test", "behavior", "appearance", "caret", "accessibility", "progress"]
    readonly property var languageOptions: Languages.options()
    readonly property var currentLanguagePack: Languages.get(root.language)
    readonly property var activeLanguagePack: Languages.get(root.activeLanguage)
    readonly property bool programmingLanguage: activeLanguagePack.category === "programming"
    readonly property color backgroundColor: Color.background
    readonly property color accentColor: Color.accent
    readonly property color textColor: Color.foreground
    readonly property color mutedColor: root.runtimeSettings.accessibility.highContrast ? root.textColor : Color.muted
    readonly property color errorColor: Color.urgent
    readonly property color controlColor: Style.normalFill
    readonly property string typeface: Style.font.family
    readonly property bool focusMode: typing && typing.startedAt !== null && !result
    readonly property int elapsedMs: typing && typing.startedAt !== null ? nowMs - typing.startedAt : 0
    readonly property int remainingSeconds: Math.max(0, activeAmount - Math.floor(elapsedMs / 1000))
    readonly property var liveMetrics: Metrics.summarize({
        elapsedMs: root.elapsedMs,
        correct: root.typing ? root.typing.totalKeystrokes - root.typing.errorKeystrokes : 0,
        total: root.typing ? root.typing.totalKeystrokes : 0,
        samples: root.samples
    })
    readonly property int activeWordIndex: wordIndexAt(typing ? typing.cursor : 0)
    readonly property real characterWidth: root.runtimeSettings.appearance.fontSize * 0.6016
    readonly property int caretSmoothDuration: {
        if (root.runtimeSettings.accessibility.reducedMotion) return 0
        var smooth = root.runtimeSettings.caret.smooth
        if (smooth === "slow") return 180
        if (smooth === "medium") return 100
        if (smooth === "fast") return 55
        return 0
    }
    readonly property color caretColor: {
        var choice = root.runtimeSettings.caret.color
        if (choice === "foreground") return root.textColor
        if (choice === "error") return root.errorColor
        if (choice === "custom") return root.runtimeSettings.caret.customColor
        return root.accentColor
    }

    onActiveWordIndexChanged: Qt.callLater(function() {
        var item = wordRepeater.itemAt(activeWordIndex)
        if (item) activeWordY = item.y
    })

    function isPrintable(text) {
        if (typeof text !== "string" || Array.from(text).length !== 1) return false
        var codePoint = text.codePointAt(0)
        return codePoint >= 0x20 && codePoint !== 0x7f
    }

    function settingsAdapterValue(adapter) {
        return Settings.normalize({
            schemaVersion: adapter.schemaVersion,
            test: adapter.test,
            behavior: adapter.behavior,
            caret: adapter.caret,
            appearance: adapter.appearance,
            accessibility: adapter.accessibility,
            progress: adapter.progress
        })
    }

    function applySettingsAdapter(adapter, value) {
        adapter.schemaVersion = value.schemaVersion
        adapter.test = value.test || ({})
        adapter.behavior = value.behavior || ({})
        adapter.caret = value.caret || ({})
        adapter.appearance = value.appearance || ({})
        adapter.accessibility = value.accessibility || ({})
        adapter.progress = value.progress || ({})
    }

    function parseSettingsText(text) {
        try {
            var parsed = JSON.parse(text)
            return Settings.readDocument(parsed)
        } catch (error) {
            return {status: "malformed", value: null}
        }
    }

    function loadSettings(syncSetup) {
        root.userSettings = root.settingsAdapterValue(settingsAdapter)
        if (syncSetup === true) root.syncStoredTestSettings()
    }

    function finishSettingsRead(current, text, exists, error) {
        var document = !error && exists ? root.parseSettingsText(text) : null
        var value = document ? document.value : null
        if (current) {
            root.settingsCurrentResolved = true
            root.settingsCurrentExists = exists || !!error
            root.settingsCurrentStatus = error ? "unavailable" : !exists ? "absent" : document.status
            root.settingsCurrentValue = value
            if (root.settingsCurrentStatus === "unsupported") settingsStore.cancelQueuedWrite()
            if (value) root.applySettingsAdapter(settingsAdapter, value)
            if (root.settingsReady && value) root.loadSettings(true)
        } else {
            root.legacySettingsResolved = true
            root.legacySettingsExists = exists || !!error
            root.legacySettingsValue = value
            if (value) root.applySettingsAdapter(legacySettingsAdapter, value)
        }
        root.finalizeSettingsStartup()
    }

    function finalizeSettingsStartup() {
        if (root.settingsReady || !root.settingsCurrentResolved || !root.legacySettingsResolved) return
        var migrate = false
        if (root.settingsCurrentValue) root.userSettings = Settings.normalize(root.settingsCurrentValue)
        else if (!root.settingsCurrentExists && root.legacySettingsValue) {
            root.userSettings = Settings.normalize(root.legacySettingsValue)
            migrate = true
        } else root.userSettings = Settings.defaults()
        root.settingsReady = true
        root.syncStoredTestSettings()
        if (!root.typing) root.newTest()
        if (migrate) root.persistSettings()
        if (root.pendingOpenPayload !== "") {
            var payload = root.pendingOpenPayload
            root.pendingOpenPayload = ""
            Qt.callLater(function() { root.open(payload) })
        }
    }

    function syncStoredTestSettings() {
        root.mode = root.userSettings.test.mode
        root.amount = root.mode === "time" ? root.userSettings.test.time : root.userSettings.test.words
        root.language = root.userSettings.test.language
        root.punctuation = root.userSettings.test.punctuation
        root.numbers = root.userSettings.test.numbers
    }

    function persistSettings() {
        if (!root.settingsReady) return false
        if (root.settingsCurrentStatus === "unsupported") {
            root.settingsWritePending = false
            root.settingsStatus = "settings use a newer schema · changes not saved"
            return false
        }
        var normalized = Settings.normalize(root.userSettings)
        root.applySettingsAdapter(settingsAdapter, normalized)
        root.settingsWritePending = true
        root.settingsStatus = ""
        try {
            if (settingsStore.save(JSON.stringify(normalized))) return true
        } catch (error) {
            console.warn("OmaType settings save failed: " + error)
        }
        root.settingsWritePending = false
        root.settingsStatus = "settings were not saved"
        return false
    }

    function applySetting(category, key, value) {
        if (!Settings.isValidUpdate(root.userSettings, category, key, value)) return false
        var activeRun = root.focusMode
        root.userSettings = Settings.update(root.userSettings, category, key, value)
        persistSettings()
        if (category === "test") root.syncStoredTestSettings()
        if ((category === "test" || category === "behavior") && root.opened && !activeRun) root.newTest()
        if (category === "appearance" && !activeRun) Qt.callLater(function() { root.rebuildWordLayout(wordsClip.width) })
        return true
    }

    function applyProgressGoal(metric, target) {
        if (!Settings.isValidUpdate(root.userSettings, "progress", "goalMetric", metric)
                || !Settings.isValidUpdate(root.userSettings, "progress", "goalTarget", target)) return false
        var next = Settings.update(root.userSettings, "progress", "goalMetric", metric)
        root.userSettings = Settings.update(next, "progress", "goalTarget", target)
        root.persistSettings()
        return true
    }

    function resetCaretSettings() {
        root.resetSettingsCategory("caret")
    }

    function resetSettingsCategory(category) {
        var activeRun = root.focusMode
        root.userSettings = Settings.resetCategory(root.userSettings, category)
        persistSettings()
        if (category === "test") root.syncStoredTestSettings()
        if ((category === "test" || category === "behavior") && root.opened && !activeRun) root.newTest()
        if (category === "appearance" && !activeRun) Qt.callLater(function() { root.rebuildWordLayout(wordsClip.width) })
    }

    function applyAutomationTransaction(payload, validSettingPayload, validResetPayload) {
        if (!validSettingPayload && !validResetPayload) return
        var nextSettings = root.userSettings
        if (validSettingPayload) nextSettings = Settings.update(nextSettings, payload.setting.category, payload.setting.key, payload.setting.value)
        if (validResetPayload) nextSettings = Settings.resetCategory(nextSettings, payload.resetCategory)
        root.userSettings = nextSettings
        root.persistSettings()
        var testTouched = (validSettingPayload && payload.setting.category === "test")
            || (validResetPayload && payload.resetCategory === "test")
        var appearanceTouched = (validSettingPayload && payload.setting.category === "appearance")
            || (validResetPayload && payload.resetCategory === "appearance")
        if (testTouched) root.syncStoredTestSettings()
        if (appearanceTouched && !root.focusMode) Qt.callLater(function() { root.rebuildWordLayout(wordsClip.width) })
    }

    function activeWordSource() {
        return root.activeLanguage === "english" ? WordList.words : root.activeLanguagePack.words
    }

    function openSettingsPanel(section) {
        root.languagePanelOpen = false
        root.progressOpen = false
        root.settingsOpen = true
        var index = root.settingsSections.indexOf(section)
        if (index < 0) index = root.settingsSections.indexOf(settingsPanel.currentSection)
        if (index < 0) index = 0
        Qt.callLater(function() {
            settingsPanel.openSection(index)
            settingsPanel.focusFirstRow()
        })
    }

    function closeSettingsPanel() {
        root.settingsOpen = false
        Qt.callLater(function() { keyboardRoot.forceActiveFocus() })
    }

    function openLanguagePanel() {
        root.settingsOpen = false
        root.progressOpen = false
        root.languagePanelOpen = true
        var current = -1
        for (var i = 0; i < root.languageOptions.length; ++i) {
            if (root.languageOptions[i].id === root.language) { current = i; break }
        }
        languageGrid.currentIndex = current >= 0 ? current : 0
        Qt.callLater(function() { languageGrid.forceActiveFocus() })
    }

    function closeLanguagePanel() {
        root.languagePanelOpen = false
        Qt.callLater(function() { keyboardRoot.forceActiveFocus() })
    }

    function canOpenProgress() {
        return root.historyReady && root.historyAvailable
            && (!root.typing || root.typing.startedAt === null || !!root.result)
    }

    function openProgressPanel() {
        if (!root.canOpenProgress()) return false
        root.settingsOpen = false
        root.languagePanelOpen = false
        progressPanel.resetConfirmations()
        root.progressOpen = true
        root.csvStatus = ""
        progressPanel.statusMessage = root.historyDocument() ? "" : "history schema is newer than this OmaType build"
        Qt.callLater(function() { keyboardRoot.forceActiveFocus() })
        return true
    }

    function closeProgressPanel() {
        root.progressOpen = false
        Qt.callLater(function() { keyboardRoot.forceActiveFocus() })
    }

    function toggleProgressPanel() {
        if (root.progressOpen) root.closeProgressPanel()
        else root.openProgressPanel()
    }

    function chooseLanguage(languageId) {
        if (!Languages.has(languageId)) return
        var activeRun = root.focusMode
        root.language = languageId
        root.userSettings = Settings.update(root.userSettings, "test", "language", languageId)
        root.persistSettings()
        root.closeLanguagePanel()
        if (!activeRun) root.restart()
        else Qt.callLater(function() { keyboardRoot.forceActiveFocus() })
    }

    function rebuildWordLayout(viewportWidth) {
        root.wordLayout = Layout.centeredWords(
            root.generated && root.generated.words ? root.generated.words : [],
            Math.max(1, viewportWidth),
            root.characterWidth,
            root.runtimeSettings.appearance.wordSpacing,
            root.runtimeSettings.appearance.lineHeight
        )
    }

    function open(payloadJson) {
        var payload = IpcPolicy.parsePayload(payloadJson)
        if (payload === null) return
        if (!root.settingsReady) {
            root.pendingOpenPayload = JSON.stringify(payload)
            return
        }
        var activeRunBeforeAutomation = root.opened && root.focusMode
        var validSettingPayload = payload.setting && typeof payload.setting === "object" && !Array.isArray(payload.setting)
            && settingsCategories.indexOf(payload.setting.category) >= 0
            && typeof payload.setting.key === "string" && payload.setting.key.length <= 64
            && Settings.isValidUpdate(root.userSettings, payload.setting.category, payload.setting.key, payload.setting.value)
        if (Object.prototype.hasOwnProperty.call(payload, "setting") && !validSettingPayload) return
        var validResetPayload = settingsCategories.indexOf(payload.resetCategory) >= 0
        if (Object.prototype.hasOwnProperty.call(payload, "resetCategory") && !validResetPayload) return
        if (!root.opened) root.loadSettings(true)
        root.applyAutomationTransaction(payload, validSettingPayload, validResetPayload)
        if ((validSettingPayload || validResetPayload) && activeRunBeforeAutomation) {
            if (payload.settings === true) {
                progressOpen = false
                languagePanelOpen = false
                settingsOpen = true
                var activeSection = settingsSections.indexOf(payload.settingsSection) >= 0 ? payload.settingsSection : "test"
                Qt.callLater(function() { settingsPanel.currentSection = activeSection })
            }
            Qt.callLater(function() { keyboardRoot.forceActiveFocus() })
            return
        }
        var requestedMode = payload.mode === "time" || payload.mode === "words" ? payload.mode : mode
        if (requestedMode !== mode) amount = requestedMode === "time" ? 30 : 25
        mode = requestedMode
        var requestedAmount = Number(payload.amount)
        var allowedAmounts = mode === "time" ? timeOptions : wordOptions
        if (Number.isFinite(requestedAmount) && allowedAmounts.indexOf(requestedAmount) >= 0) amount = requestedAmount
        if (Languages.has(payload.language)) language = payload.language
        if (typeof payload.punctuation === "boolean") punctuation = payload.punctuation
        if (typeof payload.numbers === "boolean") numbers = payload.numbers
        var requestedSettingsSection = settingsSections.indexOf(payload.settingsSection) >= 0 ? payload.settingsSection : "test"
        settingsOpen = payload.settings === true
        languagePanelOpen = false
        progressOpen = false
        seed = typeof payload.seed === "string" && payload.seed.length > 0
            ? String(payload.seed).slice(0, 128)
            : "omatype-" + Date.now()
        opened = true
        newTest()
        if (settingsOpen) Qt.callLater(function() { settingsPanel.currentSection = requestedSettingsSection })
        Qt.callLater(function() { keyboardRoot.forceActiveFocus() })
    }

    function close() {
        opened = false
        settingsOpen = false
        languagePanelOpen = false
        progressOpen = false
    }

    function dismiss() {
        if (shell && typeof shell.hide === "function") shell.hide("jobo.omatype")
        else close()
    }

    function newTest() {
        var snapshot = Settings.normalize(root.userSettings)
        snapshot.test.mode = root.mode
        snapshot.test.time = root.mode === "time" ? root.amount : snapshot.test.time
        snapshot.test.words = root.mode === "words" ? root.amount : snapshot.test.words
        snapshot.test.language = root.language
        snapshot.test.punctuation = root.punctuation
        snapshot.test.numbers = root.numbers
        root.activeSettings = Settings.normalize(snapshot)
        var count = root.activeSettings.test.mode === "words" ? root.activeSettings.test.words : 320
        activeLanguage = root.activeSettings.test.language
        generationBatch = 0
        generated = Generator.generate({
            mode: root.activeSettings.test.mode,
            amount: count,
            seed: seed,
            words: root.activeWordSource(),
            punctuation: root.activeSettings.test.punctuation && !root.programmingLanguage,
            numbers: root.activeSettings.test.numbers && !root.programmingLanguage
        })
        typing = TypingState.create(generated.text)
        samples = []
        sampledKeystrokes = 0
        lastSampleMs = 0
        result = null
        resultSaved = false
        resultSaveStatus = "idle"
        nowMs = Date.now()
        activeWordY = 0
        Qt.callLater(function() {
            root.rebuildWordLayout(wordsClip.width)
            keyboardRoot.forceActiveFocus()
            var item = wordRepeater.itemAt(0)
            if (item) activeWordY = item.y
        })
    }

    function appendTimeWords() {
        if (root.activeSettings.test.mode !== "time" || !generated || !typing) return
        generationBatch++
        var batch = Generator.generate({
            mode: root.activeSettings.test.mode,
            amount: 160,
            seed: seed + "-batch-" + generationBatch,
            words: root.activeWordSource(),
            punctuation: root.activeSettings.test.punctuation && !root.programmingLanguage,
            numbers: root.activeSettings.test.numbers && !root.programmingLanguage
        })
        var nextWords = generated.words.concat(batch.words)
        var nextText = nextWords.join(" ")
        generated = {seed: seed, mode: root.activeSettings.test.mode, words: nextWords, text: nextText}
        root.rebuildWordLayout(wordsClip.width)
        typing.target = nextText
        typing.completed = false
        typing.endedAt = null
        typing = Object.assign({}, typing)
    }

    function restart() {
        seed = "omatype-" + Date.now()
        newTest()
    }

    function chooseMode(value) {
        root.applySetting("test", "mode", value)
    }

    function chooseAmount(value) {
        root.applySetting("test", root.mode === "time" ? "time" : "words", value)
    }

    function cycleAmount(delta) {
        var options = root.mode === "time" ? root.timeOptions : root.wordOptions
        var index = options.indexOf(root.amount)
        if (index < 0) index = 0
        var next = (index + delta + options.length) % options.length
        root.chooseAmount(options[next])
    }

    function globalStartForWord(wordIndex) {
        if (!generated || !generated.words) return 0
        var offset = 0
        for (var i = 0; i < wordIndex; ++i) offset += generated.words[i].length + 1
        return offset
    }

    function wordIndexAt(cursor) {
        if (!generated || !generated.words) return 0
        var offset = 0
        for (var i = 0; i < generated.words.length; ++i) {
            var end = offset + generated.words[i].length
            if (cursor <= end) return i
            offset = end + 1
        }
        return Math.max(0, generated.words.length - 1)
    }

    function historyAdapterDocument() {
        return History.normalize({
            schemaVersion: historyAdapter.schemaVersion,
            entries: historyAdapter.entries,
            tests: historyAdapter.tests,
            rollups: historyAdapter.rollups,
            archive: historyAdapter.archive
        })
    }

    function historyDocument() {
        if (!root.historyReady || !root.historyAvailable) return null
        return root.historyQueuedWrite && root.historyQueuedWrite.document
            ? History.normalize(root.historyQueuedWrite.document)
            : root.historyAdapterDocument()
    }

    function historyAdapterSnapshot() {
        return {
            schemaVersion: historyAdapter.schemaVersion,
            entries: historyAdapter.entries,
            tests: historyAdapter.tests,
            rollups: historyAdapter.rollups,
            archive: historyAdapter.archive
        }
    }

    function applyHistoryAdapter(document, clearLegacyTests) {
        historyAdapter.schemaVersion = document.schemaVersion
        historyAdapter.entries = document.entries || []
        historyAdapter.tests = clearLegacyTests ? [] : (document.tests || [])
        historyAdapter.rollups = document.rollups || []
        historyAdapter.archive = document.archive || []
    }

    function markCurrentHistoryResultFailed(effects) {
        for (var effectIndex = 0; effectIndex < effects.length; ++effectIndex) {
            var effect = effects[effectIndex]
            if (effect.kind === "result" && root.result && root.result.timestamp === effect.resultTimestamp) {
                root.resultSaved = false
                root.resultSaveStatus = "failed"
                return
            }
        }
    }

    function markHistoryWriteStarted(request) {
        var effects = request.effects || []
        var currentResultWillBeSaved = false
        for (var effectIndex = 0; effectIndex < effects.length; ++effectIndex) {
            var effect = effects[effectIndex]
            if (effect.kind === "result" && root.result && root.result.timestamp === effect.resultTimestamp)
                currentResultWillBeSaved = true
            else if (effect.kind === "clear" || (effect.kind === "delete" && root.result && root.result.id === effect.targetId))
                currentResultWillBeSaved = false
        }
        if (currentResultWillBeSaved) {
            root.resultSaved = false
            root.resultSaveStatus = "saving"
        }
        if (request.operation === "delete") progressPanel.statusMessage = "deleting retained result…"
        else if (request.operation === "clear") progressPanel.statusMessage = "clearing history…"
    }

    function startHistoryWrite(request) {
        root.historyWriteSnapshot = root.historyAdapterSnapshot()
        root.historyWritePending = true
        root.historyPendingOperation = request.operation
        root.historyPendingResultTimestamp = request.resultTimestamp
        root.historyPendingTargetId = request.targetId
        root.historyPendingEffects = request.effects || []
        root.applyHistoryAdapter(request.document, true)
        root.markHistoryWriteStarted(request)
        try {
            var serialized = JSON.stringify(request.document)
            if (!historyStore.save(serialized)) {
                root.completeHistoryWrite(false, "secure history write did not start")
                return false
            }
            return true
        } catch (error) {
            root.completeHistoryWrite(false, error)
            return false
        }
    }

    function historyEffect(kind, resultTimestamp, targetId, resultEntry) {
        return {
            kind: kind,
            resultTimestamp: resultTimestamp || "",
            targetId: targetId || "",
            entry: kind === "result" ? History.cleanEntry(resultEntry, History.SCHEMA_VERSION) : null
        }
    }

    function applyHistoryEffects(document, effects) {
        return History.applyEffects(document, effects)
    }

    function queueHistoryReloadEffects(request) {
        var combined = root.historyConflictEffects.concat(request.effects || [])
        if (combined.length > History.MAX_EFFECTS) {
            root.markCurrentHistoryResultFailed(request.effects || [])
            progressPanel.statusMessage = "too many history changes are pending · reload OmaType"
            return false
        }
        root.historyConflictEffects = combined
        root.markHistoryWriteStarted(request)
        if (!historyStore.readPending) historyStore.reload()
        return true
    }

    function persistHistory(document, operation, resultTimestamp, targetId, resultEntry) {
        var kind = operation || "history"
        var request = {
            document: document,
            operation: kind,
            resultTimestamp: resultTimestamp || "",
            targetId: targetId || "",
            effects: [root.historyEffect(kind, resultTimestamp, targetId, resultEntry)]
        }
        if (root.historyReloadAfterFailure) return root.queueHistoryReloadEffects(request)
        if (!document || document.schemaVersion !== History.SCHEMA_VERSION) return false
        if (root.historyWritePending) {
            var newEffects = request.effects
            if (root.historyQueuedWrite && root.historyQueuedWrite.effects)
                request.effects = root.historyQueuedWrite.effects.concat(request.effects)
            if (request.effects.length > History.MAX_EFFECTS) {
                root.markCurrentHistoryResultFailed(newEffects)
                progressPanel.statusMessage = "too many history changes are pending · reload OmaType"
                return false
            }
            root.historyQueuedWrite = request
            root.markHistoryWriteStarted(request)
            return true
        }
        return root.startHistoryWrite(request)
    }

    function drainQueuedHistoryWrite() {
        if (root.historyWritePending || root.historyReloadAfterFailure || !root.historyQueuedWrite) return
        var request = root.historyQueuedWrite
        root.historyQueuedWrite = null
        root.startHistoryWrite(request)
    }

    function completeHistoryWrite(saved, error, conflict) {
        var operation = root.historyPendingOperation
        var resultTimestamp = root.historyPendingResultTimestamp
        var effects = root.historyPendingEffects || []
        var snapshot = root.historyWriteSnapshot
        if (!saved && snapshot) root.applyHistoryAdapter(snapshot, false)
        root.historyWritePending = false
        root.historyPendingOperation = ""
        root.historyPendingResultTimestamp = ""
        root.historyPendingTargetId = ""
        root.historyPendingEffects = []
        root.historyWriteSnapshot = null
        if (saved) {
            root.historyReady = true
            root.historyAvailable = true
            if (operation === "delete") progressPanel.statusMessage = "retained result deleted"
            else if (operation === "clear") {
                progressPanel.selectedIndex = 0
                progressPanel.statusMessage = "history cleared"
            }
            for (var effectIndex = 0; effectIndex < effects.length; ++effectIndex) {
                var effect = effects[effectIndex]
                if (effect.kind === "result" && root.result && root.result.timestamp === effect.resultTimestamp) {
                    root.resultSaved = true
                    root.resultSaveStatus = "saved"
                } else if (effect.kind === "delete" && root.result && root.result.id === effect.targetId) {
                    root.resultSaved = false
                    root.resultSaveStatus = "deleted"
                } else if (effect.kind === "clear" && root.result) {
                    root.resultSaved = false
                    root.resultSaveStatus = "cleared"
                }
            }
            root.drainQueuedHistoryWrite()
            return
        }

        var queuedEffects = root.historyQueuedWrite && root.historyQueuedWrite.effects
            ? root.historyQueuedWrite.effects : []
        root.historyQueuedWrite = null
        var recoveryEffects = (conflict || queuedEffects.length) ? effects.concat(queuedEffects) : []
        if (recoveryEffects.length > History.MAX_EFFECTS) {
            root.historyConflictEffects = []
            root.historyReloadAfterFailure = false
            root.markCurrentHistoryResultFailed(recoveryEffects)
            progressPanel.statusMessage = "too many history changes were pending · history was not changed"
            console.warn("OmaType history save failed: " + error)
            return
        }
        root.historyConflictEffects = recoveryEffects
        root.historyReloadAfterFailure = true
        if (!root.historyConflictEffects.length && operation === "result" && root.result && root.result.timestamp === resultTimestamp)
            root.markCurrentHistoryResultFailed(effects)
        progressPanel.statusMessage = conflict ? "history changed externally · rebasing local changes" : (root.historyConflictEffects.length ? "history save failed · retrying queued changes" : operation + " failed · history unchanged on disk")
        console.warn("OmaType history save failed: " + error)
        historyStore.reload()
    }

    function finishHistoryFailureReload(error) {
        if (!root.historyReloadAfterFailure) return
        var effects = root.historyConflictEffects.slice()
        if (error || !root.historyAvailable) {
            if (error) console.warn("OmaType history reload after save failure failed: " + error)
            root.markCurrentHistoryResultFailed(effects)
            progressPanel.statusMessage = "history reload failed · local changes remain pending"
            return
        }
        if (!effects.length) {
            root.historyReloadAfterFailure = false
            return
        }
        var document = root.applyHistoryEffects(root.historyAdapterDocument(), effects)
        if (!document) {
            root.markCurrentHistoryResultFailed(effects)
            progressPanel.statusMessage = "history rebase failed · local changes remain pending"
            return
        }
        root.historyConflictEffects = []
        root.historyReloadAfterFailure = false
        var last = effects[effects.length - 1]
        root.startHistoryWrite({
            document: document,
            operation: last.kind,
            resultTimestamp: last.resultTimestamp || "",
            targetId: last.targetId || "",
            effects: effects
        })
    }

    function finishHistoryRead(text, exists, error) {
        var normalized = null
        if (!error && !exists) normalized = History.clear()
        else if (!error) {
            try { normalized = History.normalize(JSON.parse(text)) }
            catch (parseError) { normalized = null }
        }
        if (normalized) {
            root.applyHistoryAdapter(normalized, true)
            root.historyAvailable = true
        } else root.historyAvailable = false
        root.historyReady = true
        if (root.historyReloadAfterFailure) root.finishHistoryFailureReload(error || (normalized ? "" : "history is invalid"))
        root.persistPendingHistoryResults()
    }

    function persistPendingHistoryResults() {
        if (!root.historyReady || root.pendingHistoryResults.length === 0) return
        var pending = root.pendingHistoryResults
        root.pendingHistoryResults = []
        var document = root.historyDocument()
        if (!document) {
            if (root.result) root.resultSaveStatus = "failed"
            return
        }
        var effects = []
        for (var pendingIndex = 0; pendingIndex < pending.length; ++pendingIndex) {
            document = History.add(document, pending[pendingIndex])
            if (!document) break
            effects.push(root.historyEffect("result", pending[pendingIndex].timestamp, "", pending[pendingIndex]))
        }
        var request = {
            document: document,
            operation: "result",
            resultTimestamp: pending[pending.length - 1].timestamp,
            targetId: "",
            effects: effects
        }
        if (!document || effects.length > History.MAX_EFFECTS) {
            if (root.result) root.resultSaveStatus = "failed"
            progressPanel.statusMessage = "too many unsaved results · history was not changed"
            return
        }
        if (root.historyReloadAfterFailure) root.queueHistoryReloadEffects(request)
        else if (root.historyWritePending) {
            var newEffects = request.effects
            if (root.historyQueuedWrite && root.historyQueuedWrite.effects)
                request.effects = root.historyQueuedWrite.effects.concat(request.effects)
            if (request.effects.length > History.MAX_EFFECTS) {
                root.markCurrentHistoryResultFailed(newEffects)
                progressPanel.statusMessage = "too many unsaved results · history was not changed"
                return
            }
            root.historyQueuedWrite = request
            root.markHistoryWriteStarted(request)
        } else root.startHistoryWrite(request)
    }

    function deleteHistoryEntry(id) {
        var document = root.historyDocument()
        if (!document) {
            progressPanel.statusMessage = "history schema is newer than this OmaType build"
            return
        }
        var removed = History.remove(document, id)
        if (!removed.deleted) {
            progressPanel.statusMessage = removed.reason === "compacted" ? "compacted results cannot be individually deleted" : "result not found"
            return
        }
        root.persistHistory(removed.history, "delete", "", id)
    }

    function clearHistory() {
        if (!root.historyDocument()) {
            progressPanel.statusMessage = "history schema is newer than this OmaType build"
            return
        }
        root.persistHistory(History.clear(), "clear", "", "")
    }

    function exportHistoryCsv() {
        var document = root.historyDocument()
        if (!document) {
            root.csvStatus = "export failed · unsupported history schema"
            progressPanel.statusMessage = root.csvStatus
            return
        }
        if (root.csvWritePending) {
            progressPanel.statusMessage = "CSV export already in progress"
            return
        }
        root.csvWritePending = true
        root.csvStatus = "exporting CSV…"
        progressPanel.statusMessage = root.csvStatus
        if (!csvStore.save(History.toCsv(document))) {
            root.csvWritePending = false
            root.csvStatus = "CSV export failed"
            progressPanel.statusMessage = root.csvStatus
        }
    }

    function finishTest(completionReason) {
        if (result || !typing || typing.startedAt === null) return
        var endedAt = typing.endedAt !== null ? typing.endedAt : Date.now()
        root.nowMs = endedAt
        var elapsed = Math.max(1, endedAt - typing.startedAt)
        if (lastSampleMs <= 0) lastSampleMs = typing.startedAt
        if (typing.totalKeystrokes > sampledKeystrokes && endedAt > lastSampleMs) {
            samples = samples.concat([Metrics.intervalWpm(typing.totalKeystrokes, sampledKeystrokes, endedAt - lastSampleMs)])
            sampledKeystrokes = typing.totalKeystrokes
            lastSampleMs = endedAt
        }
        var summary = Metrics.summarize({
            correct: typing.totalKeystrokes - typing.errorKeystrokes,
            total: typing.totalKeystrokes,
            elapsedMs: elapsed,
            samples: samples
        })
        var finishedAt = new Date(endedAt)
        summary.timestamp = finishedAt.toISOString()
        summary.mode = root.activeSettings.test.mode
        summary.amount = root.activeSettings.test.mode === "time" ? root.activeSettings.test.time : root.activeSettings.test.words
        summary.language = activeLanguage
        summary.punctuation = root.activeSettings.test.punctuation && !root.programmingLanguage
        summary.numbers = root.activeSettings.test.numbers && !root.programmingLanguage
        summary.completion = InputPolicy.completionFor(summary.mode, summary.amount, elapsed, completionReason)
        summary.metricsVersion = 1
        summary.elapsedMs = elapsed
        summary.timezoneOffsetMinutes = finishedAt.getTimezoneOffset()
        summary.localDay = History.localDayAt(summary.timestamp, summary.timezoneOffsetMinutes)
        summary.seed = seed
        summary.samples = samples.slice(0, History.MAX_SAMPLES)
        summary.characters = typing.totalKeystrokes
        summary.errors = typing.errorKeystrokes
        summary.correct = typing.totalKeystrokes - typing.errorKeystrokes
        summary.corrected = typing.correctedErrors
        summary.uncorrectedErrors = typing.errors
        summary.corrections = typing.corrections
        summary.id = History.deterministicId(summary)
        result = summary
        resultSaved = false
        var currentHistory = root.historyDocument()
        if (!root.historyReady) {
            resultSaveStatus = "saving"
            root.pendingHistoryResults = root.pendingHistoryResults.concat([summary])
        } else if (root.historyReloadAfterFailure) {
            resultSaveStatus = "saving"
            if (!root.persistHistory(null, "result", summary.timestamp, "", summary)) resultSaveStatus = "failed"
        } else if (currentHistory) {
            resultSaveStatus = "saving"
            if (!root.persistHistory(History.add(currentHistory, summary), "result", summary.timestamp, "", summary)) resultSaveStatus = "failed"
        } else resultSaveStatus = "unsupported"
        Qt.callLater(function() { resultChart.requestPaint() })
    }

    Component.onCompleted: {
        // SecureFile startup reads coordinate settings before the first test is built.
    }

    Timer {
        interval: 100
        running: root.opened && root.typing && root.typing.startedAt !== null && !root.result
        repeat: true
        onTriggered: {
            root.nowMs = Date.now()
            if (root.activeSettings.test.mode === "time" && root.elapsedMs >= root.activeSettings.test.time * 1000) root.finishTest()
        }
    }

    Timer {
        interval: 1000
        running: root.opened && root.typing && root.typing.startedAt !== null && !root.result
        repeat: true
        onTriggered: {
            var sampledAt = Date.now()
            if (root.lastSampleMs <= 0) root.lastSampleMs = root.typing.startedAt
            var sample = Metrics.intervalWpm(root.typing.totalKeystrokes, root.sampledKeystrokes, sampledAt - root.lastSampleMs)
            root.samples = root.samples.concat([sample])
            root.sampledKeystrokes = root.typing.totalKeystrokes
            root.lastSampleMs = sampledAt
        }
    }

    Components.SecureFile {
        id: historyStore
        path: Quickshell.env("HOME") + "/.local/state/omarchy/omatype-history.json"
        maxBytes: 16777216
        watchChanges: true
        onLoaded: function(text, exists) {
            if (!root.historyWritePending && !root.historyReloadAfterFailure)
                root.finishHistoryRead(text, exists, "")
            else if (root.historyReloadAfterFailure)
                root.finishHistoryRead(text, exists, "")
        }
        onLoadFailed: function(error) { root.finishHistoryRead("", false, error) }
        onSaved: root.completeHistoryWrite(true, "", false)
        onSaveFailed: function(error) { root.completeHistoryWrite(false, error, false) }
        onSaveConflict: function(error) { root.completeHistoryWrite(false, error, true) }
    }

    QtObject {
        id: historyAdapter
        property int schemaVersion: 1
        property var entries: []
        property var tests: []
        property var rollups: []
        property var archive: []
    }

    Components.SecureFile {
        id: csvStore
        path: Quickshell.env("HOME") + "/.local/state/omarchy/omatype-history.csv"
        maxBytes: 16777216
        compareAndSwap: false
        preload: false
        onSaved: {
            root.csvWritePending = false
            root.csvStatus = "saved ~/.local/state/omarchy/omatype-history.csv"
            progressPanel.statusMessage = root.csvStatus
        }
        onSaveFailed: function(error) {
            root.csvWritePending = false
            root.csvStatus = "CSV export failed"
            progressPanel.statusMessage = root.csvStatus
            console.warn("OmaType CSV export failed: " + error)
        }
        onSaveConflict: function(error) {
            root.csvWritePending = false
            root.csvStatus = "CSV export conflict"
            progressPanel.statusMessage = root.csvStatus
            console.warn("OmaType CSV export conflict: " + error)
        }
    }

    Components.SecureFile {
        id: legacySettingsStore
        path: Quickshell.env("HOME") + "/.local/state/omarchy/omatype-settings.json"
        maxBytes: 262144
        onLoaded: function(text, exists) { root.finishSettingsRead(false, text, exists, "") }
        onLoadFailed: function(error) { root.finishSettingsRead(false, "", false, error) }
    }

    QtObject {
        id: legacySettingsAdapter
        property int schemaVersion: 1
        property var test: ({})
        property var behavior: ({})
        property var caret: ({})
        property var appearance: ({})
        property var accessibility: ({})
        property var progress: ({})
    }

    Components.SecureFile {
        id: settingsStore
        path: Quickshell.env("HOME") + "/.config/omarchy/omatype-settings.json"
        maxBytes: 262144
        watchChanges: true
        onWritePendingChanged: if (!writePending) root.settingsWritePending = false
        onLoaded: function(text, exists) { root.finishSettingsRead(true, text, exists, "") }
        onLoadFailed: function(error) { root.finishSettingsRead(true, "", false, error) }
        onSaved: {
            root.settingsWritePending = settingsStore.writePending
            root.settingsStatus = ""
        }
        onSaveFailed: function(error) {
            root.settingsWritePending = settingsStore.writePending
            root.settingsStatus = "settings were not saved"
            console.warn("OmaType settings save failed: " + error)
        }
        onSaveConflict: function(error) {
            settingsStore.cancelQueuedWrite()
            root.settingsWritePending = false
            root.settingsStatus = "settings changed externally · local change not saved"
            console.warn("OmaType settings save conflict: " + error)
        }
    }

    QtObject {
        id: settingsAdapter
        property int schemaVersion: 1
        property var test: ({})
        property var behavior: ({})
        property var caret: ({})
        property var appearance: ({})
        property var accessibility: ({})
        property var progress: ({})
    }

    PanelWindow {
        id: surface

        screen: Quickshell.screens.length > 0 ? Quickshell.screens[0] : null
        visible: root.opened
        color: root.backgroundColor
        exclusionMode: ExclusionMode.Ignore

        WlrLayershell.namespace: "jobo-omatype"
        WlrLayershell.layer: WlrLayer.Overlay
        WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive

        anchors {
            top: true
            bottom: true
            left: true
            right: true
        }

        FocusScope {
            id: keyboardRoot
            anchors.fill: parent
            focus: true

            Keys.priority: Keys.BeforeItem
            Keys.onPressed: function(event) {
                var controlHeld = (event.modifiers & Qt.ControlModifier) !== 0
                if (event.key === Qt.Key_Escape && (event.modifiers & Qt.ControlModifier)) {
                    root.dismiss()
                    event.accepted = true
                    return
                }
                if (event.key === Qt.Key_R && (event.modifiers & Qt.ControlModifier)) {
                    root.settingsOpen = false
                    root.languagePanelOpen = false
                    root.progressOpen = false
                    root.restart()
                    event.accepted = true
                    return
                }
                if (event.key === Qt.Key_H && controlHeld) {
                    if (root.canOpenProgress()) root.toggleProgressPanel()
                    event.accepted = true
                    return
                }
                if (root.progressOpen) {
                    progressPanel.handleKey(event)
                    event.accepted = true
                    return
                }
                if (event.key === Qt.Key_Comma && controlHeld) {
                    if (root.settingsOpen) root.closeSettingsPanel()
                    else root.openSettingsPanel(settingsPanel.currentSection)
                    event.accepted = true
                    return
                }
                if (event.key === Qt.Key_L && controlHeld) {
                    if (root.languagePanelOpen) root.closeLanguagePanel()
                    else root.openLanguagePanel()
                    event.accepted = true
                    return
                }
                if (root.languagePanelOpen) {
                    var nextLanguage = languageGrid.currentIndex < 0 ? 0 : languageGrid.currentIndex
                    if (event.key === Qt.Key_Escape) root.closeLanguagePanel()
                    else if (event.key === Qt.Key_Home) { languageGrid.currentIndex = 0; nextLanguage = 0 }
                    else if (event.key === Qt.Key_End) { languageGrid.currentIndex = root.languageOptions.length - 1; nextLanguage = languageGrid.currentIndex }
                    else if (event.key === Qt.Key_Left) nextLanguage -= 1
                    else if (event.key === Qt.Key_Right) nextLanguage += 1
                    else if (event.key === Qt.Key_Up) nextLanguage -= 6
                    else if (event.key === Qt.Key_Down) nextLanguage += 6
                    else if (event.key === Qt.Key_PageUp) nextLanguage -= 18
                    else if (event.key === Qt.Key_PageDown) nextLanguage += 18
                    else if (event.key === Qt.Key_Tab) nextLanguage += (event.modifiers & Qt.ShiftModifier) ? -1 : 1
                    else if (event.key === Qt.Key_Enter || event.key === Qt.Key_Return || event.key === Qt.Key_Space) {
                        if (languageGrid.currentIndex >= 0 && languageGrid.currentIndex < root.languageOptions.length)
                            root.chooseLanguage(root.languageOptions[languageGrid.currentIndex].id)
                    }
                    languageGrid.currentIndex = Math.max(0, Math.min(root.languageOptions.length - 1, nextLanguage))
                    if (languageGrid.currentIndex >= 0) languageGrid.positionViewAtIndex(languageGrid.currentIndex, GridView.Contain)
                    event.accepted = true
                    return
                }
                if (root.settingsOpen) {
                    if (event.key === Qt.Key_Escape) root.closeSettingsPanel()
                    else if (controlHeld && event.key >= Qt.Key_1 && event.key <= Qt.Key_5) settingsPanel.openSection(event.key - Qt.Key_1)
                    else if (controlHeld && event.key === Qt.Key_Left) settingsPanel.moveSection(-1)
                    else if (controlHeld && event.key === Qt.Key_Right) settingsPanel.moveSection(1)
                    else if (event.key === Qt.Key_Tab) settingsPanel.focusRow(event.modifiers & Qt.ShiftModifier ? -1 : 1)
                    else if (event.key === Qt.Key_Up) settingsPanel.focusRow(-1)
                    else if (event.key === Qt.Key_Down) settingsPanel.focusRow(1)
                    else if (event.key === Qt.Key_Left) settingsPanel.activateFocusedRow(-1)
                    else if (event.key === Qt.Key_Right) settingsPanel.activateFocusedRow(1)
                    else if (event.key === Qt.Key_Home) settingsPanel.focusBoundary(false)
                    else if (event.key === Qt.Key_End) settingsPanel.focusBoundary(true)
                    else if (event.key === Qt.Key_PageUp) settingsPanel.scrollBy(-220)
                    else if (event.key === Qt.Key_PageDown) settingsPanel.scrollBy(220)
                    else if (event.key === Qt.Key_Enter || event.key === Qt.Key_Return || event.key === Qt.Key_Space) settingsPanel.activateFocusedRow(1)
                    else if (event.key === Qt.Key_R) settingsPanel.resetCurrentSection()
                    event.accepted = true
                    return
                }
                if (event.key === Qt.Key_M && controlHeld) {
                    root.chooseMode(root.mode === "time" ? "words" : "time")
                    event.accepted = true
                    return
                }
                if (event.key === Qt.Key_Up && controlHeld) {
                    root.cycleAmount(-1)
                    event.accepted = true
                    return
                }
                if (event.key === Qt.Key_Down && controlHeld) {
                    root.cycleAmount(1)
                    event.accepted = true
                    return
                }
                if (event.key === Qt.Key_P && controlHeld) {
                    root.applySetting("test", "punctuation", !root.punctuation)
                    event.accepted = true
                    return
                }
                if (event.key === Qt.Key_N && controlHeld) {
                    root.applySetting("test", "numbers", !root.numbers)
                    event.accepted = true
                    return
                }
                if (event.key === Qt.Key_Escape) {
                    if (InputPolicy.isQuickRestart(root.activeSettings.behavior.quickRestart, "escape")) root.restart()
                    else root.dismiss()
                    event.accepted = true
                    return
                }
                if (event.key === Qt.Key_Tab) {
                    if (InputPolicy.isQuickRestart(root.activeSettings.behavior.quickRestart, "tab")) root.restart()
                    event.accepted = true
                    return
                }
                if (event.key === Qt.Key_Enter || event.key === Qt.Key_Return) {
                    if (root.result) root.restart()
                    else if (InputPolicy.shouldQuickEnd(root.activeSettings.test.mode, root.activeSettings.behavior.quickEnd, root.typing.startedAt !== null)) root.finishTest("quick-ended")
                    else if (InputPolicy.isQuickRestart(root.activeSettings.behavior.quickRestart, "enter")) root.restart()
                    event.accepted = true
                    return
                }
                if (root.result) {
                    event.accepted = true
                    return
                }
                if (event.key === Qt.Key_Backspace) {
                    var backspaceAction = InputPolicy.decide(root.typing, "Backspace", root.activeSettings.behavior)
                    if (backspaceAction === "backspace") TypingState.backspace(root.typing)
                    root.typing = Object.assign({}, root.typing)
                    event.accepted = true
                    return
                }
                if (root.isPrintable(event.text) && !(event.modifiers & (Qt.ControlModifier | Qt.AltModifier | Qt.MetaModifier))) {
                    if (root.activeSettings.test.mode === "time" && root.typing.target.length - root.typing.cursor < 240) root.appendTimeWords()
                    var inputAction = InputPolicy.decide(root.typing, event.text, root.activeSettings.behavior)
                    if (inputAction === "blocked-error") TypingState.blockError(root.typing, event.text, Date.now())
                    else if (inputAction === "input") TypingState.input(root.typing, event.text, Date.now())
                    root.typing = Object.assign({}, root.typing)
                    root.nowMs = Date.now()
                    event.accepted = true
                    if (root.typing.completed && root.activeSettings.test.mode === "words") root.finishTest()
                }
            }

            Item {
                id: content
                x: Math.round(surface.width * 0.10)
                width: Math.round(surface.width * 0.80)
                height: surface.height

                Item {
                    id: header
                    y: 52
                    width: parent.width
                    height: 48
                    opacity: root.focusMode && root.runtimeSettings.appearance.focusHideHeader ? 0.12 : 1
                    Behavior on opacity { NumberAnimation { duration: root.runtimeSettings.accessibility.reducedMotion ? 0 : 150 } }

                    Text {
                        id: logoIcon
                        anchors.left: parent.left
                        anchors.verticalCenter: parent.verticalCenter
                        text: "󰌌"
                        color: root.accentColor
                        font.family: "JetBrainsMono Nerd Font"
                        font.pixelSize: 31
                    }
                    Text {
                        anchors.left: logoIcon.right
                        anchors.leftMargin: 9
                        anchors.verticalCenter: parent.verticalCenter
                        text: "OmaType"
                        color: root.textColor
                        font.family: root.typeface
                        font.pixelSize: 30
                        font.weight: Font.DemiBold
                    }
                }

                Row {
                    id: setup
                    y: 135
                    anchors.horizontalCenter: parent.horizontalCenter
                    spacing: 12
                    visible: (!root.focusMode || !root.runtimeSettings.appearance.focusHideSetup) && !root.result && !root.settingsOpen && !root.languagePanelOpen && !root.progressOpen

                    Rectangle {
                        width: languageControl.implicitWidth + 28
                        height: 41
                        radius: 8
                        color: root.controlColor
                        Accessible.role: Accessible.Button
                        Accessible.name: "Choose typing language"
                        Accessible.onPressAction: root.openLanguagePanel()
                        Text {
                            id: languageControl
                            anchors.centerIn: parent
                            text: "󰖟  " + root.currentLanguagePack.label
                            color: root.accentColor
                            font.family: "JetBrainsMono Nerd Font"
                            font.pixelSize: 13
                        }
                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: root.openLanguagePanel()
                        }
                    }

                    Rectangle {
                        width: setupLeft.implicitWidth + 28
                        height: 41
                        radius: 8
                        color: root.controlColor
                        Row {
                            id: setupLeft
                            anchors.centerIn: parent
                            spacing: 18
                            Text {
                                text: "@ punctuation"
                                color: root.programmingLanguage ? Qt.rgba(root.mutedColor.r, root.mutedColor.g, root.mutedColor.b, 0.35) : (root.punctuation ? root.accentColor : root.mutedColor)
                                font.family: root.typeface
                                font.pixelSize: 13
                                Accessible.role: Accessible.Button
                                Accessible.name: "Toggle punctuation"
                                Accessible.checked: root.punctuation
                                Accessible.onPressAction: if (!root.programmingLanguage) root.applySetting("test", "punctuation", !root.punctuation)
                                MouseArea { enabled: !root.programmingLanguage; anchors.fill: parent; anchors.margins: -6; cursorShape: Qt.PointingHandCursor; onClicked: root.applySetting("test", "punctuation", !root.punctuation) }
                            }
                            Text {
                                text: "# numbers"
                                color: root.programmingLanguage ? Qt.rgba(root.mutedColor.r, root.mutedColor.g, root.mutedColor.b, 0.35) : (root.numbers ? root.accentColor : root.mutedColor)
                                font.family: root.typeface
                                font.pixelSize: 13
                                Accessible.role: Accessible.Button
                                Accessible.name: "Toggle numbers"
                                Accessible.checked: root.numbers
                                Accessible.onPressAction: if (!root.programmingLanguage) root.applySetting("test", "numbers", !root.numbers)
                                MouseArea { enabled: !root.programmingLanguage; anchors.fill: parent; anchors.margins: -6; cursorShape: Qt.PointingHandCursor; onClicked: root.applySetting("test", "numbers", !root.numbers) }
                            }
                        }
                    }

                    Rectangle {
                        width: setupModes.implicitWidth + 30
                        height: 41
                        radius: 8
                        color: root.controlColor
                        Row {
                            id: setupModes
                            anchors.centerIn: parent
                            spacing: 18
                            Repeater {
                                model: ["time", "words"]
                                delegate: Text {
                                    required property string modelData
                                    text: modelData
                                    color: root.mode === modelData ? root.accentColor : root.mutedColor
                                    font.family: root.typeface
                                    font.pixelSize: 13
                                    Accessible.role: Accessible.RadioButton
                                    Accessible.name: "Use " + modelData + " mode"
                                    Accessible.checked: root.mode === modelData
                                    Accessible.onPressAction: root.chooseMode(modelData)
                                    MouseArea { anchors.fill: parent; anchors.margins: -6; cursorShape: Qt.PointingHandCursor; onClicked: root.chooseMode(parent.modelData) }
                                }
                            }
                        }
                    }

                    Rectangle {
                        width: setupAmounts.implicitWidth + 28
                        height: 41
                        radius: 8
                        color: root.controlColor
                        Row {
                            id: setupAmounts
                            anchors.centerIn: parent
                            spacing: 15
                            Repeater {
                                model: root.mode === "time" ? root.timeOptions : root.wordOptions
                                delegate: Text {
                                    required property int modelData
                                    text: modelData
                                    color: root.amount === modelData ? root.accentColor : root.mutedColor
                                    font.family: root.typeface
                                    font.pixelSize: 13
                                    Accessible.role: Accessible.RadioButton
                                    Accessible.name: "Use test length " + modelData
                                    Accessible.checked: root.amount === modelData
                                    Accessible.onPressAction: root.chooseAmount(modelData)
                                    MouseArea { anchors.fill: parent; anchors.margins: -6; cursorShape: Qt.PointingHandCursor; onClicked: root.chooseAmount(parent.modelData) }
                                }
                            }
                        }
                    }
                }

                Text {
                    y: 188
                    anchors.horizontalCenter: parent.horizontalCenter
                    visible: setup.visible
                    text: "ctrl+m mode   ctrl+↑/↓ length   ctrl+p punctuation   ctrl+n numbers"
                    color: root.mutedColor
                    font.family: root.typeface
                    font.pixelSize: 10
                }

                Rectangle {
                    id: languagePanel
                    z: 11
                    anchors.horizontalCenter: parent.horizontalCenter
                    y: 116
                    width: Math.min(parent.width, 1050)
                    height: Math.min(500, surface.height - 220)
                    visible: root.languagePanelOpen
                    radius: 14
                    color: root.controlColor
                    border.width: 1
                    border.color: Qt.rgba(root.mutedColor.r, root.mutedColor.g, root.mutedColor.b, 0.35)

                    Text {
                        x: 28
                        y: 20
                        text: "typing language"
                        color: root.textColor
                        font.family: root.typeface
                        font.pixelSize: 24
                        font.weight: Font.DemiBold
                    }
                    Text {
                        x: 28
                        y: 52
                        text: "arrows/tab move   home/end jump   page up/down   enter select   esc cancel"
                        color: root.mutedColor
                        font.family: root.typeface
                        font.pixelSize: 12
                    }
                    Text {
                        anchors.right: parent.right
                        anchors.rightMargin: 28
                        y: 27
                        text: "esc  cancel"
                        color: root.mutedColor
                        font.family: root.typeface
                        font.pixelSize: 12
                        Accessible.role: Accessible.Button
                        Accessible.name: "Close language picker"
                        Accessible.onPressAction: root.closeLanguagePanel()
                        MouseArea { anchors.fill: parent; anchors.margins: -8; cursorShape: Qt.PointingHandCursor; onClicked: root.closeLanguagePanel() }
                    }

                    GridView {
                        id: languageGrid
                        x: 24
                        y: 82
                        width: parent.width - 48
                        height: parent.height - 102
                        clip: true
                        cellWidth: Math.floor(width / 6)
                        cellHeight: 48
                        model: root.languageOptions
                        focus: root.languagePanelOpen
                        keyNavigationEnabled: false
                        Keys.priority: Keys.BeforeItem
                        Keys.onPressed: function(event) {
                            if (event.key === Qt.Key_Escape) {
                                if (event.modifiers & Qt.ControlModifier) root.dismiss()
                                else root.closeLanguagePanel()
                                event.accepted = true
                                return
                            }
                            if (event.key === Qt.Key_Enter || event.key === Qt.Key_Return || event.key === Qt.Key_Space) {
                                if (languageGrid.currentIndex >= 0 && languageGrid.currentIndex < root.languageOptions.length)
                                    root.chooseLanguage(root.languageOptions[languageGrid.currentIndex].id)
                                event.accepted = true
                                return
                            }
                            var nextLanguage = languageGrid.currentIndex < 0 ? 0 : languageGrid.currentIndex
                            if (event.key === Qt.Key_Left) nextLanguage -= 1
                            else if (event.key === Qt.Key_Right) nextLanguage += 1
                            else if (event.key === Qt.Key_Up) nextLanguage -= 6
                            else if (event.key === Qt.Key_Down) nextLanguage += 6
                            else if (event.key === Qt.Key_Home) nextLanguage = 0
                            else if (event.key === Qt.Key_End) nextLanguage = root.languageOptions.length - 1
                            else if (event.key === Qt.Key_PageUp) nextLanguage -= 18
                            else if (event.key === Qt.Key_PageDown) nextLanguage += 18
                            else if (event.key === Qt.Key_Tab) {
                                var delta = (event.modifiers & Qt.ShiftModifier) ? -1 : 1
                                var count = root.languageOptions.length
                                nextLanguage = (nextLanguage + delta + count) % count
                            } else {
                                return
                            }
                            languageGrid.currentIndex = Math.max(0, Math.min(root.languageOptions.length - 1, nextLanguage))
                            languageGrid.positionViewAtIndex(languageGrid.currentIndex, GridView.Contain)
                            event.accepted = true
                        }
                        delegate: Rectangle {
                            required property int index
                            required property var modelData
                            width: languageGrid.cellWidth - 8
                            height: 40
                            radius: 7
                            color: root.language === modelData.id
                                ? Qt.rgba(root.accentColor.r, root.accentColor.g, root.accentColor.b, 0.18)
                                : Qt.rgba(root.backgroundColor.r, root.backgroundColor.g, root.backgroundColor.b, 0.32)
                            border.width: root.language === modelData.id || languageGrid.currentIndex === index ? 1 : 0
                            border.color: languageGrid.currentIndex === index ? root.textColor : root.accentColor
                            Accessible.role: Accessible.Button
                            Accessible.name: "Language " + modelData.label
                            Accessible.focused: languageGrid.currentIndex === index
                            Accessible.onPressAction: root.chooseLanguage(modelData.id)
                            Text {
                                anchors.centerIn: parent
                                text: modelData.label
                                color: root.language === modelData.id ? root.accentColor : root.textColor
                                font.family: root.typeface
                                font.pixelSize: 13
                                font.weight: root.language === modelData.id ? Font.DemiBold : Font.Normal
                            }
                            MouseArea {
                                anchors.fill: parent
                                cursorShape: Qt.PointingHandCursor
                                onClicked: root.chooseLanguage(parent.modelData.id)
                            }
                        }
                    }
                }

                SettingsUi.SettingsDrawer {
                    id: settingsPanel
                    z: 10
                    anchors.horizontalCenter: parent.horizontalCenter
                    y: 90
                    width: Math.min(parent.width, 1040)
                    height: Math.min(660, surface.height - 140)
                    visible: root.settingsOpen
                    settings: root.userSettings
                    backgroundColor: root.backgroundColor
                    panelColor: root.controlColor
                    accentColor: root.accentColor
                    textColor: root.textColor
                    mutedColor: root.mutedColor
                    fontFamily: root.typeface
                    onSettingChanged: function(category, key, value) {
                        root.applySetting(category, key, value)
                    }
                    onCategoryReset: function(category) {
                        root.resetSettingsCategory(category)
                    }
                    onCloseRequested: root.closeSettingsPanel()
                }

                ProgressUi.ProgressView {
                    id: progressPanel
                    z: 12
                    x: -content.x
                    y: 92
                    width: surface.width
                    height: surface.height - 104
                    visible: root.progressOpen
                    history: root.historyDocument()
                    currentSetup: ({
                        mode: root.mode,
                        amount: root.amount,
                        language: root.language,
                        punctuation: root.punctuation && root.currentLanguagePack.category !== "programming",
                        numbers: root.numbers && root.currentLanguagePack.category !== "programming",
                        metricsVersion: 1
                    })
                    goalMetric: root.userSettings.progress.goalMetric
                    goalTarget: root.userSettings.progress.goalTarget
                    backgroundColor: root.backgroundColor
                    panelColor: root.controlColor
                    accentColor: root.accentColor
                    textColor: root.textColor
                    mutedColor: root.mutedColor
                    fontFamily: root.typeface
                    reducedMotion: root.runtimeSettings.accessibility.reducedMotion
                    highContrast: root.runtimeSettings.accessibility.highContrast
                    onCloseRequested: root.closeProgressPanel()
                    onDeleteRequested: function(id) { root.deleteHistoryEntry(id) }
                    onClearRequested: root.clearHistory()
                    onExportRequested: root.exportHistoryCsv()
                    onGoalSettingChanged: function(metric, target) {
                        root.applyProgressGoal(metric, target)
                    }
                }

                Item {
                    id: testView
                    anchors.horizontalCenter: parent.horizontalCenter
                    y: Math.round(surface.height * 0.39)
                    width: Math.min(parent.width, root.runtimeSettings.appearance.maxLineWidth)
                    height: root.runtimeSettings.appearance.lineCount * root.runtimeSettings.appearance.lineHeight
                    visible: !root.result && !root.settingsOpen && !root.languagePanelOpen && !root.progressOpen

                    Text {
                        anchors.horizontalCenter: parent.horizontalCenter
                        y: -30
                        visible: !root.focusMode
                        text: "󰖟  " + root.activeLanguagePack.label
                        color: root.mutedColor
                        font.family: "JetBrainsMono Nerd Font"
                        font.pixelSize: 13
                    }

                    Text {
                        x: 0
                        y: -34
                        visible: root.focusMode && root.activeSettings.test.mode === "time"
                            && root.runtimeSettings.appearance.timerStyle !== "off"
                            && root.runtimeSettings.appearance.timerStyle !== "bar"
                        text: root.remainingSeconds
                        color: root.accentColor
                        font.family: root.typeface
                        font.pixelSize: root.runtimeSettings.appearance.timerStyle === "mini" ? 14 : 24
                    }

                    Rectangle {
                        x: 0
                        y: -18
                        width: parent.width
                        height: 3
                        visible: root.focusMode && root.activeSettings.test.mode === "time" && root.runtimeSettings.appearance.timerStyle === "bar"
                        color: Qt.rgba(root.mutedColor.r, root.mutedColor.g, root.mutedColor.b, 0.24)
                        Rectangle {
                            width: parent.width * Math.max(0, Math.min(1, root.remainingSeconds / Math.max(1, root.activeSettings.test.time)))
                            height: parent.height
                            color: root.accentColor
                            Behavior on width { NumberAnimation { duration: root.runtimeSettings.accessibility.reducedMotion ? 0 : 180 } }
                        }
                    }

                    Row {
                        anchors.right: parent.right
                        y: -34
                        spacing: 16
                        visible: root.focusMode && (root.runtimeSettings.appearance.liveWpm || root.runtimeSettings.appearance.liveAccuracy)
                        Text {
                            visible: root.runtimeSettings.appearance.liveWpm
                            text: Math.round(root.liveMetrics.wpm) + " wpm"
                            color: root.textColor
                            font.family: root.typeface
                            font.pixelSize: 13
                        }
                        Text {
                            visible: root.runtimeSettings.appearance.liveAccuracy
                            text: root.liveMetrics.accuracy.toFixed(0) + "% acc"
                            color: root.textColor
                            font.family: root.typeface
                            font.pixelSize: 13
                        }
                    }

                    Item {
                        id: wordsClip
                        anchors.fill: parent
                        clip: true
                        onWidthChanged: root.rebuildWordLayout(width)

                        Item {
                            id: typingFlow
                            width: parent.width
                            y: -Math.max(0, root.activeWordY - root.runtimeSettings.appearance.lineHeight)
                            Behavior on y {
                                enabled: root.runtimeSettings.appearance.smoothScroll && !root.runtimeSettings.accessibility.reducedMotion
                                NumberAnimation { duration: 130; easing.type: Easing.OutCubic }
                            }

                            Repeater {
                                id: wordRepeater
                                model: root.generated ? root.generated.words : []
                                delegate: Item {
                                    id: wordDelegate
                                    required property int index
                                    required property string modelData
                                    readonly property string word: modelData
                                    readonly property int globalStart: root.globalStartForWord(index)
                                    readonly property var geometry: root.wordLayout[index] || ({x: 0, y: 0, width: word.length * root.characterWidth + root.runtimeSettings.appearance.wordSpacing})
                                    x: geometry.x
                                    y: geometry.y
                                    width: geometry.width
                                    height: root.runtimeSettings.appearance.lineHeight

                                    Repeater {
                                        model: wordDelegate.word.length
                                        delegate: Text {
                                            required property int index
                                            x: index * root.characterWidth
                                            y: 0
                                            text: wordDelegate.word.charAt(index)
                                            color: {
                                                var globalIndex = wordDelegate.globalStart + index
                                                var typed = root.typing && globalIndex < root.typing.cursor
                                                var status = typed ? root.typing.status[globalIndex] : ""
                                                if (status === "error") {
                                                    var errorStyle = root.runtimeSettings.accessibility.errorStyle
                                                    return errorStyle === "color" || errorStyle === "both" ? root.errorColor : root.textColor
                                                }
                                                if (typed) {
                                                    var typedEffect = root.runtimeSettings.appearance.typedEffect
                                                    if (typedEffect === "hide") return Qt.rgba(root.textColor.r, root.textColor.g, root.textColor.b, 0)
                                                    if (typedEffect === "fade") return root.mutedColor
                                                    return root.textColor
                                                }
                                                var highlight = root.runtimeSettings.appearance.highlight
                                                if (highlight === "letter" && root.typing && globalIndex === root.typing.cursor) return root.accentColor
                                                if (highlight === "word" && wordDelegate.index === root.activeWordIndex) return root.textColor
                                                if (highlight === "next-word" && wordDelegate.index === root.activeWordIndex + 1) return root.textColor
                                                return root.mutedColor
                                            }
                                            font.family: root.typeface
                                            font.pixelSize: root.runtimeSettings.appearance.fontSize
                                            font.weight: Font.Medium
                                            font.underline: {
                                                if (!root.typing) return false
                                                var globalIndex = wordDelegate.globalStart + index
                                                var isError = globalIndex < root.typing.cursor && root.typing.status[globalIndex] === "error"
                                                var errorStyle = root.runtimeSettings.accessibility.errorStyle
                                                return isError && (errorStyle === "underline" || errorStyle === "both")
                                            }
                                        }
                                    }

                                    Rectangle {
                                        id: caret
                                        readonly property string style: root.runtimeSettings.caret.style
                                        visible: root.activeWordIndex === wordDelegate.index && !root.result && style !== "off"
                                        x: Math.min(wordDelegate.word.length, Math.max(0, root.typing ? root.typing.cursor - wordDelegate.globalStart : 0)) * root.characterWidth - 1
                                        y: style === "underline" ? root.runtimeSettings.appearance.fontSize + 3 : Math.max(1, (root.runtimeSettings.appearance.lineHeight - root.runtimeSettings.appearance.fontSize) / 2)
                                        width: style === "default" ? root.runtimeSettings.caret.thickness : root.characterWidth
                                        height: style === "underline" ? root.runtimeSettings.caret.thickness : root.runtimeSettings.appearance.fontSize
                                        radius: style === "default" || style === "underline" ? 1 : 2
                                        color: style === "outline" ? "transparent" : root.caretColor
                                        opacity: style === "block" ? 0.3 : 1
                                        border.width: style === "outline" ? root.runtimeSettings.caret.thickness : 0
                                        border.color: root.caretColor
                                        Behavior on x {
                                            enabled: root.caretSmoothDuration > 0
                                            NumberAnimation { duration: root.caretSmoothDuration; easing.type: Easing.OutCubic }
                                        }
                                        SequentialAnimation on opacity {
                                            running: caret.visible && root.runtimeSettings.caret.blink && !root.focusMode && !root.runtimeSettings.accessibility.reducedMotion
                                            loops: Animation.Infinite
                                            NumberAnimation { to: 0.12; duration: Math.round(root.runtimeSettings.caret.blinkMs / 2) }
                                            NumberAnimation { to: caret.style === "block" ? 0.3 : 1; duration: Math.round(root.runtimeSettings.caret.blinkMs / 2) }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    Text {
                        anchors.horizontalCenter: parent.horizontalCenter
                        y: testView.height + 52
                        visible: !root.focusMode
                        text: "↻"
                        color: restartMouse.containsMouse ? root.textColor : root.mutedColor
                        font.family: root.typeface
                        font.pixelSize: 25
                        Accessible.role: Accessible.Button
                        Accessible.name: "Restart typing test"
                        Accessible.description: "Ctrl+R"
                        Accessible.onPressAction: root.restart()
                        MouseArea {
                            id: restartMouse
                            anchors.fill: parent
                            anchors.margins: -10
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: root.restart()
                        }
                    }
                }

                Item {
                    id: results
                    x: 0
                    y: Math.round(surface.height * 0.25)
                    width: parent.width
                    height: 360
                    visible: !!root.result && !root.settingsOpen && !root.languagePanelOpen && !root.progressOpen

                    Row {
                        anchors.fill: parent
                        spacing: 42

                        Column {
                            width: 132
                            spacing: 0
                            Text { text: "wpm"; color: root.mutedColor; font.family: root.typeface; font.pixelSize: 28 }
                            Text { text: root.result ? Math.round(root.result.wpm) : ""; color: root.accentColor; font.family: root.typeface; font.pixelSize: 64 }
                            Item { width: 1; height: 10 }
                            Text { text: "acc"; color: root.mutedColor; font.family: root.typeface; font.pixelSize: 28 }
                            Text { text: root.result ? root.result.accuracy.toFixed(0) + "%" : ""; color: root.accentColor; font.family: root.typeface; font.pixelSize: 54 }
                        }

                        Canvas {
                            id: resultChart
                            width: Math.max(300, results.width - 420)
                            height: 230
                            onVisibleChanged: if (visible) requestPaint()
                            onPaint: {
                                var ctx = getContext("2d")
                                ctx.clearRect(0, 0, width, height)
                                ctx.strokeStyle = root.mutedColor
                                ctx.globalAlpha = 0.35
                                ctx.lineWidth = 1
                                for (var line = 1; line <= 4; ++line) {
                                    var gy = line * height / 5
                                    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(width, gy); ctx.stroke()
                                }
                                ctx.globalAlpha = 1
                                var points = root.samples
                                if (!points || points.length === 0) return
                                var maximum = 10
                                for (var i = 0; i < points.length; ++i) maximum = Math.max(maximum, Number(points[i]) || 0)
                                ctx.strokeStyle = root.accentColor
                                ctx.lineWidth = 3
                                ctx.beginPath()
                                for (var p = 0; p < points.length; ++p) {
                                    var px = points.length === 1 ? width / 2 : p * width / (points.length - 1)
                                    var py = height - 18 - ((Number(points[p]) || 0) / maximum) * (height - 36)
                                    if (p === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
                                }
                                ctx.stroke()
                            }
                        }

                        Column {
                            width: 190
                            spacing: 2
                            Text { text: "test type"; color: root.mutedColor; font.family: root.typeface; font.pixelSize: 13 }
                            Text { text: root.activeSettings.test.mode + " " + root.activeAmount + "\n" + root.activeLanguagePack.label; color: root.textColor; font.family: root.typeface; font.pixelSize: 16 }
                            Item { width: 1; height: 10 }
                            Text { text: "raw"; color: root.mutedColor; font.family: root.typeface; font.pixelSize: 13 }
                            Text { text: root.result ? root.result.rawWpm.toFixed(0) : ""; color: root.textColor; font.family: root.typeface; font.pixelSize: 16 }
                            Item { width: 1; height: 10 }
                            Text { text: "characters"; color: root.mutedColor; font.family: root.typeface; font.pixelSize: 13 }
                            Text {
                                text: root.result ? root.result.correct + "/" + root.result.errors + "/0/0" : ""
                                color: root.textColor
                                font.family: root.typeface
                                font.pixelSize: 16
                            }
                            Item { width: 1; height: 10 }
                            Text { text: "consistency"; color: root.mutedColor; font.family: root.typeface; font.pixelSize: 13 }
                            Text { text: root.result ? root.result.consistency.toFixed(0) + "%" : ""; color: root.textColor; font.family: root.typeface; font.pixelSize: 16 }
                        }
                    }

                    Text {
                        anchors.horizontalCenter: parent.horizontalCenter
                        y: 278
                        text: root.resultSaveStatus === "saving" ? "saving locally…" : root.resultSaveStatus === "saved" ? "saved locally · ctrl+h progress" : root.resultSaveStatus === "deleted" ? "deleted from local history" : root.resultSaveStatus === "cleared" ? "history cleared · result no longer saved" : root.resultSaveStatus === "failed" ? "not saved · disk write failed" : "not saved · unsupported history schema"
                        color: root.mutedColor
                        font.family: root.typeface
                        font.pixelSize: 12
                        Accessible.role: Accessible.Button
                        Accessible.name: root.resultSaveStatus === "saving" ? "Saving result locally" : root.resultSaveStatus === "saved" ? "Saved locally. Open progress with Control H" : root.resultSaveStatus === "deleted" || root.resultSaveStatus === "cleared" ? "Result is no longer in local history" : "Result was not saved"
                        Accessible.onPressAction: root.openProgressPanel()
                        MouseArea { anchors.fill: parent; anchors.margins: -7; cursorShape: Qt.PointingHandCursor; onClicked: root.openProgressPanel() }
                    }
                }

                Row {
                    anchors.horizontalCenter: parent.horizontalCenter
                    y: surface.height - 108
                    spacing: 25
                    visible: (!root.focusMode || !root.runtimeSettings.appearance.focusHideFooter) && !root.languagePanelOpen && !root.progressOpen
                    Text { text: "ctrl+r  restart"; color: root.mutedColor; font.family: root.typeface; font.pixelSize: 12 }
                    Text { visible: !!root.result; text: "enter  next"; color: root.mutedColor; font.family: root.typeface; font.pixelSize: 12 }
                    Text { text: "ctrl+esc  close"; color: root.mutedColor; font.family: root.typeface; font.pixelSize: 12 }
                    Text {
                        text: "ctrl+h  progress"
                        color: root.progressOpen ? root.accentColor : root.mutedColor
                        font.family: root.typeface
                        font.pixelSize: 12
                        Accessible.role: Accessible.Button
                        Accessible.name: "Open progress"
                        Accessible.onPressAction: root.openProgressPanel()
                        MouseArea { anchors.fill: parent; anchors.margins: -6; cursorShape: Qt.PointingHandCursor; onClicked: root.openProgressPanel() }
                    }
                    Text {
                        text: "ctrl+,  settings"
                        color: root.settingsOpen ? root.accentColor : root.mutedColor
                        font.family: root.typeface
                        font.pixelSize: 12
                        Accessible.role: Accessible.Button
                        Accessible.name: "Open settings"
                        Accessible.onPressAction: root.openSettingsPanel(settingsPanel.currentSection)
                        MouseArea {
                            anchors.fill: parent
                            anchors.margins: -6
                            cursorShape: Qt.PointingHandCursor
                            onClicked: {
                                if (root.settingsOpen) root.closeSettingsPanel()
                                else root.openSettingsPanel(settingsPanel.currentSection)
                            }
                        }
                    }
                    Text {
                        text: "ctrl+l  language"
                        color: root.languagePanelOpen ? root.accentColor : root.mutedColor
                        font.family: root.typeface
                        font.pixelSize: 12
                        Accessible.role: Accessible.Button
                        Accessible.name: "Choose typing language"
                        Accessible.onPressAction: root.openLanguagePanel()
                    }
                }

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    y: surface.height - 77
                    visible: root.settingsOpen && !root.focusMode
                    text: "seed  " + root.seed + "    retained history  " + historyAdapter.entries.length + "/2000    local only" + (root.settingsStatus ? "    · " + root.settingsStatus : "")
                    textFormat: Text.PlainText
                    color: root.mutedColor
                    font.family: root.typeface
                    font.pixelSize: 11
                }
            }
        }
    }
}

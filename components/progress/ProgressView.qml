import QtQuick
import "../../src/progress.js" as Progress

Rectangle {
    id: root

    property var history: ({schemaVersion: 2, entries: [], rollups: [], archive: []})
    property var currentSetup: ({mode: "time", amount: 30, language: "english", punctuation: false, numbers: false, metricsVersion: 1})
    property string goalMetric: "tests"
    property int goalTarget: 10
    property color backgroundColor: "#1f1f1f"
    property color panelColor: "#292929"
    property color accentColor: "#e2b714"
    property color textColor: "#eeeeee"
    property color mutedColor: "#888888"
    property string fontFamily: "monospace"
    property bool reducedMotion: false
    property bool highContrast: false
    property string scope: "current"
    property string period: "90d"
    property string languageFilter: "current"
    property string modeFilter: "current"
    property var amountFilter: "current"
    property int focusedRegion: 0
    property int selectedIndex: 0
    property int actionIndex: 0
    property string deleteConfirmId: ""
    property bool clearConfirm: false
    property string statusMessage: ""
    property string today: root.localToday()

    readonly property var availableFilters: Progress.filterOptions(root.history)
    readonly property var activityFilters: root.buildActivityFilters(true)
    readonly property var heatmapFilters: root.buildActivityFilters(false)
    readonly property var comparisonFilters: root.scope === "current" ? root.buildCurrentCohortFilters() : null
    readonly property var comparisonSummary: Progress.summary(root.history, root.comparisonFilters, {today: root.today, heatmapDays: 90})
    readonly property var activityTotals: Progress.totals(root.history, root.activityFilters)
    readonly property var activityStreaks: Progress.streaks(root.history, root.activityFilters, root.today)
    readonly property var heatmapDays: Progress.activityHeatmap(root.history, root.heatmapFilters, root.today, 90)
    readonly property var chartSeries: root.comparisonSummary.daily
    readonly property var ledgerEntries: Progress.entries(root.history, root.activityFilters, false)
    readonly property var selectedEntry: root.ledgerEntries.length > 0
        ? Progress.selectedResult(root.history, root.ledgerEntries[Math.max(0, Math.min(root.selectedIndex, root.ledgerEntries.length - 1))].id)
        : null
    readonly property var goal: Progress.goalProgress(root.history, {}, root.today, {metric: root.goalMetric, target: root.goalTarget})
    readonly property var languages: Progress.languageComparison(root.history, root.languageBaseFilters())
    readonly property var scopeOptions: ["current", "all"]
    readonly property var periodOptions: ["30d", "90d", "all"]
    readonly property var languageOptions: ["current", "all"].concat(root.availableFilters.languages)
    readonly property var modeOptions: ["current", "all"].concat(root.availableFilters.modes)
    readonly property var amountOptions: root.buildAmountOptions()

    signal closeRequested()
    signal deleteRequested(string id)
    signal clearRequested()
    signal exportRequested()
    signal goalSettingChanged(string metric, int target)

    Accessible.role: Accessible.Dialog
    Accessible.name: "OmaType progress"
    color: root.backgroundColor

    onVisibleChanged: {
        if (visible) {
            root.today = root.localToday()
            root.resetConfirmations()
            root.clampSelection()
            root.focusedRegion = 0
            scroller.contentY = 0
        }
    }
    onLedgerEntriesChanged: root.clampSelection()
    onFocusedRegionChanged: Qt.callLater(function() { root.revealFocusedRegion() })

    function localToday() {
        var now = new Date()
        return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
    }

    function buildAmountOptions() {
        var values = ["current", "all"]
        for (var index = 0; index < root.availableFilters.amounts.length; ++index) {
            var value = root.availableFilters.amounts[index]
            var selectedMode = root.modeFilter === "current" ? root.currentSetup.mode : root.modeFilter
            if (selectedMode === "time" || selectedMode === "words") {
                if (value.mode !== selectedMode) continue
            }
            values.push(value.mode + ":" + value.amount)
        }
        return values
    }

    function periodFilters() {
        return Progress.periodBounds(root.period, root.today)
    }

    function addPeriodFilters(filters) {
        var bounds = root.periodFilters()
        if (bounds.fromDay) filters.fromDay = bounds.fromDay
        if (bounds.toDay) filters.toDay = bounds.toDay
        return filters
    }

    function buildActivityFilters(includePeriod) {
        var filters = includePeriod === false ? ({}) : root.addPeriodFilters(({}))
        if (root.scope === "current") {
            filters.mode = root.currentSetup.mode
            filters.amount = root.currentSetup.amount
            filters.language = root.currentSetup.language
            filters.punctuation = root.currentSetup.punctuation
            filters.numbers = root.currentSetup.numbers
            filters.metricsVersion = root.currentSetup.metricsVersion
        } else {
            if (root.languageFilter === "current") filters.language = root.currentSetup.language
            else if (root.languageFilter !== "all") filters.language = root.languageFilter
            if (root.modeFilter === "current") filters.mode = root.currentSetup.mode
            else if (root.modeFilter !== "all") filters.mode = root.modeFilter
            if (root.amountFilter === "current") filters.amount = root.currentSetup.amount
            else if (root.amountFilter !== "all") {
                var parts = String(root.amountFilter).split(":")
                if (parts.length === 2) {
                    filters.mode = parts[0]
                    filters.amount = Number(parts[1])
                }
            }
        }
        return filters
    }

    function buildCurrentCohortFilters() {
        return root.buildActivityFilters(true)
    }

    function languageBaseFilters() {
        return root.addPeriodFilters({
            mode: root.currentSetup.mode,
            amount: root.currentSetup.amount,
            punctuation: root.currentSetup.punctuation,
            numbers: root.currentSetup.numbers,
            metricsVersion: root.currentSetup.metricsVersion
        })
    }

    function cycleValue(options, current, delta) {
        var index = options.indexOf(current)
        if (index < 0) index = 0
        return options[(index + delta + options.length) % options.length]
    }

    function goalTargets() {
        return root.goalMetric === "characters" ? [100, 500, 1000, 2500, 5000, 10000] : [5, 10, 15, 20, 30, 60]
    }

    function changeGoalMetric(delta) {
        root.focusedRegion = 6
        var next = root.cycleValue(["tests", "minutes", "characters"], root.goalMetric, delta)
        root.resetConfirmations()
        root.goalSettingChanged(next, next === "characters" ? 1000 : 10)
    }

    function changeGoalTarget(delta) {
        root.focusedRegion = 7
        var targets = root.goalTargets()
        var index = targets.indexOf(root.goalTarget)
        if (index < 0) index = 0
        root.resetConfirmations()
        root.goalSettingChanged(root.goalMetric, targets[(index + delta + targets.length) % targets.length])
    }

    function setScope(value) {
        root.resetConfirmations()
        root.scope = value
        root.languageFilter = value === "all" ? "all" : "current"
        root.modeFilter = value === "all" ? "all" : "current"
        root.amountFilter = value === "all" ? "all" : "current"
        if (value === "current" && [2, 3, 4].indexOf(root.focusedRegion) >= 0) root.focusedRegion = 0
    }

    function visibleRegions() {
        return root.scope === "current" ? [0, 1, 5, 6, 7, 8] : [0, 1, 2, 3, 4, 5, 6, 7, 8]
    }

    function focusRegionBy(delta) {
        var regions = root.visibleRegions()
        var index = regions.indexOf(root.focusedRegion)
        if (index < 0) index = 0
        root.focusedRegion = regions[(index + delta + regions.length) % regions.length]
        root.resetConfirmations()
    }

    function cycleFocused(delta) {
        if (root.focusedRegion === 0) root.setScope(root.cycleValue(root.scopeOptions, root.scope, delta))
        else if (root.focusedRegion === 1) root.period = root.cycleValue(root.periodOptions, root.period, delta)
        else if (root.focusedRegion === 2) root.languageFilter = root.cycleValue(root.languageOptions, root.languageFilter, delta)
        else if (root.focusedRegion === 3) {
            root.modeFilter = root.cycleValue(root.modeOptions, root.modeFilter, delta)
            root.amountFilter = "all"
        } else if (root.focusedRegion === 4) root.amountFilter = root.cycleValue(root.amountOptions, root.amountFilter, delta)
        else if (root.focusedRegion === 6) root.changeGoalMetric(delta)
        else if (root.focusedRegion === 7) root.changeGoalTarget(delta)
        else if (root.focusedRegion === 8) root.actionIndex = (root.actionIndex + delta + 3) % 3
        root.clampSelection()
        root.resetConfirmations()
    }

    function clampSelection() {
        if (root.ledgerEntries.length === 0) root.selectedIndex = 0
        else root.selectedIndex = Math.max(0, Math.min(root.selectedIndex, root.ledgerEntries.length - 1))
    }

    function moveSelection(delta) {
        if (root.ledgerEntries.length === 0) return
        root.focusedRegion = 5
        root.selectedIndex = Math.max(0, Math.min(root.ledgerEntries.length - 1, root.selectedIndex + delta))
        resultList.positionViewAtIndex(root.selectedIndex, ListView.Contain)
        root.resetConfirmations()
    }

    function selectionBoundary(last) {
        if (root.ledgerEntries.length === 0) return
        root.focusedRegion = 5
        root.selectedIndex = last ? root.ledgerEntries.length - 1 : 0
        resultList.positionViewAtIndex(root.selectedIndex, ListView.Contain)
        root.resetConfirmations()
    }

    function clearFilters() {
        root.resetConfirmations()
        root.scope = "current"
        root.period = "90d"
        root.languageFilter = "current"
        root.modeFilter = "current"
        root.amountFilter = "current"
        root.focusedRegion = 0
        root.statusMessage = "filters reset to current setup"
    }

    function resetConfirmations() {
        root.deleteConfirmId = ""
        root.clearConfirm = false
    }

    function requestDelete() {
        if (!root.selectedEntry) {
            root.resetConfirmations()
            root.statusMessage = "no retained result selected"
            return
        }
        if (root.deleteConfirmId === root.selectedEntry.id) {
            var id = root.selectedEntry.id
            root.resetConfirmations()
            root.deleteRequested(id)
            return
        }
        root.deleteConfirmId = root.selectedEntry.id
        root.clearConfirm = false
        root.statusMessage = "activate delete again or press Delete again to remove this retained result"
    }

    function requestClear() {
        if (root.clearConfirm) {
            root.resetConfirmations()
            root.clearRequested()
            return
        }
        root.clearConfirm = true
        root.deleteConfirmId = ""
        root.statusMessage = "press Shift+Delete again or activate clear again to erase all history"
    }

    function regionItem(region) {
        if (region === 0) return scopeLabel
        if (region === 1) return periodLabel
        if (region === 2) return languageLabel
        if (region === 3) return modeLabel
        if (region === 4) return amountLabel
        if (region === 5) return ledgerGrid
        if (region === 6 || region === 7) return goalPanel
        return actionsPanel
    }

    function revealFocusedRegion() {
        if (!visible) return
        var item = root.regionItem(root.focusedRegion)
        if (!item) return
        var point = item.mapToItem(scroller.contentItem, 0, 0)
        var top = point.y - 20
        var bottom = point.y + item.height + 20
        if (top < scroller.contentY) scroller.contentY = Math.max(0, top)
        else if (bottom > scroller.contentY + scroller.height) scroller.contentY = Math.min(scroller.contentHeight - scroller.height, bottom - scroller.height)
    }

    function scrollPage(delta) {
        scroller.contentY = Math.max(0, Math.min(scroller.contentHeight - scroller.height,
            scroller.contentY + delta * Math.max(120, scroller.height * 0.75)))
        root.resetConfirmations()
    }

    function closeFromPointer() {
        root.resetConfirmations()
        root.closeRequested()
    }

    function handleKey(event) {
        if (event.key === Qt.Key_Escape) { root.resetConfirmations(); root.closeRequested() }
        else if (event.key === Qt.Key_Tab) root.focusRegionBy((event.modifiers & Qt.ShiftModifier) ? -1 : 1)
        else if (event.key === Qt.Key_Left) root.cycleFocused(-1)
        else if (event.key === Qt.Key_Right) root.cycleFocused(1)
        else if (event.key === Qt.Key_Up) { if (root.focusedRegion === 5) root.moveSelection(-1); else root.scrollPage(-0.2) }
        else if (event.key === Qt.Key_Down) { if (root.focusedRegion === 5) root.moveSelection(1); else root.scrollPage(0.2) }
        else if (event.key === Qt.Key_Home) { if (root.focusedRegion === 5) root.selectionBoundary(false); else scroller.contentY = 0 }
        else if (event.key === Qt.Key_End) { if (root.focusedRegion === 5) root.selectionBoundary(true); else scroller.contentY = Math.max(0, scroller.contentHeight - scroller.height) }
        else if (event.key === Qt.Key_PageUp) { if (root.focusedRegion === 5) root.moveSelection(-10); else root.scrollPage(-1) }
        else if (event.key === Qt.Key_PageDown) { if (root.focusedRegion === 5) root.moveSelection(10); else root.scrollPage(1) }
        else if (event.key === Qt.Key_C && !(event.modifiers & Qt.ControlModifier)) root.clearFilters()
        else if (event.key === Qt.Key_Delete && (event.modifiers & Qt.ShiftModifier)) root.requestClear()
        else if (event.key === Qt.Key_Delete) root.requestDelete()
        else if ((event.key === Qt.Key_Enter || event.key === Qt.Key_Return || event.key === Qt.Key_Space) && root.focusedRegion === 8) {
            if (root.actionIndex === 0) { root.resetConfirmations(); root.exportRequested() }
            else if (root.actionIndex === 1) root.requestDelete()
            else root.requestClear()
        } else return false
        event.accepted = true
        return true
    }

    Flickable {
        id: scroller
        anchors.fill: parent
        contentWidth: width
        contentHeight: body.height + 36
        clip: true
        boundsBehavior: Flickable.StopAtBounds

        Column {
            id: body
            x: Math.max(12, Math.round((scroller.width - width) / 2))
            y: 16
            width: Math.min(scroller.width - 24, 1220)
            spacing: 16

            Item {
                width: parent.width
                height: width < 700 ? 96 : 56
                Text { text: "progress"; color: root.textColor; font.family: root.fontFamily; font.pixelSize: 28; font.weight: Font.DemiBold }
                ProgressButton {
                    anchors.right: parent.right
                    y: 0
                    label: "back to typing"
                    accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.panelColor; fontFamily: root.fontFamily
                    Accessible.description: "Close progress and return to typing"
                    onActivated: root.closeFromPointer()
                }
                Text {
                    x: parent.width < 700 ? 0 : 160
                    y: parent.width < 700 ? 50 : 14
                    width: parent.width < 700 ? parent.width : Math.max(1, parent.width - x - 150)
                    text: "Tab regions · arrows adjust or scroll · C current setup · Delete remove · Shift+Delete clear · Esc back"
                    color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 10; wrapMode: Text.WordWrap
                }
            }

            Rectangle {
                id: filterPanel
                width: parent.width
                height: filterFlow.height + 20
                radius: 9
                color: "transparent"
                border.width: root.focusedRegion >= 0 && root.focusedRegion <= 4 ? 2 : (root.highContrast ? 1 : 0)
                border.color: root.focusedRegion >= 0 && root.focusedRegion <= 4 ? root.accentColor : root.mutedColor
                Accessible.role: Accessible.Grouping
                Accessible.name: "Progress filters"
                Accessible.focusable: true
                Accessible.focused: root.focusedRegion >= 0 && root.focusedRegion <= 4

                Flow {
                    id: filterFlow
                    x: 10; y: 10; width: parent.width - 20
                    spacing: 8
                    Text { id: scopeLabel; objectName: "scope-filter"; width: implicitWidth; height: 40; verticalAlignment: Text.AlignVCenter; text: "scope"; color: root.focusedRegion === 0 ? root.accentColor : root.mutedColor; font.family: root.fontFamily; font.pixelSize: 11 }
                    Repeater { model: root.scopeOptions; delegate: ProgressButton { required property string modelData; label: modelData === "current" ? "current setup" : "all activity"; selected: root.scope === modelData; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.panelColor; fontFamily: root.fontFamily; onActivated: root.setScope(modelData) } }
                    Text { id: periodLabel; objectName: "period-filter"; width: implicitWidth; height: 40; verticalAlignment: Text.AlignVCenter; text: "period"; color: root.focusedRegion === 1 ? root.accentColor : root.mutedColor; font.family: root.fontFamily; font.pixelSize: 11 }
                    Repeater { model: root.periodOptions; delegate: ProgressButton { required property string modelData; label: modelData; selected: root.period === modelData; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.panelColor; fontFamily: root.fontFamily; onActivated: { root.resetConfirmations(); root.period = modelData; root.focusedRegion = 1 } } }
                    Text { id: languageLabel; objectName: "language-filter"; visible: root.scope === "all"; height: 40; verticalAlignment: Text.AlignVCenter; text: "language"; color: root.focusedRegion === 2 ? root.accentColor : root.mutedColor; font.family: root.fontFamily; font.pixelSize: 11 }
                    Repeater { model: root.scope === "all" ? root.languageOptions : []; delegate: ProgressButton { required property string modelData; label: modelData === "current" ? "current: " + root.currentSetup.language : modelData; selected: root.languageFilter === modelData; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.panelColor; fontFamily: root.fontFamily; onActivated: { root.resetConfirmations(); root.languageFilter = modelData; root.focusedRegion = 2 } } }
                    Text { id: modeLabel; objectName: "mode-filter"; visible: root.scope === "all"; height: 40; verticalAlignment: Text.AlignVCenter; text: "mode"; color: root.focusedRegion === 3 ? root.accentColor : root.mutedColor; font.family: root.fontFamily; font.pixelSize: 11 }
                    Repeater { model: root.scope === "all" ? root.modeOptions : []; delegate: ProgressButton { required property string modelData; label: modelData === "current" ? "current: " + root.currentSetup.mode : modelData; selected: root.modeFilter === modelData; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.panelColor; fontFamily: root.fontFamily; onActivated: { root.resetConfirmations(); root.modeFilter = modelData; root.amountFilter = "all"; root.focusedRegion = 3 } } }
                    Text { id: amountLabel; objectName: "amount-filter"; visible: root.scope === "all"; height: 40; verticalAlignment: Text.AlignVCenter; text: "amount"; color: root.focusedRegion === 4 ? root.accentColor : root.mutedColor; font.family: root.fontFamily; font.pixelSize: 11 }
                    Repeater { model: root.scope === "all" ? root.amountOptions : []; delegate: ProgressButton { required property var modelData; label: modelData === "current" ? "current: " + root.currentSetup.amount : modelData === "all" ? "all" : String(modelData).replace(":", " "); selected: root.amountFilter === modelData; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.panelColor; fontFamily: root.fontFamily; onActivated: { root.resetConfirmations(); root.amountFilter = modelData; root.focusedRegion = 4 } } }
                }
            }

            Text {
                width: parent.width
                text: root.scope === "current"
                    ? root.currentSetup.mode + " " + root.currentSetup.amount + " · " + root.currentSetup.language + (root.currentSetup.punctuation ? " · punctuation" : "") + (root.currentSetup.numbers ? " · numbers" : "")
                    : "Mixed activity is shown for volume only. Comparative pace, accuracy, and personal bests require one exact setup."
                color: root.scope === "current" ? root.mutedColor : root.textColor
                font.family: root.fontFamily; font.pixelSize: 11; wrapMode: Text.WordWrap
            }

            Grid {
                width: parent.width
                visible: root.scope === "current"
                columns: width >= 900 ? 4 : width >= 500 ? 2 : 1
                columnSpacing: 14; rowSpacing: 10
                Repeater {
                    model: [
                        {label: "latest comparable", value: root.comparisonSummary.latest ? Math.round(root.comparisonSummary.latest.wpm) + " wpm" : "—"},
                        {label: "personal best", value: root.comparisonSummary.personalBest ? Math.round(root.comparisonSummary.personalBest.wpm) + " wpm" : "—"},
                        {label: "recent accuracy", value: root.comparisonSummary.recentAccuracy !== null ? Number(root.comparisonSummary.recentAccuracy).toFixed(1) + "%" : "—"},
                        {label: "pace", value: root.comparisonSummary.pace.delta !== null ? (root.comparisonSummary.pace.delta >= 0 ? "+" : "") + Number(root.comparisonSummary.pace.delta).toFixed(1) + " wpm" : root.scope === "current" ? "needs 10 tests" : "—"}
                    ]
                    delegate: Rectangle {
                        required property var modelData
                        width: (parent.width - (parent.columns - 1) * parent.columnSpacing) / parent.columns
                        height: 78; radius: 9; color: root.panelColor
                        border.width: root.highContrast ? 1 : 0; border.color: root.mutedColor
                        Text { x: 14; y: 12; text: modelData.label; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 10 }
                        Text { x: 14; y: 33; text: modelData.value; color: root.accentColor; font.family: root.fontFamily; font.pixelSize: 22; font.weight: Font.DemiBold }
                    }
                }
            }

            Text {
                width: parent.width
                visible: root.scope === "current" && root.comparisonSummary.pace.sampleSize < 10
                text: root.comparisonSummary.pace.sampleSize === 0 ? "Finish a test in this exact setup to begin your progress trace." : root.comparisonSummary.pace.sampleSize + " of 10 comparable tests recorded · " + (10 - root.comparisonSummary.pace.sampleSize) + " more unlock pace comparison."
                color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 11; wrapMode: Text.WordWrap
            }

            ProgressChart {
                width: parent.width; height: 210; visible: root.scope === "current"; series: root.chartSeries
                accentColor: root.accentColor; rawColor: root.mutedColor; gridColor: root.mutedColor; textColor: root.textColor; fontFamily: root.fontFamily
                highContrast: root.highContrast; reducedMotion: root.reducedMotion
                title: "comparable pace · daily average"
            }

            Grid {
                width: parent.width; columns: width >= 900 ? 2 : 1; columnSpacing: 20; rowSpacing: 18
                Rectangle { width: parent.columns === 2 ? (parent.width - parent.columnSpacing) / 2 : parent.width; height: Math.max(150, heatmap.implicitHeight + 24); radius: 10; color: root.panelColor; border.width: root.highContrast ? 1 : 0; border.color: root.mutedColor; ActivityHeatmap { id: heatmap; x: 14; y: 12; width: parent.width - 28; height: parent.height - 24; days: root.heatmapDays; accentColor: root.accentColor; emptyColor: root.backgroundColor; textColor: root.textColor; mutedColor: root.mutedColor; fontFamily: root.fontFamily; highContrast: root.highContrast } }
                Rectangle {
                    width: parent.columns === 2 ? (parent.width - parent.columnSpacing) / 2 : parent.width; height: 150; radius: 10; color: root.panelColor; border.width: root.highContrast ? 1 : 0; border.color: root.mutedColor
                    Text { x: 14; y: 12; text: "activity totals"; color: root.textColor; font.family: root.fontFamily; font.pixelSize: 13; font.weight: Font.DemiBold }
                    Text { x: 14; y: 42; width: parent.width - 28; text: root.activityTotals.tests + " tests · " + root.activityTotals.minutes + " minutes · " + root.activityTotals.characters + " characters\n" + root.activityStreaks.current + " current streak · " + root.activityStreaks.longest + " longest · " + root.activityStreaks.activeDays + " active days"; color: root.textColor; font.family: root.fontFamily; font.pixelSize: 13; lineHeight: 1.55; wrapMode: Text.Wrap }
                }
            }

            Grid {
                id: ledgerGrid
                width: parent.width
                columns: width >= 900 ? 2 : 1
                columnSpacing: 20; rowSpacing: 18

                Rectangle {
                    width: parent.columns === 2 ? (parent.width - parent.columnSpacing) / 2 : parent.width
                    height: 310; radius: 10; color: root.panelColor
                    border.width: root.focusedRegion === 5 ? 2 : (root.highContrast ? 1 : 0)
                    border.color: root.focusedRegion === 5 ? root.accentColor : root.mutedColor
                    Accessible.role: Accessible.List
                    Accessible.name: "Retained results"
                    Accessible.focusable: true
                    Accessible.focused: root.focusedRegion === 5
                    Text { x: 14; y: 12; text: "retained results"; color: root.textColor; font.family: root.fontFamily; font.pixelSize: 13; font.weight: Font.DemiBold }
                    Text { anchors.right: parent.right; anchors.rightMargin: 14; y: 14; text: root.ledgerEntries.length + " shown"; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 10 }
                    ListView {
                        id: resultList
                        x: 10; y: 40; width: parent.width - 20; height: parent.height - 50; clip: true
                        model: root.ledgerEntries; spacing: 3
                        delegate: Rectangle {
                            required property int index
                            required property var modelData
                            width: resultList.width; height: 40; radius: 5
                            color: root.selectedIndex === index ? Qt.rgba(root.accentColor.r, root.accentColor.g, root.accentColor.b, 0.16) : "transparent"
                            border.width: root.selectedIndex === index ? (root.focusedRegion === 5 ? 2 : 1) : 0
                            border.color: root.accentColor
                            Accessible.role: Accessible.ListItem
                            Accessible.name: modelData.localDay + ", " + Math.round(modelData.wpm) + " wpm, " + Number(modelData.accuracy).toFixed(0) + " percent accuracy"
                            Accessible.selected: root.selectedIndex === index
                            Accessible.focusable: true
                            Accessible.focused: root.selectedIndex === index && root.focusedRegion === 5
                            Text { x: 8; anchors.verticalCenter: parent.verticalCenter; width: parent.width * 0.25; text: modelData.localDay || "legacy"; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 10 }
                            Text { x: parent.width * 0.28; anchors.verticalCenter: parent.verticalCenter; width: parent.width * 0.31; text: modelData.mode + " " + modelData.amount + " · " + modelData.language; color: root.textColor; font.family: root.fontFamily; font.pixelSize: 10; elide: Text.ElideRight }
                            Text { anchors.right: parent.right; anchors.rightMargin: 8; anchors.verticalCenter: parent.verticalCenter; text: Math.round(modelData.wpm) + " wpm  " + Number(modelData.accuracy).toFixed(0) + "%"; color: root.textColor; font.family: root.fontFamily; font.pixelSize: 10 }
                            MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: { root.resetConfirmations(); root.selectedIndex = parent.index; root.focusedRegion = 5 } }
                        }
                    }
                    ProgressButton {
                        visible: root.ledgerEntries.length === 0
                        anchors.centerIn: parent
                        label: "return to typing"
                        accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily
                        Accessible.description: "Close empty progress and start a typing test"
                        onActivated: root.closeFromPointer()
                    }
                }

                Rectangle {
                    width: parent.columns === 2 ? (parent.width - parent.columnSpacing) / 2 : parent.width
                    height: 310; radius: 10; color: root.panelColor
                    border.width: root.highContrast ? 1 : 0; border.color: root.mutedColor
                    Text { x: 14; y: 12; text: "selected result"; color: root.textColor; font.family: root.fontFamily; font.pixelSize: 13; font.weight: Font.DemiBold }
                    ProgressButton {
                        anchors.right: parent.right; anchors.rightMargin: 10; y: 6
                        enabled: !!root.selectedEntry
                        opacity: enabled ? 1 : 0.45
                        label: root.deleteConfirmId ? "confirm delete" : "delete selected"
                        accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily
                        Accessible.description: "Requires confirmation before deleting the selected retained result"
                        onActivated: root.requestDelete()
                    }
                    Text {
                        x: 14; y: 54; width: parent.width - 28
                        text: root.selectedEntry ? root.selectedEntry.mode + " " + root.selectedEntry.amount + " · " + root.selectedEntry.language
                            + "\n" + Math.round(root.selectedEntry.wpm) + " net / " + Math.round(root.selectedEntry.rawWpm) + " raw · " + Number(root.selectedEntry.accuracy).toFixed(1) + "% accuracy"
                            + "\n" + root.selectedEntry.correct + " correct · " + root.selectedEntry.errors + " errors · " + root.selectedEntry.corrections + " corrections"
                            + "\n" + Math.round(Number(root.selectedEntry.elapsedMs || 0) / 1000) + " sec · " + root.selectedEntry.completion + " · seed " + root.selectedEntry.seed
                            : "Select a retained result to inspect exact details. Compacted history contributes to totals but cannot be individually selected."
                        color: root.textColor; font.family: root.fontFamily; font.pixelSize: 11; lineHeight: 1.35; wrapMode: Text.Wrap; elide: Text.ElideRight; maximumLineCount: 4
                    }
                    ProgressChart {
                        x: 14; y: 142; width: parent.width - 28; height: 150
                        series: root.selectedEntry ? root.selectedEntry.sampleSeries : []
                        accentColor: root.accentColor; rawColor: root.mutedColor; gridColor: root.mutedColor; textColor: root.textColor; fontFamily: root.fontFamily
                        highContrast: root.highContrast; reducedMotion: root.reducedMotion; showRaw: false; title: "selected result · second-by-second pace"
                    }
                }
            }

            Rectangle {
                id: goalPanel
                width: parent.width; height: width < 600 ? 150 : 104; radius: 10; color: root.panelColor
                border.width: root.focusedRegion === 6 || root.focusedRegion === 7 ? 2 : (root.highContrast ? 1 : 0)
                border.color: root.focusedRegion === 6 || root.focusedRegion === 7 ? root.accentColor : root.mutedColor
                Accessible.role: Accessible.Grouping
                Accessible.name: "Daily goal " + root.goal.value + " of " + root.goal.target + " " + root.goal.metric
                Accessible.focusable: true
                Accessible.focused: root.focusedRegion === 6 || root.focusedRegion === 7
                Text { x: 14; y: 12; text: "daily goal"; color: root.textColor; font.family: root.fontFamily; font.pixelSize: 13; font.weight: Font.DemiBold }
                Text { x: 14; y: 40; text: root.goal.value + " / " + root.goal.target + " " + root.goal.metric + (root.goal.complete ? " · complete" : ""); color: root.goal.complete ? root.accentColor : root.textColor; font.family: root.fontFamily; font.pixelSize: 15 }
                Rectangle { x: 14; y: 72; width: parent.width < 600 ? parent.width - 28 : Math.max(1, parent.width - 320); height: 6; radius: 3; color: root.backgroundColor; Rectangle { width: parent.width * root.goal.ratio; height: parent.height; radius: parent.radius; color: root.accentColor; Behavior on width { NumberAnimation { duration: root.reducedMotion ? 0 : 160 } } } }
                Flow {
                    x: parent.width < 600 ? 14 : parent.width - width - 14; y: parent.width < 600 ? 94 : 38; width: parent.width < 600 ? parent.width - 28 : 280; spacing: 8
                    ProgressButton { label: root.goalMetric; selected: root.focusedRegion === 6; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onActivated: root.changeGoalMetric(1) }
                    ProgressButton { label: "target " + root.goalTarget; selected: root.focusedRegion === 7; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onActivated: root.changeGoalTarget(1) }
                }
            }

            Rectangle {
                id: languagePanel
                width: parent.width
                visible: root.scope === "current"
                height: visible ? Math.max(76, languageColumn.height + 30) : 0
                clip: true
                radius: 10; color: root.panelColor; border.width: root.highContrast ? 1 : 0; border.color: root.mutedColor
                Column {
                    id: languageColumn
                    x: 14; y: 12; width: parent.width - 28; spacing: 6
                    Text { text: "same-setup language comparison"; color: root.textColor; font.family: root.fontFamily; font.pixelSize: 13; font.weight: Font.DemiBold }
                    Text { visible: root.languages.length === 0; width: parent.width; text: "No qualified language comparisons for this setup and period."; color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 11; wrapMode: Text.WordWrap }
                    Repeater { model: root.languages.slice(0, 8); delegate: Text { required property var modelData; width: languageColumn.width; text: modelData.language + " · " + modelData.tests + " tests · " + (modelData.averageWpm === null ? "no comparable pace" : Number(modelData.averageWpm).toFixed(1) + " avg wpm · " + Math.round(modelData.maxWpm) + " pb"); color: root.mutedColor; font.family: root.fontFamily; font.pixelSize: 11; wrapMode: Text.WordWrap } }
                }
            }

            Rectangle {
                id: actionsPanel
                width: parent.width; height: actionFlow.height + statusText.height + 26; radius: 9; color: "transparent"
                border.width: root.focusedRegion === 8 ? 2 : (root.highContrast ? 1 : 0)
                border.color: root.focusedRegion === 8 ? root.accentColor : root.mutedColor
                Accessible.role: Accessible.Grouping
                Accessible.name: "History actions"
                Accessible.focusable: true
                Accessible.focused: root.focusedRegion === 8
                Flow {
                    id: actionFlow
                    x: 10; y: 10; width: parent.width - 20; spacing: 10
                    ProgressButton { label: "export CSV"; selected: root.focusedRegion === 8 && root.actionIndex === 0; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.panelColor; fontFamily: root.fontFamily; Accessible.description: "Save retained results to the local OmaType CSV file"; onActivated: { root.resetConfirmations(); root.focusedRegion = 8; root.actionIndex = 0; root.exportRequested() } }
                    ProgressButton { enabled: !!root.selectedEntry; opacity: enabled ? 1 : 0.45; label: root.deleteConfirmId ? "confirm delete selected" : "delete selected"; selected: root.focusedRegion === 8 && root.actionIndex === 1; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.panelColor; fontFamily: root.fontFamily; Accessible.description: "Requires confirmation before deleting the selected retained result"; onActivated: { root.focusedRegion = 8; root.actionIndex = 1; root.requestDelete() } }
                    ProgressButton { label: root.clearConfirm ? "confirm clear history" : "clear history"; selected: root.focusedRegion === 8 && root.actionIndex === 2; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.panelColor; fontFamily: root.fontFamily; Accessible.description: "Requires confirmation before erasing all typing history"; onActivated: { root.focusedRegion = 8; root.actionIndex = 2; root.requestClear() } }
                }
                Text {
                    id: statusText
                    x: 12; y: actionFlow.y + actionFlow.height + 6; width: parent.width - 24
                    text: root.deleteConfirmId ? "Delete armed · activate delete again" : root.statusMessage
                    color: root.deleteConfirmId || root.clearConfirm ? root.textColor : root.mutedColor
                    font.family: root.fontFamily; font.pixelSize: 11; wrapMode: Text.WordWrap
                    Accessible.role: Accessible.StaticText
                    Accessible.name: text
                }
            }

            Item { width: 1; height: 12 }
        }
    }
}

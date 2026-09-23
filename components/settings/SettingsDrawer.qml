import QtQuick

Rectangle {
    id: root

    property var settings: ({test: {}, behavior: {}, appearance: {}, caret: {}, accessibility: {}})
    property color backgroundColor: "#1f1f1f"
    property color panelColor: "#292929"
    property color accentColor: "#e2b714"
    property color textColor: "#eeeeee"
    property color mutedColor: "#888888"
    property string fontFamily: "monospace"
    property var keyboardLayoutOptions: ["engrammer", "qwerty", "custom"]
    property string currentSection: "test"
    readonly property var sections: ["test", "behavior", "display", "caret", "access"]
    signal settingChanged(string category, string key, var value)
    signal categoryReset(string category)
    signal closeRequested()
    property int focusedRowIndex: -1

    Accessible.role: Accessible.Dialog
    Accessible.name: "OmaType settings"

    readonly property var testSettings: settings.test || ({})
    readonly property var behaviorSettings: settings.behavior || ({})
    readonly property var appearanceSettings: settings.appearance || ({})
    readonly property var caretSettings: settings.caret || ({})
    readonly property var accessibilitySettings: settings.accessibility || ({})

    function openSection(index) {
        var bounded = Math.max(0, Math.min(root.sections.length - 1, index))
        root.currentSection = root.sections[bounded]
        Qt.callLater(function() { root.focusFirstRow() })
    }

    function moveSection(delta) {
        var index = root.sections.indexOf(root.currentSection)
        root.openSection(index + delta)
    }

    function scrollBy(delta) {
        var maximum = Math.max(0, scroller.contentHeight - scroller.height)
        scroller.contentY = Math.max(0, Math.min(maximum, scroller.contentY + delta))
    }

    function measuredColumnHeight(column) {
        if (!column || !column.children) return 0
        var total = 0
        for (var i = 0; i < column.children.length; ++i) total += column.children[i].height
        return total + Math.max(0, column.children.length - 1) * column.spacing
    }

    function focusFirstRow() {
        root.focusBoundary(false)
    }

    function focusBoundary(last) {
        var rows = scroller.activeColumn ? scroller.activeColumn.children : []
        if (!rows || rows.length === 0) return
        root.focusedRowIndex = last ? rows.length - 1 : 0
        var row = rows[root.focusedRowIndex]
        if (row && typeof row.forceActiveFocus === "function") row.forceActiveFocus()
        if (last) scroller.contentY = Math.max(0, scroller.contentHeight - scroller.height)
        else scroller.contentY = 0
    }

    function focusRow(delta) {
        var rows = scroller.activeColumn ? scroller.activeColumn.children : []
        if (!rows || rows.length === 0) return
        var start = root.focusedRowIndex
        if (start < 0) start = delta < 0 ? 0 : -1
        root.focusedRowIndex = (start + delta + rows.length) % rows.length
        var row = rows[root.focusedRowIndex]
        if (row && typeof row.forceActiveFocus === "function") row.forceActiveFocus()
        var top = row ? row.y : 0
        var bottom = top + (row ? row.height : 0)
        if (top < scroller.contentY) scroller.contentY = top
        else if (bottom > scroller.contentY + scroller.height) scroller.contentY = bottom - scroller.height
    }

    function activateFocusedRow(delta) {
        var rows = scroller.activeColumn ? scroller.activeColumn.children : []
        if (root.focusedRowIndex < 0 || root.focusedRowIndex >= rows.length) root.focusRow(1)
        rows = scroller.activeColumn ? scroller.activeColumn.children : []
        var row = rows[root.focusedRowIndex]
        if (row && typeof row.selectNext === "function") row.selectNext(delta)
    }

    function resetCurrentSection() {
        var category = root.currentSection === "display" ? "appearance"
            : root.currentSection === "access" ? "accessibility"
            : root.currentSection
        root.categoryReset(category)
    }

    onCurrentSectionChanged: {
        scroller.contentY = 0
        root.focusedRowIndex = -1
        Qt.callLater(function() { root.focusFirstRow() })
    }

    radius: 14
    color: panelColor
    border.width: 1
    border.color: Qt.rgba(mutedColor.r, mutedColor.g, mutedColor.b, 0.35)

    Text {
        x: 28
        y: 20
        text: "settings"
        color: root.textColor
        font.family: root.fontFamily
        font.pixelSize: 24
        font.weight: Font.DemiBold
    }
    Text {
        x: 176
        y: 28
        text: "ctrl+1–5 section   tab/↑/↓ row   ←/→ value   r reset   esc done"
        color: root.mutedColor
        font.family: root.fontFamily
        font.pixelSize: 10
    }
    Text {
        anchors.right: parent.right
        anchors.rightMargin: 28
        y: 27
        text: "esc  done"
        color: root.mutedColor
        font.family: root.fontFamily
        font.pixelSize: 12
        Accessible.role: Accessible.Button
        Accessible.name: "Close settings"
        Accessible.onPressAction: root.closeRequested()
        MouseArea {
            anchors.fill: parent
            anchors.margins: -8
            cursorShape: Qt.PointingHandCursor
            onClicked: root.closeRequested()
        }
    }

    Row {
        id: tabs
        x: 28
        y: 62
        spacing: 20
        Repeater {
            model: ["test", "behavior", "display", "caret", "access"]
            delegate: Text {
                required property string modelData
                text: modelData
                color: root.currentSection === modelData ? root.accentColor : root.mutedColor
                font.family: root.fontFamily
                font.pixelSize: 13
                font.weight: root.currentSection === modelData ? Font.DemiBold : Font.Normal
                Accessible.role: Accessible.Button
                Accessible.name: modelData + " settings section"
                Accessible.selected: root.currentSection === modelData
                Accessible.onPressAction: root.currentSection = modelData
                MouseArea {
                    anchors.fill: parent
                    anchors.margins: -7
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.currentSection = parent.modelData
                }
            }
        }
    }

    Text {
        anchors.right: parent.right
        anchors.rightMargin: 28
        y: 64
        text: "reset section"
        color: root.mutedColor
        font.family: root.fontFamily
        font.pixelSize: 11
        Accessible.role: Accessible.Button
        Accessible.name: "Reset current settings section"
        Accessible.onPressAction: root.resetCurrentSection()
        MouseArea {
            anchors.fill: parent
            anchors.margins: -7
            cursorShape: Qt.PointingHandCursor
            onClicked: root.resetCurrentSection()
        }
    }

    Flickable {
        id: scroller
        x: 28
        y: 100
        width: parent.width - 56
        height: parent.height - 120
        contentWidth: width
        contentHeight: root.measuredColumnHeight(activeColumn)
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        property var activeColumn: root.currentSection === "test" ? testColumn
            : root.currentSection === "behavior" ? behaviorColumn
            : root.currentSection === "display" ? displayColumn
            : root.currentSection === "caret" ? caretColumn
            : accessColumn

        Column {
            id: testColumn
            width: scroller.width
            spacing: 4
            visible: root.currentSection === "test"
            OptionRow { compact: true; label: "mode"; options: ["time", "words"]; value: root.testSettings.mode; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("test", "mode", value) }
            OptionRow { compact: true; label: "time"; detail: "seconds"; options: [15, 30, 60, 120]; value: root.testSettings.time; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("test", "time", value) }
            OptionRow { compact: true; label: "words"; detail: "test length"; options: [10, 25, 50, 100]; value: root.testSettings.words; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("test", "words", value) }
            OptionRow { compact: true; label: "punctuation"; options: [true, false]; value: root.testSettings.punctuation; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("test", "punctuation", value) }
            OptionRow { compact: true; label: "numbers"; options: [true, false]; value: root.testSettings.numbers; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("test", "numbers", value) }
        }

        Column {
            id: behaviorColumn
            width: scroller.width
            spacing: 4
            visible: root.currentSection === "behavior"
            OptionRow { compact: true; label: "quick restart"; options: ["off", "escape", "tab", "enter"]; value: root.behaviorSettings.quickRestart; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("behavior", "quickRestart", value) }
            OptionRow { compact: true; label: "stop on error"; detail: "hold position after a wrong key"; options: ["off", "letter"]; value: root.behaviorSettings.stopOnError; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("behavior", "stopOnError", value) }
            OptionRow { compact: true; label: "strict space"; detail: "ignore early spaces"; options: [true, false]; value: root.behaviorSettings.strictSpace; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("behavior", "strictSpace", value) }
            OptionRow { compact: true; label: "backspace"; options: ["full", "off"]; value: root.behaviorSettings.backspace; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("behavior", "backspace", value) }
            OptionRow { compact: true; label: "quick end"; detail: "enter ends a running test"; options: [true, false]; value: root.behaviorSettings.quickEnd; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("behavior", "quickEnd", value) }
        }

        Column {
            id: displayColumn
            property bool compactRows: true
            width: scroller.width
            spacing: 2
            visible: root.currentSection === "display"
            OptionRow { compact: true; label: "timer"; options: ["text", "mini", "bar", "off"]; value: root.appearanceSettings.timerStyle; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "timerStyle", value) }
            OptionRow { compact: true; label: "live wpm"; options: [true, false]; value: root.appearanceSettings.liveWpm; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "liveWpm", value) }
            OptionRow { compact: true; label: "live accuracy"; options: [true, false]; value: root.appearanceSettings.liveAccuracy; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "liveAccuracy", value) }
            OptionRow { compact: true; label: "highlight"; options: ["letter", "word", "next-word", "off"]; value: root.appearanceSettings.highlight; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "highlight", value) }
            OptionRow { compact: true; label: "typed text"; options: ["keep", "fade", "hide"]; value: root.appearanceSettings.typedEffect; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "typedEffect", value) }
            OptionRow { compact: true; label: "smooth scroll"; options: [true, false]; value: root.appearanceSettings.smoothScroll; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "smoothScroll", value) }
            OptionRow { compact: true; label: "lines"; options: [1, 2, 3, 4, 5, 6]; value: root.appearanceSettings.lineCount; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "lineCount", value) }
            OptionRow { compact: true; label: "font size"; options: [24, 28, 32, 36, 40, 48]; value: root.appearanceSettings.fontSize; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "fontSize", value) }
            OptionRow { compact: true; label: "line width"; options: [720, 960, 1120, 1280, 1440]; value: root.appearanceSettings.maxLineWidth; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "maxLineWidth", value) }
            OptionRow { compact: true; label: "line height"; options: [38, 44, 50, 56, 64]; value: root.appearanceSettings.lineHeight; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "lineHeight", value) }
            OptionRow { compact: true; label: "word spacing"; options: [12, 16, 21, 28, 36]; value: root.appearanceSettings.wordSpacing; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "wordSpacing", value) }
            OptionRow { compact: true; label: "focus header"; options: ["hide", "show"]; value: root.appearanceSettings.focusHideHeader ? "hide" : "show"; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "focusHideHeader", value === "hide") }
            OptionRow { compact: true; label: "focus setup"; options: ["hide", "show"]; value: root.appearanceSettings.focusHideSetup ? "hide" : "show"; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "focusHideSetup", value === "hide") }
            OptionRow { compact: true; label: "focus footer"; options: ["hide", "show"]; value: root.appearanceSettings.focusHideFooter ? "hide" : "show"; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "focusHideFooter", value === "hide") }
            OptionRow { compact: true; label: "keyboard guide"; detail: "ctrl+k toggles while typing"; options: ["show", "hide"]; value: root.appearanceSettings.keyboardGuide ? "show" : "hide"; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "keyboardGuide", value === "show") }
            OptionRow { compact: true; label: "keyboard layout"; detail: "custom reads ~/.config/omarchy/omatype-keyboard.json"; options: root.keyboardLayoutOptions; value: root.appearanceSettings.keyboardLayout; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("appearance", "keyboardLayout", value) }
        }

        Column {
            id: caretColumn
            width: scroller.width
            spacing: 4
            visible: root.currentSection === "caret"
            OptionRow { compact: true; label: "caret style"; options: ["default", "block", "outline", "underline", "off"]; value: root.caretSettings.style; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("caret", "style", value) }
            OptionRow { compact: true; label: "caret motion"; options: ["off", "slow", "medium", "fast"]; value: root.caretSettings.smooth; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("caret", "smooth", value) }
            OptionRow { compact: true; label: "caret color"; options: ["accent", "foreground", "error", "custom"]; value: root.caretSettings.color; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("caret", "color", value) }
            OptionRow { compact: true; label: "blink"; options: [true, false]; value: root.caretSettings.blink; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("caret", "blink", value) }
            OptionRow { compact: true; label: "blink speed"; detail: "milliseconds"; options: [400, 600, 800, 1200, 1600]; value: root.caretSettings.blinkMs; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("caret", "blinkMs", value) }
            OptionRow { compact: true; label: "custom caret color"; options: ["#e2b714", "#62b4ff", "#ff6b6b", "#c792ea"]; value: root.caretSettings.customColor; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("caret", "customColor", value) }
            OptionRow { compact: true; label: "thickness"; options: [1, 2, 3, 4, 6, 8]; value: root.caretSettings.thickness; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("caret", "thickness", value) }
        }

        Column {
            id: accessColumn
            width: scroller.width
            spacing: 4
            visible: root.currentSection === "access"
            OptionRow { compact: true; label: "reduced motion"; options: [true, false]; value: root.accessibilitySettings.reducedMotion; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("accessibility", "reducedMotion", value) }
            OptionRow { compact: true; label: "high contrast"; options: [true, false]; value: root.accessibilitySettings.highContrast; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("accessibility", "highContrast", value) }
            OptionRow { compact: true; label: "error indicator"; options: ["color", "underline", "both"]; value: root.accessibilitySettings.errorStyle; accentColor: root.accentColor; textColor: root.textColor; mutedColor: root.mutedColor; fillColor: root.backgroundColor; fontFamily: root.fontFamily; onSelected: value => root.settingChanged("accessibility", "errorStyle", value) }
        }
    }

    Rectangle {
        anchors.right: parent.right
        anchors.rightMargin: 10
        y: scroller.y + scroller.visibleArea.yPosition * scroller.height
        width: 3
        height: Math.max(28, scroller.visibleArea.heightRatio * scroller.height)
        radius: 2
        visible: scroller.contentHeight > scroller.height
        color: root.accentColor
        opacity: 0.6
    }
}

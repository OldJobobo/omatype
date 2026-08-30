import QtQuick

Item {
    id: root

    property var days: []
    property color accentColor: "#e2b714"
    property color emptyColor: "#333333"
    property color textColor: "#eeeeee"
    property color mutedColor: "#888888"
    property string fontFamily: "monospace"
    property bool highContrast: false
    readonly property int totalTests: (root.days || []).reduce(function(sum, day) { return sum + Number(day.tests || 0) }, 0)
    readonly property int activeDays: (root.days || []).filter(function(day) { return Number(day.tests || 0) > 0 }).length
    property string hoveredDay: ""
    property int hoveredTests: 0
    readonly property int columns: Math.max(1, Math.floor(width / 18))
    readonly property string startDay: root.days && root.days.length ? String(root.days[0].day) : ""
    readonly property string endDay: root.days && root.days.length ? String(root.days[root.days.length - 1].day) : ""
    readonly property string dateRange: root.startDay && root.endDay ? root.startDay + " → " + root.endDay : "no dated activity"
    readonly property string semanticSummary: "90 day activity, " + root.dateRange + ": " + root.totalTests + " tests across " + root.activeDays + " active days"
    implicitHeight: 26 + cells.implicitHeight + 8 + dateLine.implicitHeight + 4 + contextLine.implicitHeight

    Accessible.role: Accessible.Graphic
    Accessible.name: root.semanticSummary
    Accessible.description: "Each activity cell announces its exact day and test count"

    Text {
        id: heading
        text: "90 day activity"
        color: root.textColor
        font.family: root.fontFamily
        font.pixelSize: 13
        font.weight: Font.DemiBold
    }

    Flow {
        id: cells
        x: 0
        y: 26
        width: parent.width
        spacing: 4
        Repeater {
            model: root.days || []
            delegate: Rectangle {
                required property var modelData
                width: 12
                height: 12
                radius: 2
                color: Number(modelData.tests || 0) > 0
                    ? Qt.rgba(root.accentColor.r, root.accentColor.g, root.accentColor.b,
                        Math.min(1, 0.28 + Number(modelData.tests || 0) * 0.16))
                    : root.emptyColor
                border.width: root.highContrast && Number(modelData.tests || 0) > 0 ? 1 : 0
                border.color: root.textColor
                Accessible.role: Accessible.StaticText
                Accessible.name: modelData.day + ": " + Number(modelData.tests || 0) + (Number(modelData.tests || 0) === 1 ? " test" : " tests")
                MouseArea {
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onContainsMouseChanged: {
                        if (containsMouse) {
                            root.hoveredDay = String(parent.modelData.day)
                            root.hoveredTests = Number(parent.modelData.tests || 0)
                        } else if (root.hoveredDay === String(parent.modelData.day)) {
                            root.hoveredDay = ""
                            root.hoveredTests = 0
                        }
                    }
                }
            }
        }
    }

    Text {
        id: dateLine
        x: 0
        y: cells.y + cells.implicitHeight + 8
        width: parent.width
        text: root.dateRange
        color: root.mutedColor
        font.family: root.fontFamily
        font.pixelSize: 10
        elide: Text.ElideRight
        Accessible.role: Accessible.StaticText
        Accessible.name: "Activity date range: " + text
    }

    Text {
        id: contextLine
        x: 0
        y: dateLine.y + dateLine.implicitHeight + 4
        width: parent.width
        text: root.hoveredDay
            ? root.hoveredDay + " · " + root.hoveredTests + (root.hoveredTests === 1 ? " test" : " tests")
            : root.totalTests + " tests across " + root.activeDays + " active days · hover a day for details"
        color: root.hoveredDay ? root.textColor : root.mutedColor
        font.family: root.fontFamily
        font.pixelSize: 10
        elide: Text.ElideRight
        Accessible.role: Accessible.StaticText
        Accessible.name: text
    }
}

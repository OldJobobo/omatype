import QtQuick

Item {
    id: root

    property string label: ""
    property string detail: ""
    property var options: []
    property var value: null
    property color accentColor: "white"
    property color textColor: "white"
    property color mutedColor: "#888888"
    property color fillColor: "#222222"
    property string fontFamily: "monospace"
    property bool compact: parent && typeof parent.compactRows !== "undefined" && parent.compactRows
    property bool narrowLayout: width < 620
    signal selected(var value)

    activeFocusOnTab: true
    Accessible.role: Accessible.ListItem
    Accessible.name: root.label
    Accessible.description: root.detail + (root.detail.length > 0 ? "; " : "") + "current value " + String(root.value)

    function ensureOptionVisible(index) {
        if (!root.narrowLayout) {
            choiceViewport.contentX = 0
            return
        }
        var item = optionRepeater.itemAt(index)
        if (!item) return
        var maximum = Math.max(0, choiceViewport.contentWidth - choiceViewport.width)
        if (item.x < choiceViewport.contentX) choiceViewport.contentX = Math.max(0, item.x)
        else if (item.x + item.width > choiceViewport.contentX + choiceViewport.width)
            choiceViewport.contentX = Math.min(maximum, item.x + item.width - choiceViewport.width)
    }

    function selectNext(delta) {
        if (!root.options || root.options.length === 0) return
        var current = root.options.indexOf(root.value)
        if (current < 0) current = 0
        var next = (current + delta + root.options.length) % root.options.length
        root.selected(root.options[next])
        Qt.callLater(function() { root.ensureOptionVisible(next) })
    }

    onValueChanged: Qt.callLater(function() { root.ensureOptionVisible(root.options.indexOf(root.value)) })
    onWidthChanged: Qt.callLater(function() { root.ensureOptionVisible(root.options.indexOf(root.value)) })

    Keys.onPressed: function(event) {
        if (event.modifiers & Qt.ControlModifier) return
        if (event.key === Qt.Key_Left) root.selectNext(-1)
        else if (event.key === Qt.Key_Right || event.key === Qt.Key_Space || event.key === Qt.Key_Enter || event.key === Qt.Key_Return) root.selectNext(1)
        else return
        event.accepted = true
    }

    width: parent ? parent.width : 800
    implicitHeight: narrowLayout ? 68 : (compact ? 36 : Math.max(52, choiceRow.implicitHeight + 18))
    height: implicitHeight

    Column {
        id: labelColumn
        anchors.left: parent.left
        anchors.top: root.narrowLayout ? parent.top : undefined
        anchors.topMargin: root.narrowLayout ? 3 : 0
        anchors.verticalCenter: root.narrowLayout ? undefined : parent.verticalCenter
        width: root.narrowLayout ? parent.width : Math.max(180, parent.width * 0.31)
        spacing: 2
        Text {
            text: root.label
            color: root.activeFocus ? root.accentColor : root.textColor
            font.family: root.fontFamily
            font.pixelSize: 14
            font.weight: Font.DemiBold
        }
        Text {
            visible: root.detail.length > 0
            text: root.detail
            color: root.mutedColor
            font.family: root.fontFamily
            font.pixelSize: 10
        }
    }

    Flickable {
        id: choiceViewport
        anchors.right: parent.right
        anchors.top: root.narrowLayout ? labelColumn.bottom : undefined
        anchors.topMargin: root.narrowLayout ? 4 : 0
        anchors.verticalCenter: root.narrowLayout ? undefined : parent.verticalCenter
        width: root.narrowLayout ? parent.width : choiceRow.implicitWidth
        height: 30
        contentWidth: choiceRow.implicitWidth
        contentHeight: height
        interactive: root.narrowLayout && contentWidth > width
        clip: root.narrowLayout
        boundsBehavior: Flickable.StopAtBounds

        Row {
            id: choiceRow
            spacing: 7
            Repeater {
                id: optionRepeater
                model: root.options
            delegate: Rectangle {
                required property var modelData
                readonly property string optionLabel: typeof modelData === "boolean" ? (modelData ? "on" : "off") : String(modelData)
                width: optionText.implicitWidth + 20
                height: 30
                radius: 6
                color: root.value === modelData
                    ? Qt.rgba(root.accentColor.r, root.accentColor.g, root.accentColor.b, 0.18)
                    : root.fillColor
                border.width: root.value === modelData ? 1 : 0
                border.color: root.accentColor
                Accessible.role: Accessible.RadioButton
                Accessible.name: root.label + " " + optionLabel
                Accessible.checked: root.value === modelData
                Accessible.onPressAction: root.selected(modelData)
                Text {
                    id: optionText
                    anchors.centerIn: parent
                    text: parent.optionLabel
                    color: root.value === parent.modelData ? root.accentColor : root.mutedColor
                    font.family: root.fontFamily
                    font.pixelSize: 12
                    font.weight: root.value === parent.modelData ? Font.DemiBold : Font.Normal
                }
                MouseArea {
                    anchors.fill: parent
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.selected(parent.modelData)
                }
            }
        }
    }
}
}

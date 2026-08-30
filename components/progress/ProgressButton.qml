import QtQuick

Rectangle {
    id: root

    property string label: ""
    property bool selected: false
    property color accentColor: "white"
    property color textColor: "white"
    property color mutedColor: "#888888"
    property color fillColor: "#222222"
    property string fontFamily: "monospace"
    signal activated()

    implicitWidth: buttonText.implicitWidth + 26
    implicitHeight: 40
    radius: 6
    color: selected ? Qt.rgba(accentColor.r, accentColor.g, accentColor.b, 0.17) : fillColor
    border.width: selected || activeFocus ? 1 : 0
    border.color: activeFocus ? textColor : accentColor
    activeFocusOnTab: true
    Accessible.role: Accessible.Button
    Accessible.name: label
    Accessible.focusable: true
    Accessible.focused: activeFocus
    Accessible.selected: selected
    Accessible.onPressAction: root.activated()

    Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Enter || event.key === Qt.Key_Return || event.key === Qt.Key_Space) {
            root.activated()
            event.accepted = true
        }
    }

    Text {
        id: buttonText
        anchors.centerIn: parent
        text: root.label
        color: root.selected ? root.accentColor : root.mutedColor
        font.family: root.fontFamily
        font.pixelSize: 11
        font.weight: root.selected ? Font.DemiBold : Font.Normal
    }

    MouseArea {
        anchors.fill: parent
        cursorShape: Qt.PointingHandCursor
        onClicked: root.activated()
    }
}

import QtQuick

Rectangle {
    id: root

    property var layout: null
    property int layerIndex: 0
    property string nextCharacter: ""
    property color backgroundColor: "#1f1f1f"
    property color accentColor: "#e2b714"
    property color layerAccentColor: "#e06c75"
    property color textColor: "#eeeeee"
    property color mutedColor: "#888888"
    property string fontFamily: "monospace"
    signal layerSelected(int index)

    readonly property var layers: root.layout && root.layout.layers ? root.layout.layers : []
    readonly property var activeLayer: root.layers.length > 0 ? root.layers[Math.max(0, Math.min(root.layers.length - 1, root.layerIndex))] : null
    readonly property var neededModifiers: root.characterModifiers()
    readonly property bool needsShift: neededModifiers.shift
    readonly property bool needsAltGr: neededModifiers.altGr

    function isLayerThumb(keyIndex) {
        var keys = root.activeLayer && root.activeLayer.layerThumbKeys ? root.activeLayer.layerThumbKeys : []
        return keys.indexOf(keyIndex) >= 0
    }

    function characterModifiers() {
        var result = {shift: false, altGr: false}
        if (!root.activeLayer || root.nextCharacter === "") return result
        if (/^[A-Z]$/.test(root.nextCharacter)) result.shift = true
        var keys = root.activeLayer.keys || []
        for (var index = 0; index < keys.length; index++) {
            if (keys[index].shift === root.nextCharacter) result.shift = true
            if (keys[index].altGr === root.nextCharacter) result.altGr = true
            if (keys[index].shiftAltGr === root.nextCharacter) { result.shift = true; result.altGr = true }
        }
        var rows = root.activeLayer.rows || []
        for (var row = 0; row < rows.length; row++)
            for (var column = 0; column < rows[row].length; column++) {
                if (rows[row][column].shift === root.nextCharacter) result.shift = true
                if (rows[row][column].altGr === root.nextCharacter) result.altGr = true
                if (rows[row][column].shiftAltGr === root.nextCharacter) { result.shift = true; result.altGr = true }
            }
        return result
    }

    function legend(key) {
        var altGr = key.altGr || ""
        var shiftAltGr = key.shiftAltGr || ""
        if (altGr || shiftAltGr) return (key.shift || "") + "  " + shiftAltGr + "\n" + key.label + "  " + altGr
        return key.shift ? key.shift + "\n" + key.label : key.label
    }

    color: "transparent"
    border.width: 0
    clip: false
    Accessible.role: Accessible.Grouping
    Accessible.name: (layout ? layout.name : "Keyboard") + " keyboard guide"

    Row {
        id: layerTabs
        anchors.top: parent.top
        anchors.topMargin: 10
        anchors.horizontalCenter: parent.horizontalCenter
        spacing: 14
        Repeater {
            model: root.layers
            delegate: Text {
                id: layerTab
                required property int index
                required property var modelData
                text: modelData.name
                color: root.layerIndex === index ? root.accentColor : root.mutedColor
                font.family: root.fontFamily
                font.pixelSize: 12
                font.weight: root.layerIndex === index ? Font.DemiBold : Font.Normal
                Accessible.role: Accessible.Button
                Accessible.name: "Show " + modelData.name + " keyboard layer"
                Accessible.selected: root.layerIndex === index
                Accessible.onPressAction: root.layerSelected(index)
                MouseArea {
                    anchors.fill: parent
                    anchors.margins: -6
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.layerSelected(layerTab.index)
                }
            }
        }
    }

    Item {
        id: diagram
        anchors.top: layerTabs.bottom
        anchors.topMargin: 8
        anchors.bottom: parent.bottom
        anchors.bottomMargin: 8
        anchors.left: parent.left
        anchors.leftMargin: 10
        anchors.right: parent.right
        anchors.rightMargin: 10

        readonly property bool positioned: !!(root.activeLayer && root.activeLayer.keys)
        readonly property real gridWidth: root.activeLayer && root.activeLayer.bounds ? root.activeLayer.bounds.width : 1
        readonly property real gridHeight: root.activeLayer && root.activeLayer.bounds ? root.activeLayer.bounds.height : 1
        readonly property real unit: Math.min(width / gridWidth, height / gridHeight)
        readonly property real drawingWidth: unit * gridWidth
        readonly property real drawingHeight: unit * gridHeight

        Repeater {
            model: diagram.positioned ? root.activeLayer.keys : []
            delegate: Rectangle {
                required property int index
                required property var modelData
                readonly property bool layerThumb: root.isLayerThumb(index)
                readonly property bool modifierHighlight: (root.needsShift && (
                    modelData.label.toLowerCase() === "shift" || modelData.shift.toLowerCase() === "shift"))
                    || (root.needsAltGr && modelData.label.toLowerCase() === "altgr")
                readonly property bool highlighted: modelData.label !== "" && root.nextCharacter !== "" && (
                    modelData.label.toLowerCase() === root.nextCharacter.toLowerCase()
                    || modelData.shift === root.nextCharacter
                    || modelData.altGr === root.nextCharacter
                    || modelData.shiftAltGr === root.nextCharacter
                    || (modelData.label === "Space" && root.nextCharacter === " "))
                x: (diagram.width - diagram.drawingWidth) / 2 + modelData.x * diagram.unit
                y: (diagram.height - diagram.drawingHeight) / 2 + modelData.y * diagram.unit
                width: modelData.width * diagram.unit
                height: modelData.height * diagram.unit
                visible: modelData.label !== ""
                radius: Math.max(3, diagram.unit * 0.08)
                color: highlighted || modifierHighlight ? Qt.rgba(root.accentColor.r, root.accentColor.g, root.accentColor.b, 0.24)
                    : layerThumb ? Qt.rgba(root.layerAccentColor.r, root.layerAccentColor.g, root.layerAccentColor.b, 0.18) : root.backgroundColor
                border.width: highlighted || modifierHighlight || layerThumb ? 2 : 1
                border.color: layerThumb ? root.layerAccentColor
                    : highlighted || modifierHighlight ? root.accentColor : Qt.rgba(root.mutedColor.r, root.mutedColor.g, root.mutedColor.b, 0.45)
                Text {
                    anchors.fill: parent
                    anchors.margins: 2
                    text: root.legend(parent.modelData)
                    horizontalAlignment: Text.AlignHCenter
                    verticalAlignment: Text.AlignVCenter
                    wrapMode: Text.Wrap
                    maximumLineCount: 3
                    elide: Text.ElideRight
                    color: parent.highlighted || parent.modifierHighlight ? root.accentColor
                        : parent.layerThumb ? root.layerAccentColor : root.textColor
                    font.family: root.fontFamily
                    font.pixelSize: Math.max(7, Math.min(12, parent.height * 0.25))
                }
            }
        }

        Column {
            anchors.fill: parent
            spacing: 5
            visible: !diagram.positioned && !!(root.activeLayer && root.activeLayer.rows)
            Repeater {
                model: root.activeLayer && root.activeLayer.rows ? root.activeLayer.rows : []
                delegate: Row {
                    required property int index
                    required property var modelData
                    anchors.horizontalCenter: parent.horizontalCenter
                    spacing: 5
                    Repeater {
                        model: parent.modelData
                        delegate: Rectangle {
                            required property var modelData
                            readonly property bool modifierHighlight: (root.needsShift && (
                                modelData.label.toLowerCase() === "shift" || modelData.shift.toLowerCase() === "shift"))
                                || (root.needsAltGr && modelData.label.toLowerCase() === "altgr")
                            readonly property bool highlighted: root.nextCharacter !== "" && (
                                modelData.label.toLowerCase() === root.nextCharacter.toLowerCase()
                                || modelData.shift === root.nextCharacter
                                || modelData.altGr === root.nextCharacter
                                || modelData.shiftAltGr === root.nextCharacter
                                || (modelData.label === "Space" && root.nextCharacter === " "))
                            width: Math.max(34, 43 * modelData.width)
                            height: Math.max(28, (diagram.height - 20) / Math.max(1, root.activeLayer.rows.length) - 5)
                            radius: 5
                            color: highlighted || modifierHighlight ? Qt.rgba(root.accentColor.r, root.accentColor.g, root.accentColor.b, 0.24) : root.backgroundColor
                            border.width: highlighted || modifierHighlight ? 2 : 1
                            border.color: highlighted || modifierHighlight ? root.accentColor : Qt.rgba(root.mutedColor.r, root.mutedColor.g, root.mutedColor.b, 0.45)
                            Text {
                                anchors.centerIn: parent
                                text: root.legend(parent.modelData)
                                horizontalAlignment: Text.AlignHCenter
                                color: parent.highlighted || parent.modifierHighlight ? root.accentColor : root.textColor
                                font.family: root.fontFamily
                                font.pixelSize: Math.min(13, parent.height * 0.33)
                            }
                        }
                    }
                }
            }
        }
    }
}

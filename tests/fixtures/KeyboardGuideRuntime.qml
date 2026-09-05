import QtQuick
import Quickshell
import "src/keyboard-layouts.js" as KeyboardLayouts
import "components/keyboard" as KeyboardUi

ShellRoot {
    id: root

    // Normalized through the real parser: a positioned layer with a shared
    // main/numpad label and a blank key, plus a rows layer, exercise both
    // layout formats without a keyboard file on disk.
    property var layout: KeyboardLayouts.normalize({
        schemaVersion: 1,
        name: "Harness",
        layers: [
            {
                id: "base",
                name: "Base",
                bounds: {width: 4, height: 2},
                layerThumbKeys: [2],
                keys: [
                    {label: "A", x: 0, y: 0, width: 1, height: 1},
                    {label: "/", x: 1, y: 0, width: 1, height: 1},
                    {label: "/", x: 2, y: 0, width: 1, height: 1, numpad: true},
                    {label: "", x: 3, y: 0, width: 1, height: 1}
                ]
            },
            {
                id: "nav",
                name: "Nav",
                rows: [["Home", "End"]]
            }
        ]
    })

    FloatingWindow {
        visible: true
        implicitWidth: 640
        implicitHeight: 320
        color: "#1f1f1f"

        KeyboardUi.KeyboardGuide {
            id: guide
            anchors.fill: parent
            layout: root.layout
            nextCharacter: "/"
        }

        Timer {
            interval: 200
            running: true
            onTriggered: {
                if (guide.layers.length !== 2 || guide.activeLayer.name !== "Base") {
                    console.error("GUIDE_HARNESS_FAILURE: layers")
                    Qt.quit()
                    return
                }
                if (guide.characterKeyIndex !== 1 || !guide.keyMatchesCharacter(guide.activeLayer.keys[1])) {
                    console.error("GUIDE_HARNESS_FAILURE: numpad disambiguation " + guide.characterKeyIndex)
                    Qt.quit()
                    return
                }
                if (guide.isLayerThumb(2) !== true || guide.isLayerThumb(1) !== false) {
                    console.error("GUIDE_HARNESS_FAILURE: thumb highlighting")
                    Qt.quit()
                    return
                }
                guide.layerIndex = 1
                if (guide.activeLayer.name !== "Nav" || !guide.activeLayer.rows) {
                    console.error("GUIDE_HARNESS_FAILURE: rows fallback")
                    Qt.quit()
                    return
                }
                console.log("GUIDE_HARNESS_OK: positioned keys, numpad disambiguation, rows fallback, layer tabs, and thumb highlighting")
                Qt.quit()
            }
        }
    }
}

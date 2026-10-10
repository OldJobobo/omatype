import QtQuick
import Quickshell

ShellRoot {
    FloatingWindow {
        visible: true
        implicitWidth: 200
        implicitHeight: 100

        FontMetrics {
            id: metrics
            font.family: "sans-serif"
            font.pixelSize: 32
            font.weight: Font.Medium
            font.kerning: false
        }

        Text {
            text: "Wi"
            font: metrics.font
            renderType: Text.NativeRendering
        }

        Timer {
            interval: 150
            running: true
            onTriggered: {
                if (metrics.advanceWidth("W") > metrics.advanceWidth("i")) console.log("FONT_HARNESS_OK")
                else console.error("FONT_HARNESS_FAILURE")
                Qt.quit()
            }
        }
    }
}

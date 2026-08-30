import QtQuick

Item {
    id: root

    property var series: []
    property color accentColor: "#e2b714"
    property color rawColor: "#888888"
    property color gridColor: "#555555"
    property color textColor: "#eeeeee"
    property string fontFamily: "monospace"
    property string title: "pace over time"
    property bool highContrast: false
    property bool reducedMotion: false
    property bool showRaw: true
    readonly property var validSeries: (Array.isArray(root.series) ? root.series : []).filter(function(point) {
        return point && point.wpm !== null && point.wpm !== undefined && Number.isFinite(Number(point.wpm))
    })
    readonly property string semanticSummary: {
        if (root.validSeries.length === 0) return root.title + ": no comparable results yet"
        var first = Number(root.validSeries[0].wpm)
        var last = Number(root.validSeries[root.validSeries.length - 1].wpm)
        var direction = last > first ? "increased" : last < first ? "decreased" : "held steady"
        return root.title + ": " + root.validSeries.length + " points; net speed " + direction
            + " from " + Math.round(first) + " to " + Math.round(last) + " words per minute"
    }

    Accessible.role: Accessible.Graphic
    Accessible.name: root.semanticSummary

    onSeriesChanged: chart.requestPaint()
    onValidSeriesChanged: chart.requestPaint()
    onWidthChanged: chart.requestPaint()
    onHeightChanged: chart.requestPaint()
    onHighContrastChanged: chart.requestPaint()

    Text {
        id: heading
        text: root.title
        color: root.textColor
        font.family: root.fontFamily
        font.pixelSize: 13
        font.weight: Font.DemiBold
    }

    Item {
        id: legend
        x: 0
        y: 23
        width: Math.min(parent.width, 190)
        height: 18
        visible: root.showRaw && root.validSeries.length > 0
        Accessible.role: Accessible.StaticText
        Accessible.name: "Solid line: net words per minute. Dashed line: raw words per minute."
        Rectangle { x: 0; y: 8; width: 20; height: root.highContrast ? 3 : 2; color: root.accentColor }
        Text { x: 26; y: 0; text: "net"; color: root.textColor; font.family: root.fontFamily; font.pixelSize: 10 }
        Row {
            x: 62; y: 8; spacing: 3
            Repeater { model: 3; delegate: Rectangle { width: 5; height: root.highContrast ? 3 : 2; color: root.rawColor } }
        }
        Text { x: 91; y: 0; text: "raw"; color: root.textColor; font.family: root.fontFamily; font.pixelSize: 10 }
    }

    Canvas {
        id: chart
        x: 0
        y: legend.visible ? 43 : 24
        width: parent.width
        height: Math.max(70, parent.height - y - 28)
        renderTarget: Canvas.Image
        onPaint: {
            var ctx = getContext("2d")
            ctx.clearRect(0, 0, width, height)
            var points = root.validSeries
            var left = 34
            var right = 8
            var top = 7
            var bottom = 20
            var plotWidth = Math.max(1, width - left - right)
            var plotHeight = Math.max(1, height - top - bottom)

            function finiteValue(point, key) {
                if (!point || point[key] === null || point[key] === undefined) return null
                var value = Number(point[key])
                return Number.isFinite(value) ? value : null
            }

            var maximum = 10
            for (var index = 0; index < points.length; ++index) {
                maximum = Math.max(maximum, finiteValue(points[index], "wpm") || 0)
                var raw = finiteValue(points[index], "rawWpm")
                if (root.showRaw && raw !== null) maximum = Math.max(maximum, raw)
            }
            maximum = Math.ceil(maximum / 10) * 10

            ctx.strokeStyle = root.gridColor
            ctx.fillStyle = root.textColor
            ctx.font = "9px " + root.fontFamily
            ctx.globalAlpha = root.highContrast ? 0.75 : 0.34
            for (var grid = 0; grid <= 2; ++grid) {
                var ratio = grid / 2
                var gridY = top + ratio * plotHeight
                ctx.beginPath(); ctx.moveTo(left, gridY); ctx.lineTo(left + plotWidth, gridY); ctx.stroke()
            }
            ctx.globalAlpha = 0.78
            ctx.fillText(String(maximum), 2, top + 8)
            ctx.fillText(String(Math.round(maximum / 2)), 2, top + plotHeight / 2 + 3)
            ctx.fillText("0", 18, top + plotHeight)
            ctx.globalAlpha = 1
            if (points.length === 0) return

            var axisValues = []
            var chronological = true
            for (var axisIndex = 0; axisIndex < points.length; ++axisIndex) {
                var axisValue = points[axisIndex].day ? Date.parse(points[axisIndex].day + "T00:00:00.000Z") : Number(points[axisIndex].second)
                if (!Number.isFinite(axisValue)) chronological = false
                axisValues.push(axisValue)
            }
            var axisMinimum = chronological ? Math.min.apply(null, axisValues) : 0
            var axisMaximum = chronological ? Math.max.apply(null, axisValues) : Math.max(1, points.length - 1)
            function pointX(pointIndex) {
                if (points.length === 1 || axisMaximum === axisMinimum) return left + plotWidth / 2
                var value = chronological ? axisValues[pointIndex] : pointIndex
                return left + (value - axisMinimum) / (axisMaximum - axisMinimum) * plotWidth
            }
            function pointY(value) {
                return top + plotHeight - value / maximum * plotHeight
            }

            var allRaw = root.showRaw
            for (var rawIndex = 0; rawIndex < points.length; ++rawIndex) {
                if (finiteValue(points[rawIndex], "rawWpm") === null) { allRaw = false; break }
            }
            if (allRaw && !root.highContrast) {
                ctx.fillStyle = root.accentColor
                ctx.globalAlpha = 0.12
                ctx.beginPath()
                for (var bandNet = 0; bandNet < points.length; ++bandNet) {
                    var netX = pointX(bandNet)
                    var netY = pointY(finiteValue(points[bandNet], "wpm"))
                    if (bandNet === 0) ctx.moveTo(netX, netY); else ctx.lineTo(netX, netY)
                }
                for (var bandRaw = points.length - 1; bandRaw >= 0; --bandRaw)
                    ctx.lineTo(pointX(bandRaw), pointY(finiteValue(points[bandRaw], "rawWpm")))
                ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1
            }

            function draw(key, color, dashed) {
                ctx.strokeStyle = color
                ctx.fillStyle = color
                ctx.lineWidth = root.highContrast ? 3 : 2
                ctx.setLineDash(dashed ? [7, 5] : [])
                ctx.beginPath()
                var drawing = false
                for (var pointIndex = 0; pointIndex < points.length; ++pointIndex) {
                    var value = finiteValue(points[pointIndex], key)
                    if (value === null) { drawing = false; continue }
                    var x = pointX(pointIndex)
                    var y = pointY(value)
                    if (!drawing) { ctx.moveTo(x, y); drawing = true } else ctx.lineTo(x, y)
                }
                ctx.stroke()
                ctx.setLineDash([])
                for (var markerIndex = 0; markerIndex < points.length; ++markerIndex) {
                    var markerValue = finiteValue(points[markerIndex], key)
                    if (markerValue === null) continue
                    ctx.beginPath(); ctx.arc(pointX(markerIndex), pointY(markerValue), points.length === 1 ? 4 : 2.25, 0, Math.PI * 2); ctx.fill()
                }
            }
            if (root.showRaw) draw("rawWpm", root.rawColor, true)
            draw("wpm", root.accentColor, false)

            function axisLabel(point) {
                if (point.day) return String(point.day).slice(5)
                if (point.second !== undefined) return String(point.second) + "s"
                return ""
            }
            ctx.fillStyle = root.textColor
            ctx.globalAlpha = 0.72
            ctx.font = "9px " + root.fontFamily
            var firstLabel = axisLabel(points[0])
            var lastLabel = axisLabel(points[points.length - 1])
            ctx.fillText(firstLabel, left, height - 4)
            var lastWidth = ctx.measureText(lastLabel).width
            ctx.fillText(lastLabel, left + plotWidth - lastWidth, height - 4)
            ctx.globalAlpha = 1
        }
    }

    Text {
        anchors.left: parent.left
        anchors.bottom: parent.bottom
        width: parent.width
        text: root.semanticSummary
        color: root.rawColor
        font.family: root.fontFamily
        font.pixelSize: 10
        elide: Text.ElideRight
    }
}

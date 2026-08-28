"use strict";

function finitePositive(value, fallback) {
    var number = Number(value)
    return Number.isFinite(number) && number > 0 ? number : fallback
}

function centeredWords(words, viewportWidth, characterWidth, spacing, lineHeight) {
    if (!Array.isArray(words) || words.length === 0) return []

    var viewport = finitePositive(viewportWidth, 1)
    var glyph = finitePositive(characterWidth, 1)
    var gap = Math.max(0, Number.isFinite(Number(spacing)) ? Number(spacing) : 0)
    var line = finitePositive(lineHeight, 44)
    var output = []
    var pending = []
    var pendingWidth = 0
    var row = 0

    function flush() {
        if (pending.length === 0) return
        var x = Math.max(0, (viewport - pendingWidth) / 2)
        for (var i = 0; i < pending.length; ++i) {
            var item = pending[i]
            output.push({index: item.index, x: x, y: row * line, width: item.width})
            x += item.width
        }
        pending = []
        pendingWidth = 0
        row++
    }

    for (var index = 0; index < words.length; ++index) {
        var word = typeof words[index] === "string" ? words[index] : String(words[index] || "")
        var width = word.length * glyph + gap
        if (pending.length > 0 && pendingWidth + width > viewport) flush()
        pending.push({index: index, width: width})
        pendingWidth += width
        if (width > viewport) flush()
    }
    flush()
    return output
}

var api = {centeredWords: centeredWords}
if (typeof module !== "undefined" && module.exports) module.exports = api

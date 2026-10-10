"use strict";

function finitePositive(value, fallback) {
    var number = Number(value)
    return Number.isFinite(number) && number > 0 ? number : fallback
}

function centeredWords(words, viewportWidth, characterWidth, spacing, lineHeight, advances) {
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
        var x = Math.max(0, Math.round((viewport - pendingWidth) / 2))
        for (var i = 0; i < pending.length; ++i) {
            var item = pending[i]
            output.push({index: item.index, x: x, y: row * line, width: item.width, offsets: item.offsets})
            x += item.width
        }
        pending = []
        pendingWidth = 0
        row++
    }

    for (var index = 0; index < words.length; ++index) {
        var word = typeof words[index] === "string" ? words[index] : String(words[index] || "")
        var offsets = [0]
        var measured = Array.isArray(advances) && advances[index]
        var advance = 0
        for (var letter = 0; letter < word.length; ++letter) {
            var widthForLetter = measured && finitePositive(measured[letter], 0) || glyph
            advance += widthForLetter
            offsets.push(Math.round(advance))
        }
        var width = offsets[word.length] + gap
        if (pending.length > 0 && pendingWidth + width > viewport) flush()
        pending.push({index: index, width: width, offsets: offsets})
        pendingWidth += width
        if (width > viewport) flush()
    }
    flush()
    return output
}

var api = {centeredWords: centeredWords}
if (typeof module !== "undefined" && module.exports) module.exports = api

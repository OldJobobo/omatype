"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Layout = require("../src/layout.js");

test("centers every wrapped typing line inside the viewport", () => {
  const layout = Layout.centeredWords(["one", "two", "three", "four"], 180, 10, 20, 44);
  const lines = Map.groupBy(layout, item => item.y);
  for (const items of lines.values()) {
    const left = items[0].x;
    const right = items.at(-1).x + items.at(-1).width;
    assert.equal(left, (180 - (right - left)) / 2);
  }
  assert.ok(lines.size > 1, "fixture must wrap onto multiple lines");
});

test("keeps an oversized word bounded and centered from the left edge", () => {
  const [item] = Layout.centeredWords(["extraordinary"], 60, 10, 20, 44);
  assert.equal(item.x, 0);
  assert.equal(item.y, 0);
  assert.equal(item.width, 150);
});

test("uses measured glyph advances for wrapping, pixel-aligned positions, and caret stops", () => {
  const words = ["Wi", "iii", "W"];
  const advances = [[18.4, 5.2], [5.2, 5.2, 5.2], [18.4]];
  const layout = Layout.centeredWords(words, 62, 10, 4, 44, advances);
  assert.deepEqual(layout, [
    {index: 0, x: 7, y: 0, width: 28, offsets: [0, 18, 24]},
    {index: 1, x: 35, y: 0, width: 20, offsets: [0, 5, 10, 16]},
    {index: 2, x: 20, y: 44, width: 22, offsets: [0, 18]}
  ]);
  for (const item of layout) {
    assert.equal(item.x, Math.round(item.x));
    assert.ok(item.offsets.every((offset, i) => i === 0 || offset >= item.offsets[i - 1]));
  }
});

test("falls back to nominal glyph width for invalid font metrics", () => {
  const [item] = Layout.centeredWords(["ab"], 100, 10, 4, 44, [[NaN, 0]]);
  assert.deepEqual(item.offsets, [0, 10, 20]);
});

test("returns no geometry for an empty or invalid word list", () => {
  assert.deepEqual(Layout.centeredWords([], 400, 10, 20, 44), []);
  assert.deepEqual(Layout.centeredWords(null, 400, 10, 20, 44), []);
});

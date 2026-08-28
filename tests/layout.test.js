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

test("returns no geometry for an empty or invalid word list", () => {
  assert.deepEqual(Layout.centeredWords([], 400, 10, 20, 44), []);
  assert.deepEqual(Layout.centeredWords(null, 400, 10, 20, 44), []);
});

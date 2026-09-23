const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("manifest exposes the exact persistent overlay and bar widget contract", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, "jobo.omatype");
  assert.equal(manifest.name, "OmaType");
  assert.equal(manifest.version, "0.2.0");
  assert.equal(manifest.keepLoaded, true);
  assert.deepEqual(manifest.kinds, ["overlay", "bar-widget"]);
  assert.deepEqual(manifest.entryPoints, { overlay: "OmaType.qml", barWidget: "BarWidget.qml" });
  assert.deepEqual(manifest.barWidget, {
    displayName: "OmaType",
    description: "Open a typing test and show the latest WPM",
    category: "Productivity",
    allowMultiple: false,
    defaultSection: "right"
  });
});

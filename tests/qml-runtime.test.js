"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {spawnSync} = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

// Qt platform plugins log noise that is unrelated to OmaType: the Wayland
// text-input module warns while a surface loses focus during teardown, and a
// non-UTF-8 locale triggers a locale switch warning. Silence both at source so
// the zero-warning assertions below keep catching real plugin warnings.
const RUNTIME_ENV = {
  QT_LOGGING_RULES: "qt.qpa.services=false;quickshell.qmlscanner=false;qt.qpa.wayland.textinput.warning=false",
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8"
};

function available(command) {
  return spawnSync("bash", ["-lc", `command -v ${command}`], {encoding: "utf8"}).status === 0;
}

test("Qt font metrics and native glyph rendering are available in Quickshell", {timeout: 10000}, t => {
  if (!available("qs") || !process.env.WAYLAND_DISPLAY) return t.skip("Quickshell Wayland runtime unavailable");
  const fixture = path.join(__dirname, "fixtures", "FontRuntime.qml");
  const result = spawnSync("qs", ["-p", fixture, "--no-color"], {
    encoding: "utf8",
    timeout: 8000,
    env: Object.assign({}, process.env, RUNTIME_ENV)
  });
  const output = String(result.stdout || "") + String(result.stderr || "");
  assert.equal(result.error, undefined, output);
  assert.equal(result.status, 0, output);
  assert.match(output, /FONT_HARNESS_OK/);
  assert.doesNotMatch(output, /FONT_HARNESS_FAILURE|TypeError|ReferenceError/);
});

test("visible narrow ProgressView runtime covers exact filter reveal and existing contracts without warnings", {timeout: 10000}, t => {
  if (!available("qs") || !process.env.WAYLAND_DISPLAY) return t.skip("Quickshell Wayland runtime unavailable");
  const fixture = path.join(__dirname, "fixtures", "ProgressRuntime.qml");
  const harness = path.join(__dirname, "..", ".omatype-progress-runtime.qml");
  fs.copyFileSync(fixture, harness);
  let result;
  try {
    result = spawnSync("qs", ["-p", harness, "--no-color"], {
      encoding: "utf8",
      timeout: 8000,
      env: Object.assign({}, process.env, RUNTIME_ENV)
    });
  } finally {
    fs.rmSync(harness, {force: true});
  }
  const output = String(result.stdout || "") + String(result.stderr || "");
  assert.equal(result.error, undefined, output);
  assert.equal(result.status, 0, output);
  assert.match(output, /HARNESS_OK: narrow visible progress, exact filter reveal, reopen reset, null chart, and legacy adapter migration contract/);
  assert.doesNotMatch(output, /HARNESS_FAILURE|\bERROR\b|TypeError|ReferenceError/);
  const warnings = output.split("\n").filter(line => /\bWARN\b/.test(line));
  assert.deepEqual(warnings, [], output);
});

test("SecureFile runtime covers CAS queues, external replacements, and future-schema cancellation", {timeout: 15000}, t => {
  if (!available("qs") || !process.env.WAYLAND_DISPLAY) return t.skip("Quickshell Wayland runtime unavailable");
  const fixture = path.join(__dirname, "fixtures", "SecureFileRuntime.qml");
  const harness = path.join(__dirname, "..", ".omatype-secure-runtime.qml");
  const runtimeHome = fs.mkdtempSync(path.join(__dirname, ".secure-runtime-"));
  fs.copyFileSync(fixture, harness);
  let result;
  try {
    result = spawnSync("qs", ["-p", harness, "--no-color"], {
      encoding: "utf8",
      timeout: 12000,
      env: Object.assign({}, process.env, RUNTIME_ENV, {HOME: runtimeHome})
    });
  } finally {
    fs.rmSync(harness, {force: true});
    fs.rmSync(runtimeHome, {recursive: true, force: true});
  }
  const output = String(result.stdout || "") + String(result.stderr || "");
  assert.equal(result.error, undefined, output);
  assert.equal(result.status, 0, output);
  assert.match(output, /SECURE_HARNESS_OK: CAS queue, watcher reload, exact newlines, future-schema cancellation, and helper start failure/);
  assert.doesNotMatch(output, /SECURE_HARNESS_FAILURE|\bERROR\b|TypeError|ReferenceError/);
  // The missing-interpreter store makes Quickshell warn once per failed start
  // (one read, one write). Anything else is a real warning.
  const expectedStartFailure = /Process failed to start.*omatype-test-interpreter/;
  const warnings = output.split("\n").filter(line => /\bWARN\b/.test(line));
  assert.equal(warnings.filter(line => expectedStartFailure.test(line)).length, 2, output);
  assert.deepEqual(warnings.filter(line => !expectedStartFailure.test(line)), [], output);
});

test("KeyboardGuide runtime covers positioned keys, numpad disambiguation, and rows fallback", {timeout: 10000}, t => {
  if (!available("qs") || !process.env.WAYLAND_DISPLAY) return t.skip("Quickshell Wayland runtime unavailable");
  const fixture = path.join(__dirname, "fixtures", "KeyboardGuideRuntime.qml");
  const harness = path.join(__dirname, "..", ".omatype-keyboard-runtime.qml");
  fs.copyFileSync(fixture, harness);
  let result;
  try {
    result = spawnSync("qs", ["-p", harness, "--no-color"], {
      encoding: "utf8",
      timeout: 8000,
      env: Object.assign({}, process.env, RUNTIME_ENV)
    });
  } finally {
    fs.rmSync(harness, {force: true});
  }
  const output = String(result.stdout || "") + String(result.stderr || "");
  assert.equal(result.error, undefined, output);
  assert.equal(result.status, 0, output);
  assert.match(output, /GUIDE_HARNESS_OK: positioned keys, numpad disambiguation, rows fallback, layer tabs, and thumb highlighting/);
  assert.doesNotMatch(output, /GUIDE_HARNESS_FAILURE|\bERROR\b|TypeError|ReferenceError/);
  const warnings = output.split("\n").filter(line => /\bWARN\b/.test(line));
  assert.deepEqual(warnings, [], output);
});

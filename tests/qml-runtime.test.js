"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {spawnSync} = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");

function available(command) {
  return spawnSync("bash", ["-lc", `command -v ${command}`], {encoding: "utf8"}).status === 0;
}

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
      env: Object.assign({}, process.env, {QT_LOGGING_RULES: "qt.qpa.services=false;quickshell.qmlscanner=false"})
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

test("SecureFile runtime coalesces writes and watches external atomic replacements", {timeout: 15000}, t => {
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
      env: Object.assign({}, process.env, {
        HOME: runtimeHome,
        QT_LOGGING_RULES: "qt.qpa.services=false;quickshell.qmlscanner=false"
      })
    });
  } finally {
    fs.rmSync(harness, {force: true});
    fs.rmSync(runtimeHome, {recursive: true, force: true});
  }
  const output = String(result.stdout || "") + String(result.stderr || "");
  assert.equal(result.error, undefined, output);
  assert.equal(result.status, 0, output);
  assert.match(output, /SECURE_HARNESS_OK: latest queued write wins and watcher reloads external replacement/);
  assert.doesNotMatch(output, /SECURE_HARNESS_FAILURE|\bERROR\b|TypeError|ReferenceError/);
  const warnings = output.split("\n").filter(line => /\bWARN\b/.test(line));
  assert.deepEqual(warnings, [], output);
});

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Settings = require("../src/settings.js");
const Languages = require("../src/languages.js");

test("settings expose versioned category defaults", () => {
  const value = Settings.defaults();
  assert.equal(value.schemaVersion, 1);
  assert.deepEqual(value.caret, {
    style: "default",
    smooth: "medium",
    blink: true,
    blinkMs: 800,
    thickness: 2,
    color: "accent",
    customColor: "#e2b714"
  });
  assert.equal(value.behavior.quickRestart, "tab");
  assert.deepEqual(value.behavior, {
    quickRestart: "tab",
    stopOnError: "off",
    strictSpace: false,
    backspace: "full",
    quickEnd: false
  });
  assert.equal(value.test.language, "english");
  assert.deepEqual(value.appearance, {
    timerStyle: "text",
    liveWpm: false,
    liveAccuracy: false,
    highlight: "letter",
    typedEffect: "keep",
    smoothScroll: true,
    lineCount: 3,
    fontSize: 32,
    maxLineWidth: 1280,
    lineHeight: 44,
    wordSpacing: 21,
    focusHideHeader: true,
    focusHideSetup: true,
    focusHideFooter: true,
    keyboardGuide: true,
    keyboardLayout: "qwerty",
    keyboardLayouts: ["qwerty"]
  });
  assert.deepEqual(value.accessibility, {
    reducedMotion: false,
    highContrast: false,
    errorStyle: "color"
  });
  assert.deepEqual(value.progress, {goalMetric: "tests", goalTarget: 10});
});

test("settings documents distinguish supported, malformed, and future schemas before normalization", () => {
  assert.equal(Settings.documentStatus({schemaVersion: 1, test: {mode: "words"}}), "supported");
  assert.equal(Settings.documentStatus({test: {mode: "words"}}), "supported");
  assert.equal(Settings.documentStatus(null), "malformed");
  assert.equal(Settings.documentStatus([]), "malformed");
  const future = {schemaVersion: 2, test: {mode: "words"}};
  assert.equal(Settings.documentStatus(future), "unsupported");
  assert.deepEqual(Settings.readDocument(future), {status: "unsupported", value: null});
  assert.equal(Settings.readDocument({schemaVersion: 1, test: {mode: "words"}}).value.test.mode, "words");
});

test("normalization rejects malformed shapes and unknown keys", () => {
  assert.deepEqual(Settings.normalize(null), Settings.defaults());
  assert.deepEqual(Settings.normalize([]), Settings.defaults());
  const normalized = Settings.normalize({schemaVersion: 99, caret: "line", injected: {command: "no"}});
  assert.deepEqual(normalized, Settings.defaults());
  assert.equal("injected" in normalized, false);
});

test("caret options are allowlisted and numeric values are bounded", () => {
  const normalized = Settings.normalize({
    caret: {
      style: "outline",
      smooth: "fast",
      blink: false,
      blinkMs: 999999,
      thickness: -4,
      color: "custom",
      customColor: "#12AbEF"
    }
  });
  assert.equal(normalized.caret.style, "outline");
  assert.equal(normalized.caret.smooth, "fast");
  assert.equal(normalized.caret.blink, false);
  assert.equal(normalized.caret.blinkMs, 2000);
  assert.equal(normalized.caret.thickness, 1);
  assert.equal(normalized.caret.color, "custom");
  assert.equal(normalized.caret.customColor, "#12abef");

  const fallback = Settings.normalize({caret: {style: "banana", smooth: "warp", customColor: "red"}});
  assert.equal(fallback.caret.style, "default");
  assert.equal(fallback.caret.smooth, "medium");
  assert.equal(fallback.caret.customColor, "#e2b714");
});

test("behavior, appearance, and accessibility settings are allowlisted and bounded", () => {
  const normalized = Settings.normalize({
    behavior: {quickRestart: "escape", stopOnError: "letter", strictSpace: true, backspace: "off", quickEnd: true},
    appearance: {
      timerStyle: "bar", liveWpm: true, liveAccuracy: true, highlight: "word", typedEffect: "fade",
      smoothScroll: false, lineCount: 99, fontSize: 200, maxLineWidth: -5, lineHeight: 2,
      wordSpacing: 500, focusHideHeader: false, focusHideSetup: false, focusHideFooter: false,
      keyboardGuide: false, keyboardLayout: "qwerty", keyboardLayouts: ["qwerty", "colemak"]
    },
    accessibility: {reducedMotion: true, highContrast: true, errorStyle: "both"}
  });
  assert.deepEqual(normalized.behavior, {quickRestart: "escape", stopOnError: "letter", strictSpace: true, backspace: "off", quickEnd: true});
  assert.equal(normalized.appearance.timerStyle, "bar");
  assert.equal(normalized.appearance.lineCount, 8);
  assert.equal(normalized.appearance.fontSize, 64);
  assert.equal(normalized.appearance.maxLineWidth, 480);
  assert.equal(normalized.appearance.lineHeight, 34);
  assert.equal(normalized.appearance.wordSpacing, 60);
  assert.equal(normalized.appearance.keyboardGuide, false);
  assert.equal(normalized.appearance.keyboardLayout, "qwerty");
  assert.deepEqual(normalized.appearance.keyboardLayouts, ["qwerty", "colemak"]);
  assert.deepEqual(normalized.accessibility, {reducedMotion: true, highContrast: true, errorStyle: "both"});

  const fallback = Settings.normalize({
    behavior: {stopOnError: "explode", backspace: "sometimes"},
    appearance: {timerStyle: "clock", highlight: "rainbow", typedEffect: "erase", keyboardLayout: "../../evil"},
    accessibility: {errorStyle: "sparkle"}
  });
  assert.equal(fallback.behavior.stopOnError, "off");
  assert.equal(fallback.behavior.backspace, "full");
  assert.equal(fallback.appearance.timerStyle, "text");
  assert.equal(fallback.appearance.highlight, "letter");
  assert.equal(fallback.appearance.typedEffect, "keep");
  assert.equal(fallback.appearance.keyboardLayout, "qwerty");
  assert.equal(fallback.accessibility.errorStyle, "color");
});

test("progress goals migrate with defaults and remain bounded", () => {
  assert.deepEqual(Settings.normalize({schemaVersion: 1}).progress, {goalMetric: "tests", goalTarget: 10});
  assert.deepEqual(Settings.normalize({progress: {goalMetric: "minutes", goalTarget: 45}}).progress,
    {goalMetric: "minutes", goalTarget: 45});
  assert.equal(Settings.normalize({progress: {goalMetric: "streak", goalTarget: 0}}).progress.goalMetric, "tests");
  assert.equal(Settings.normalize({progress: {goalTarget: 99999999}}).progress.goalTarget, 1000000);
  assert.equal(Settings.update(Settings.defaults(), "progress", "goalTarget", 25).progress.goalTarget, 25);
});

test("language selection is allowlisted across every local pack", () => {
  for (const option of Languages.options()) {
    assert.equal(Settings.normalize({test: {language: option.id}}).test.language, option.id);
  }
  assert.equal(Settings.normalize({test: {language: "../../rust"}}).test.language, "english");
  assert.equal(Settings.normalize({test: {language: 7}}).test.language, "english");
});

test("numeric test lengths survive normalization and updates", () => {
  const normalized = Settings.normalize({test: {time: 60, words: 100}});
  assert.equal(normalized.test.time, 60);
  assert.equal(normalized.test.words, 100);
  assert.equal(Settings.update(normalized, "test", "time", 120).test.time, 120);
});

test("invalid and unknown updates preserve the current preference", () => {
  const original = Settings.normalize({behavior: {quickRestart: "escape"}});
  assert.equal(Settings.isValidUpdate(original, "behavior", "quickRestart", "HOSTILE"), false);
  assert.equal(Settings.update(original, "behavior", "quickRestart", "HOSTILE").behavior.quickRestart, "escape");
  assert.equal(Settings.isValidUpdate(original, "behavior", "unknown", true), false);
  assert.deepEqual(Settings.update(original, "behavior", "unknown", true), original);
});

test("updates and category resets do not mutate the prior value", () => {
  const original = Settings.normalize({caret: {style: "block"}});
  const updated = Settings.update(original, "caret", "style", "underline");
  assert.equal(original.caret.style, "block");
  assert.equal(updated.caret.style, "underline");
  assert.equal(Settings.resetCategory(updated, "caret").caret.style, "default");
  assert.deepEqual(Settings.resetCategory(updated, "unknown"), updated);
});

test("layout collections allow QWERTY removal but retain one valid layout", () => {
  const withoutQwerty = Settings.normalize({appearance: {keyboardLayout: "engrammer", keyboardLayouts: ["engrammer"]}});
  assert.deepEqual(withoutQwerty.appearance.keyboardLayouts, ["engrammer"]);
  assert.equal(withoutQwerty.appearance.keyboardLayout, "engrammer");
  assert.deepEqual(Settings.normalize({appearance: {keyboardLayouts: []}}).appearance.keyboardLayouts, ["qwerty"]);
});

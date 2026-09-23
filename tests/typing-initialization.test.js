"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Settings = require("../src/settings.js");
const Generator = require("../src/generator.js");
const TypingState = require("../src/typing-state.js");
const source = fs.readFileSync(path.join(__dirname, "..", "OmaType.qml"), "utf8");

// Execute the actual QML JavaScript rather than a duplicated implementation.
// This models synchronous model observers; it does not replace a QML runtime test.
const newTestSource = source.slice(source.indexOf("    function newTest() {"),
  source.indexOf("    function appendTimeWords() {"));
const colorMatch = source.match(/color: \{\s*([\s\S]*?)\n\s*\}\n\s*font\.family/g)
  .find(block => block.includes("var globalIndex = wordDelegate.globalStart + index"));
const colorBody = colorMatch.slice(colorMatch.indexOf("{") + 1, colorMatch.lastIndexOf("}"));
const color = new Function("root", "wordDelegate", "index", "Qt", colorBody);
const delegate = {globalStart: 0, index: 0};
const Qt = {rgba: (...channels) => channels};

function colorRoot(typing) {
  return {
    typing, runtimeSettings: Settings.defaults(), activeWordIndex: 0,
    textColor: {r: 1, g: 1, b: 1}, mutedColor: "muted",
    accentColor: "accent", errorColor: "error"
  };
}

test("character color is safe before typing initialization for every highlight mode", () => {
  const root = colorRoot(null);
  for (const highlight of ["letter", "word", "next-word", "off"]) {
    root.runtimeSettings.appearance.highlight = highlight;
    assert.equal(color(root, delegate, 0, Qt), "muted");
  }
});

test("character colors retain caret, typed, error, and highlight behavior", () => {
  const root = colorRoot({cursor: 0, status: []});
  assert.equal(color(root, delegate, 0, Qt), "accent");
  root.typing = {cursor: 1, status: ["correct"]};
  assert.equal(color(root, delegate, 0, Qt), root.textColor);
  root.runtimeSettings.appearance.typedEffect = "fade";
  assert.equal(color(root, delegate, 0, Qt), "muted");
  root.runtimeSettings.appearance.typedEffect = "hide";
  assert.deepEqual(color(root, delegate, 0, Qt), [1, 1, 1, 0]);
  root.typing.status[0] = "error";
  root.runtimeSettings.accessibility.errorStyle = "both";
  assert.equal(color(root, delegate, 0, Qt), "error");
  root.runtimeSettings.accessibility.errorStyle = "underline";
  assert.equal(color(root, delegate, 0, Qt), root.textColor);
  root.typing.cursor = 0;
  root.runtimeSettings.appearance.highlight = "word";
  assert.equal(color(root, delegate, 0, Qt), root.textColor);
  root.runtimeSettings.appearance.highlight = "next-word";
  assert.equal(color(root, {globalStart: 2, index: 1}, 0, Qt), root.textColor);
  root.runtimeSettings.appearance.highlight = "off";
  assert.equal(color(root, delegate, 0, Qt), "muted");
});

test("startup and repeated newTest calls publish prompts only after matching typing state", () => {
  const deferred = [];
  const context = {
    Settings, Generator, TypingState,
    Qt: {callLater: callback => deferred.push(callback)},
    userSettings: Settings.defaults(), mode: "words", amount: 10,
    language: "english", punctuation: false, numbers: false,
    programmingLanguage: false, seed: "startup", typing: null,
    activeWordSource: () => ["alpha", "beta", "gamma"],
    rebuildWordLayout: () => {}, wordsClip: {width: 800},
    keyboardRoot: {forceActiveFocus: () => {}},
    wordRepeater: {itemAt: () => null}
  };
  context.root = context;
  let generated = null;
  let publications = 0;
  Object.defineProperty(context, "generated", {
    get: () => generated,
    set: value => {
      assert.ok(context.typing, "delegates must never see null typing");
      assert.equal(context.typing.target, value.text);
      assert.equal(context.typing.cursor, 0);
      assert.equal(context.typing.startedAt, null);
      assert.equal(color(colorRoot(context.typing), delegate, 0, Qt), "accent");
      generated = value;
      publications++;
    }
  });
  vm.createContext(context);
  vm.runInContext(newTestSource, context);
  for (let run = 0; run < 3; run++) {
    context.seed = "restart-" + run;
    context.newTest();
    while (deferred.length) deferred.shift()();
    assert.equal(context.result, null);
    assert.equal(context.resultSaved, false);
    assert.equal(context.samples.length, 0);
    // Simulate a used session before the next restart.
    context.typing.cursor = 3;
    context.typing.startedAt = 1000;
  }
  assert.equal(publications, 3);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");

function includesAll(source, values) {
  for (const value of values) assert.match(source, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

test("overlay owns the real Quattro lifecycle and layer surface", () => {
  const q = read("OmaType.qml");
  includesAll(q, [
    "import Quickshell.Wayland",
    "import qs.Commons",
    "property bool opened",
    "function open(payloadJson)",
    "function close()",
    "function dismiss()",
    "PanelWindow",
    "WlrLayershell.namespace: \"jobo-omatype\"",
    "WlrLayershell.layer: WlrLayer.Overlay",
    "WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive",
    "ExclusionMode.Ignore",
    "visible: root.opened",
    "shell.hide(\"jobo.omatype\")"
  ]);
});

test("overlay translates Monkeytype geometry through Omarchy semantic colors", () => {
  const q = read("OmaType.qml");
  includesAll(q, [
    "Color.background",
    "Color.accent",
    "Color.foreground",
    "Style.font.family",
    "width * 0.10",
    "font.pixelSize: root.runtimeSettings.appearance.fontSize",
    "height: root.runtimeSettings.appearance.lineHeight",
    "timeOptions",
    "wordOptions",
    "punctuation",
    "numbers",
    "focusMode",
    "FileView",
    "atomicWrites: true",
    "Canvas",
    "wpm",
    "accuracy",
    "consistency"
  ]);
  assert.doesNotMatch(q, /readonly property color backgroundColor: "#323437"/);
  assert.doesNotMatch(q, /textFormat: Text\.RichText/);
});

test("header uses the OmaType product name and omits redundant offline status", () => {
  const q = read("OmaType.qml");
  assert.match(q, /text:\s*"OmaType"/);
  assert.doesNotMatch(q, /text:\s*"omatype"/);
  assert.doesNotMatch(q, /text:\s*"offline"/);
});

test("overlay keeps epoch time at double precision and publishes one complete result object", () => {
  const q = read("OmaType.qml");
  includesAll(q, ["property double nowMs", "var summary = Metrics.summarize", "result = summary", "summary.characters", "summary.correct"]);
  assert.doesNotMatch(q, /property int nowMs/);
});

test("overlay bounds local IPC payloads before generation", () => {
  const q = read("OmaType.qml");
  includesAll(q, ["import \"src/ipc-policy.js\" as IpcPolicy", "var payload = IpcPolicy.parsePayload(payloadJson)", "if (payload === null) return", "if (requestedMode !== mode) amount = requestedMode === \"time\" ? 30 : 25", "allowedAmounts.indexOf(requestedAmount) >= 0", "String(payload.seed).slice(0, 128)", "settingsSections.indexOf(payload.settingsSection) >= 0",
 "settingsCategories.indexOf(payload.setting.category) >= 0",
 "root.applyAutomationTransaction(payload, validSettingPayload, validResetPayload)",
 "settingsCategories.indexOf(payload.resetCategory) >= 0",
 "payload.settings === true", "settingsPanel.currentSection = requestedSettingsSection"]);
});

test("overlay validates every automation field before any mutation", () => {
  const q = read("OmaType.qml");
  const settingGuard = q.indexOf('if (Object.prototype.hasOwnProperty.call(payload, "setting") && !validSettingPayload) return');
  const resetGuard = q.indexOf('if (Object.prototype.hasOwnProperty.call(payload, "resetCategory") && !validResetPayload) return');
  const firstMutation = Math.min(q.indexOf("if (!root.opened) root.loadSettings(true)"), q.indexOf("root.applyAutomationTransaction(payload, validSettingPayload, validResetPayload)"));
  assert.ok(settingGuard >= 0 && resetGuard > settingGuard && firstMutation > resetGuard);
});

test("accepted automation commits once and constructs at most one test", () => {
  const q = read("OmaType.qml");
  includesAll(q, [
    "if (!root.opened) root.loadSettings(true)",
    "var activeRunBeforeAutomation = root.opened && root.focusMode",
    "function applyAutomationTransaction(payload, validSettingPayload, validResetPayload)",
    "root.userSettings = nextSettings",
    "root.persistSettings()",
    "root.applyAutomationTransaction(payload, validSettingPayload, validResetPayload)"
  ]);
  const openBody = q.slice(q.indexOf("function open(payloadJson)"), q.indexOf("function close()"));
  assert.equal((openBody.match(/newTest\(\)/g) || []).length, 1);
  assert.doesNotMatch(openBody, /applySetting\(|resetSettingsCategory\(/);
});

test("overlay accepts both Enter keys and only printable text", () => {
  const q = read("OmaType.qml");
  includesAll(q, ["Qt.Key_Enter || event.key === Qt.Key_Return", "function isPrintable(text)", "Array.from(text).length !== 1", "codePoint >= 0x20"]);
  assert.doesNotMatch(q, /event\.text\.length === 1/);
});

test("overlay samples interval speed and retains corrected mistake telemetry", () => {
  const q = read("OmaType.qml");
  includesAll(q, [
    "property int sampledKeystrokes: 0",
    "property double lastSampleMs: 0",
    "Metrics.intervalWpm(root.typing.totalKeystrokes, root.sampledKeystrokes, sampledAt - root.lastSampleMs)",
    "correct: typing.totalKeystrokes - typing.errorKeystrokes",
    "total: typing.totalKeystrokes",
    "summary.corrected = typing.correctedErrors",
    "summary.uncorrectedErrors = typing.errors"
  ]);
  assert.doesNotMatch(q, /typing\.typed\.length \/ 5 \/ minutes/);
});

test("time mode extends its prompt before the fixed buffer is exhausted", () => {
  const q = read("OmaType.qml");
  includesAll(q, ["function appendTimeWords()", "root.typing.target.length - root.typing.cursor < 240", "generated.words.concat(batch.words)", "typing.target = nextText"]);
});

test("typing viewport centers each wrapped line", () => {
  const q = read("OmaType.qml");
  includesAll(q, [
    "import \"src/layout.js\" as Layout",
    "property var wordLayout: []",
    "function rebuildWordLayout(viewportWidth)",
    "Layout.centeredWords",
    "id: testView",
    "anchors.horizontalCenter: parent.horizontalCenter",
    "width: Math.min(parent.width, root.runtimeSettings.appearance.maxLineWidth)",
    "readonly property var geometry:",
    "x: geometry.x",
    "y: geometry.y"
  ]);
  assert.doesNotMatch(q, /\n\s*Flow \{\n\s*id: typingFlow/);
});

test("programming language picker drives generation and persists selection", () => {
  const q = read("OmaType.qml");
  includesAll(q, [
    "import \"src/languages.js\" as Languages",
    "property string language: \"english\"",
    "property string activeLanguage: \"english\"",
    "property bool languagePanelOpen: false",
    "readonly property var languageOptions: Languages.options()",
    "readonly property var currentLanguagePack: Languages.get(root.language)",
    "readonly property var activeLanguagePack: Languages.get(root.activeLanguage)",
    "activeLanguage = root.activeSettings.test.language",
    "function chooseLanguage(languageId)",
    "var activeRun = root.focusMode",
    "if (!activeRun) root.restart()",
    "visible: root.languagePanelOpen",
    "Settings.update(root.userSettings, \"test\", \"language\", languageId)",
    "words: root.activeWordSource()",
    "id: languagePanel",
    "model: root.languageOptions",
    "root.chooseLanguage(parent.modelData.id)",
    "currentLanguagePack.label",
    "summary.language = activeLanguage",
  ]);
});

test("settings foundation persists bounded customization and drives caret rendering", () => {
  const q = read("OmaType.qml");
  includesAll(q, [
    "import \"src/settings.js\" as Settings",
    "omatype-settings.json",
    "function applySetting(category, key, value)",
    "Settings.normalize",
    "id: settingsPanel",
    "root.runtimeSettings.caret.style",
    "root.runtimeSettings.caret.smooth",
    "Behavior on x",
    "style === \"block\"",
    "style === \"outline\"",
    "style === \"underline\""
  ]);
});

test("expanded appearance settings drive the typing viewport", () => {
  const q = read("OmaType.qml");
  includesAll(q, [
    "root.runtimeSettings.appearance.maxLineWidth",
    "root.runtimeSettings.appearance.lineCount * root.runtimeSettings.appearance.lineHeight",
    "root.runtimeSettings.appearance.timerStyle === \"bar\"",
    "root.runtimeSettings.appearance.timerStyle !== \"off\"",
    "root.runtimeSettings.appearance.liveWpm",
    "root.runtimeSettings.appearance.liveAccuracy",
    "root.runtimeSettings.appearance.highlight",
    "root.runtimeSettings.appearance.typedEffect",
    "root.runtimeSettings.appearance.smoothScroll",
    "root.runtimeSettings.appearance.fontSize",
    "root.runtimeSettings.accessibility.errorStyle",
    "font.underline:",
    "root.runtimeSettings.appearance.focusHideFooter",
    "settingsPanel.moveSection(-1)",
    "settingsPanel.moveSection(1)",
    "settingsPanel.scrollBy(-220)",
    "settingsPanel.scrollBy(220)",
    "y: 90",
    "height: Math.min(660, surface.height - 140)"
  ]);
});

test("active runs stay isolated from config reloads and settings remain visible", () => {
  const q = read("OmaType.qml");
  includesAll(q, [
    "readonly property var runtimeSettings: root.activeSettings",
    "function loadSettings(syncSetup)",
    "if (syncSetup === true) root.syncStoredTestSettings()",
    "onFileChanged: reload()",
    "onLoaded: root.loadSettings(true)",
    "if (!root.opened) root.loadSettings(true)",
    "if (category === \"test\") root.syncStoredTestSettings()",
    "if (!Settings.isValidUpdate(root.userSettings, category, key, value)) return false",
    "if (Object.prototype.hasOwnProperty.call(payload, \"setting\") && !validSettingPayload) return",
    "if (Object.prototype.hasOwnProperty.call(payload, \"resetCategory\") && !validResetPayload) return",
    "var activeRunBeforeAutomation = root.opened && root.focusMode",
    "if ((validSettingPayload || validResetPayload) && activeRunBeforeAutomation)",
    "&& root.opened && !activeRun",
    "summary.mode = root.activeSettings.test.mode",
    "summary.amount = root.activeSettings.test.mode === \"time\" ? root.activeSettings.test.time : root.activeSettings.test.words",
    "root.activeSettings.test.mode === \"time\"",
    "visible: root.settingsOpen"
  ]);
});

test("QML runtime modules avoid unsupported globalThis fallback", () => {
  for (const file of ["src/typing-state.js", "src/history.js"])
    assert.doesNotMatch(read(file), /globalThis/, file);
});

test("bar widget uses the supported Quattro bar host contract", () => {
  const q = read("BarWidget.qml");
  includesAll(q, [
    "import qs.Commons",
    "import qs.Ui",
    "property var bar: null",
    "BarIconButton",
    "bar: root.bar",
    "tooltipText:",
    `root.bar.run("omarchy-shell shell toggle jobo.omatype '{}'")`,
    "FileView",
    "lastWpm"
  ]);
  assert.doesNotMatch(q, /signal activated/);
});

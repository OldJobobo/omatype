"use strict";

const SCHEMA_VERSION = 1;
const CARET_STYLES = ["off", "default", "block", "outline", "underline"];
const SMOOTH_CARET = ["off", "slow", "medium", "fast"];
const CARET_COLORS = ["accent", "foreground", "error", "custom"];
const QUICK_RESTART = ["off", "escape", "tab", "enter"];
const STOP_ON_ERROR = ["off", "letter"];
const BACKSPACE_MODES = ["full", "off"];
const TIMER_STYLES = ["text", "mini", "bar", "off"];
const HIGHLIGHT_MODES = ["letter", "word", "next-word", "off"];
const TYPED_EFFECTS = ["keep", "fade", "hide"];
const ERROR_STYLES = ["color", "underline", "both"];
const GOAL_METRICS = ["tests", "minutes", "characters"];
const LANGUAGE_IDS = [
  "english", "ada", "assembly", "bash", "c", "clojure", "cpp", "csharp", "css",
  "dart", "elixir", "go", "haskell", "html", "java", "javascript", "json", "julia",
  "kotlin", "lua", "nix", "objective-c", "ocaml", "perl", "php", "powershell",
  "python", "r", "ruby", "rust", "scala", "solidity", "sql", "swift", "typescript",
  "yaml", "zig"
];

function defaults() {
  return {
    schemaVersion: SCHEMA_VERSION,
    test: {
      mode: "time",
      time: 30,
      words: 25,
      language: "english",
      punctuation: false,
      numbers: false
    },
    behavior: {
      quickRestart: "tab",
      stopOnError: "off",
      strictSpace: false,
      backspace: "full",
      quickEnd: false
    },
    caret: {
      style: "default",
      smooth: "medium",
      blink: true,
      blinkMs: 800,
      thickness: 2,
      color: "accent",
      customColor: "#e2b714"
    },
    appearance: {
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
      focusHideFooter: true
    },
    accessibility: {
      reducedMotion: false,
      highContrast: false,
      errorStyle: "color"
    },
    progress: {
      goalMetric: "tests",
      goalTarget: 10
    }
  };
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function oneOf(value, allowed, fallback) {
  return allowed.indexOf(value) >= 0 ? value : fallback;
}

function boolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function number(value, minimum, maximum, fallback) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function hex(value, fallback) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toLowerCase()
    : fallback;
}

function normalize(raw) {
  const base = defaults();
  const source = object(raw);
  if (!source || (source.schemaVersion !== undefined && source.schemaVersion !== SCHEMA_VERSION)) return base;

  const test = object(source.test) || {};
  const behavior = object(source.behavior) || {};
  const caret = object(source.caret) || {};
  const appearance = object(source.appearance) || {};
  const accessibility = object(source.accessibility) || {};
  const progress = object(source.progress) || {};

  base.test.mode = oneOf(test.mode, ["time", "words"], base.test.mode);
  base.test.time = oneOf(test.time, [15, 30, 60, 120], base.test.time);
  base.test.words = oneOf(test.words, [10, 25, 50, 100], base.test.words);
  base.test.language = oneOf(test.language, LANGUAGE_IDS, base.test.language);
  base.test.punctuation = boolean(test.punctuation, base.test.punctuation);
  base.test.numbers = boolean(test.numbers, base.test.numbers);

  base.behavior.quickRestart = oneOf(behavior.quickRestart, QUICK_RESTART, base.behavior.quickRestart);
  base.behavior.stopOnError = oneOf(behavior.stopOnError, STOP_ON_ERROR, base.behavior.stopOnError);
  base.behavior.strictSpace = boolean(behavior.strictSpace, base.behavior.strictSpace);
  base.behavior.backspace = oneOf(behavior.backspace, BACKSPACE_MODES, base.behavior.backspace);
  base.behavior.quickEnd = boolean(behavior.quickEnd, base.behavior.quickEnd);

  base.caret.style = oneOf(caret.style, CARET_STYLES, base.caret.style);
  base.caret.smooth = oneOf(caret.smooth, SMOOTH_CARET, base.caret.smooth);
  base.caret.blink = boolean(caret.blink, base.caret.blink);
  base.caret.blinkMs = Math.round(number(caret.blinkMs, 250, 2000, base.caret.blinkMs));
  base.caret.thickness = number(caret.thickness, 1, 8, base.caret.thickness);
  base.caret.color = oneOf(caret.color, CARET_COLORS, base.caret.color);
  base.caret.customColor = hex(caret.customColor, base.caret.customColor);

  base.appearance.timerStyle = oneOf(appearance.timerStyle, TIMER_STYLES, base.appearance.timerStyle);
  base.appearance.liveWpm = boolean(appearance.liveWpm, base.appearance.liveWpm);
  base.appearance.liveAccuracy = boolean(appearance.liveAccuracy, base.appearance.liveAccuracy);
  base.appearance.highlight = oneOf(appearance.highlight, HIGHLIGHT_MODES, base.appearance.highlight);
  base.appearance.typedEffect = oneOf(appearance.typedEffect, TYPED_EFFECTS, base.appearance.typedEffect);
  base.appearance.smoothScroll = boolean(appearance.smoothScroll, base.appearance.smoothScroll);
  base.appearance.lineCount = Math.round(number(appearance.lineCount, 1, 8, base.appearance.lineCount));
  base.appearance.fontSize = number(appearance.fontSize, 18, 64, base.appearance.fontSize);
  base.appearance.maxLineWidth = number(appearance.maxLineWidth, 480, 1600, base.appearance.maxLineWidth);
  base.appearance.lineHeight = number(appearance.lineHeight, 34, 80, base.appearance.lineHeight);
  base.appearance.wordSpacing = number(appearance.wordSpacing, 8, 60, base.appearance.wordSpacing);
  base.appearance.focusHideHeader = boolean(appearance.focusHideHeader, base.appearance.focusHideHeader);
  base.appearance.focusHideSetup = boolean(appearance.focusHideSetup, base.appearance.focusHideSetup);
  base.appearance.focusHideFooter = boolean(appearance.focusHideFooter, base.appearance.focusHideFooter);

  base.accessibility.reducedMotion = boolean(accessibility.reducedMotion, base.accessibility.reducedMotion);
  base.accessibility.highContrast = boolean(accessibility.highContrast, base.accessibility.highContrast);
  base.accessibility.errorStyle = oneOf(accessibility.errorStyle, ERROR_STYLES, base.accessibility.errorStyle);

  base.progress.goalMetric = oneOf(progress.goalMetric, GOAL_METRICS, base.progress.goalMetric);
  base.progress.goalTarget = Math.round(number(progress.goalTarget, 1, 1000000, base.progress.goalTarget));
  return base;
}

function isValidUpdate(current, category, key, value) {
  const next = normalize(current);
  if (!Object.prototype.hasOwnProperty.call(next, category)) return false;
  const group = object(next[category]);
  if (!group || !Object.prototype.hasOwnProperty.call(group, key)) return false;
  group[key] = value;
  const normalized = normalize(next);
  return Object.is(normalized[category][key], value);
}

function update(current, category, key, value) {
  const next = normalize(current);
  if (!isValidUpdate(next, category, key, value)) return next;
  next[category][key] = value;
  return normalize(next);
}

function resetCategory(current, category) {
  const next = normalize(current);
  const base = defaults();
  if (!Object.prototype.hasOwnProperty.call(base, category) || category === "schemaVersion") return next;
  next[category] = base[category];
  return normalize(next);
}

const api = {
  SCHEMA_VERSION,
  CARET_STYLES,
  SMOOTH_CARET,
  CARET_COLORS,
  QUICK_RESTART,
  STOP_ON_ERROR,
  BACKSPACE_MODES,
  TIMER_STYLES,
  HIGHLIGHT_MODES,
  TYPED_EFFECTS,
  ERROR_STYLES,
  GOAL_METRICS,
  LANGUAGE_IDS,
  defaults,
  normalize,
  isValidUpdate,
  update,
  resetCategory
};
if (typeof module !== "undefined" && module.exports) module.exports = api;

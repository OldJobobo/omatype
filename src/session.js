"use strict";

const Generator = typeof require !== "undefined" ? require("./generator.js") : globalThis.Generator;
const State = typeof require !== "undefined" ? require("./typing-state.js") : globalThis.TypingState;
const Metrics = typeof require !== "undefined" ? require("./metrics.js") : globalThis.Metrics;
const InputPolicy = typeof require !== "undefined" ? require("./input-policy.js") : globalThis.InputPolicy;

function create(options) {
  options = options || {};
  const generated = Generator.generate(options);
  return {
    options,
    seed: generated.seed,
    target: generated.text,
    state: State.create(generated.text),
    completed: false,
    samples: []
  };
}

function key(session, value, now) {
  if (value === "Backspace") State.backspace(session.state);
  else State.input(session.state, value, now);
  session.completed = session.state.completed;
  return session;
}

function finish(session, now, completion) {
  const state = session.state;
  const finishedMs = state.endedAt ?? now;
  const elapsed = Math.max(1, finishedMs - (state.startedAt ?? finishedMs));
  const total = state.totalKeystrokes;
  const correct = Math.max(0, total - state.errorKeystrokes);
  const metrics = Metrics.summarize({correct, total, elapsedMs: elapsed, samples: session.samples});
  const finishedAt = new Date(finishedMs);
  const timezoneOffsetMinutes = finishedAt.getTimezoneOffset();
  const localDay = new Date(finishedMs - timezoneOffsetMinutes * 60000).toISOString().slice(0, 10);
  return {
    timestamp: finishedAt.toISOString(),
    mode: session.options.mode || "words",
    amount: Number(session.options.amount) || 25,
    language: typeof session.options.language === "string" ? session.options.language : "english",
    punctuation: session.options.punctuation === true,
    numbers: session.options.numbers === true,
    completion: state.completed ? "completed" : InputPolicy.completionFor(session.options.mode, session.options.amount, elapsed, "quick-ended"),
    metricsVersion: 1,
    elapsedMs: elapsed,
    localDay,
    timezoneOffsetMinutes,
    seed: session.seed,
    samples: Array.isArray(session.samples) ? session.samples.slice(0, 600) : [],
    characters: total,
    correct,
    errors: state.errorKeystrokes,
    uncorrectedErrors: state.errors,
    corrected: state.correctedErrors,
    corrections: state.corrections,
    ...metrics
  };
}

if (typeof module !== "undefined") module.exports = {create, key, finish};

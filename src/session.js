"use strict";

const Generator = typeof require !== "undefined" ? require("./generator.js") : globalThis.Generator;
const State = typeof require !== "undefined" ? require("./typing-state.js") : globalThis.TypingState;
const Metrics = typeof require !== "undefined" ? require("./metrics.js") : globalThis.Metrics;

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

function finish(session, now) {
  const state = session.state;
  const elapsed = Math.max(1, (state.endedAt ?? now) - (state.startedAt ?? now));
  const total = state.totalKeystrokes;
  const correct = Math.max(0, total - state.errorKeystrokes);
  const metrics = Metrics.summarize({correct, total, elapsedMs: elapsed, samples: session.samples});
  return {
    timestamp: new Date(now).toISOString(),
    mode: session.options.mode || "words",
    amount: Number(session.options.amount) || 25,
    seed: session.seed,
    characters: total,
    errors: state.errorKeystrokes,
    uncorrectedErrors: state.errors,
    corrected: state.correctedErrors,
    ...metrics
  };
}

if (typeof module !== "undefined") module.exports = {create, key, finish};

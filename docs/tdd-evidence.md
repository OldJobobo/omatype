# TDD evidence

Development used vertical RED → GREEN slices on Neuromancer with Node v24.19.0. Every RED was an expected missing artifact/module failure before production code was written.

| Slice | RED evidence | GREEN evidence |
| --- | --- | --- |
| Manifest | `ENOENT manifest.json`, 0/1 | 1/1 |
| Generator + corpus | `MODULE_NOT_FOUND src/generator.js`, 0/1 file | 2/2 |
| Typing state | `MODULE_NOT_FOUND src/typing-state.js`, 0/1 file | initial minimal implementation exposed a completion/backspace edge; corrected implementation 2/2 |
| Metrics | `MODULE_NOT_FOUND src/metrics.js`, 0/1 file | 2/2 |
| History normalization | `MODULE_NOT_FOUND src/history.js`, 0/1 file | 2/2 |
| Composed session | `MODULE_NOT_FOUND src/session.js`, 0/1 file | 1/1 |
| QML overlay/widget | `ENOENT OmaType.qml`, `BarWidget.qml`, `src/words.js`, 0/3 | Lifecycle, geometry, epoch timing, bounded IPC, keyboard filtering, interval sampling, timed-prompt extension, and bar contracts pass |
| Review regressions | Focused failures reproduced unbounded generation, corrected-error loss, cumulative charting, control input, Enter/Return mismatch, and stale lifecycle docs | All focused regressions and the full suite pass |
| Programming vocabularies | `MODULE_NOT_FOUND src/languages.js`, then missing settings/QML/history contracts | English plus 36 original programming packs, bounded registry validation, persisted selection, active-run snapshots, and 43/43 full-suite tests |
| Expanded settings model | New behavior, appearance, accessibility, and test-default expectations failed against the caret-only schema | Bounded allowlists, malformed-data fallback, immutable update/reset, and all settings-model tests pass |
| Componentized settings UI | `SettingsDrawer.qml` and `OptionRow.qml` source contracts initially failed because the components did not exist | Five navigable local sections, reusable rows, category reset, and config-scoped persistence contracts pass |
| Input policy + runtime display | `src/input-policy.js` and strict-space/stop-on-error/backspace/quick-end contracts initially failed; appearance runtime contracts then failed before wiring | Explicit policy decisions, stop-on-error telemetry, immutable run snapshots, timer/live metrics, typography, line count, highlighting, typed effects, scrolling, accessibility, and malformed-state rejection pass |
| Fail-closed release review | Malformed/oversized IPC, UTF-8 byte-cap, asynchronous config reload, and malformed input-policy probes reproduced blocking failures | Dedicated IPC policy, transactional compound validation, byte-accurate 4096-byte rejection, post-load preference normalization, hostile-state rejection, keyboard-accessible language/settings controls, responsive rows, and 61/61 full-suite tests |
| Release docs | `ENOENT README.md`, 0/1 | Install, lifecycle, controls, privacy, validation, and license contracts pass |

The final suite is rerun via `tests/run`; this table is a compact audit trail, not synthetic command output.

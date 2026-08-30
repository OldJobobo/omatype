# Changelog

All notable changes to OmaType are documented here.

## [Unreleased]

### Added

- A persistent, keyboard-first progress view with strict current-setup comparisons, paired net/raw pace charts, retained-result detail, historical interval curves, 90-day activity, streaks, totals, daily goals, and same-setup language comparisons.
- Confirmed selective deletion, confirmed history clearing, and local CSV export for retained runs.

### Changed

- Local history now uses schema v2, retaining 2,000 individual runs before conserving older activity, totals, comparable averages, and personal bests in compacted rollups.
- Results now persist effective test modifiers, completion reason, metrics version, elapsed time, local day, timezone offset, and bounded interval samples.
- Local persistence now uses bounded, no-follow descriptor reads and private atomic writes, rejecting symlinks on read, special files, oversized content, invalid UTF-8, and unsafe path components; settings from newer schemas remain untouched.

## [0.1.0] - 2026-08-28

### Added

- Schema-v1 overlay and bar-widget manifest for `jobo.omatype`.
- Original offline word corpus and seeded generator with punctuation/number modes.
- Typing state, metrics, session composition, and normalized local history.
- Monkeytype-inspired full-screen practice and result/chart surfaces.
- Settings/footer strip, focus mode, timer, and last-WPM bar widget.
- Dependency-free Node test suite and QML contracts.
- Live Quattro lifecycle, focus, timer, history, bar-widget, and visual-comparison validation.
- Bounded IPC options and generator allocation, corrected-mistake telemetry, interval-speed charting, lazy timed-prompt extension, printable Unicode filtering, and Enter/Return result controls.
- Offline English plus 36 original programming-language vocabulary packs, a persisted grid picker, fail-closed language normalization, active-test language snapshots, and language-attributed history.
- Componentized Test, Behavior, Display, Caret, and Access settings with bounded schema normalization, per-category reset, configuration-scoped persistence, immutable active-test snapshots, configurable input policies, timer/live metrics, typography, line count, highlighting, typed effects, focus controls, reduced motion, high contrast, and color/underline error indicators.
- Keyboard-first operation for every setup action and all 34 settings, including canonical Ctrl+R restart and Ctrl+Escape close, direct mode/length/punctuation/number shortcuts, complete settings traversal, owned language-grid navigation/activation, focus restoration, visible shortcut guidance, narrow-choice visibility, and quick-end precedence over the optional Enter restart alias.

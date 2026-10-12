# Changelog

All notable changes to OmaType are documented here.

## [Unreleased]

### Added

- The overlay header shows the running version next to the title, read from the manifest the host loaded.
- A keyboard guide with six built-in presets, next-character highlighting, keyboard-accessible layout and layer navigation, and a bounded declarative custom layout file that also ships the Engrammer Remnant layout as an optional example. It is off until `Ctrl+K` or the settings row turns it on.

## [0.2.2] - 2026-10-11

### Fixed

- A persistence helper that cannot start (for example a missing system Python) now reports a load or save failure instead of leaving the overlay waiting forever; the footer and bar tooltip show the helper's own error text.
- Escape and Ctrl+Escape close a cloned plugin: both entry points read their id from what the host injects instead of a hardcoded `jobo.omatype`.
- Changing an unrelated setting no longer reverts a one-shot IPC mode, length, or language while that test is on screen; only an external edit of the settings file re-syncs the setup.
- The Quickshell runtime tests silence unrelated Qt platform warnings so they pass on the Omarchy host.

### Changed

- The bar widget toggles the overlay through the bar's shell facade in-process, falling back to the `omarchy-shell` CLI, and reads only the newest run instead of normalizing the whole history document on every bar instance.
- The persistence helper sweeps temporaries abandoned by an interrupted write, resolves a symlinked `HOME` once before its no-follow walk, and names the offending directory in boundary errors.

## [0.2.1] - 2026-10-09

### Fixed

- Qualified Quattro's Commons imports so Qt 6.12's `Color` type no longer shadows the host theme singleton or leaves overlay colors undefined.
- Typing glyphs now use measured font advances and native rendering, with pixel-aligned word layout and caret stops instead of assuming every font has the same fixed character width.
- Glyph positions fall back safely while a new prompt awaits its matching layout, preventing transient undefined-position warnings.

## [0.2.0] - 2026-09-22

### Added

- A persistent, keyboard-first progress view with strict current-setup comparisons, paired net/raw pace charts, retained-result detail, historical interval curves, 90-day activity, streaks, totals, daily goals, and same-setup language comparisons.
- Confirmed selective deletion, confirmed history clearing, and local CSV export for retained runs.
- German, Spanish, French, Italian, Portuguese, and Dutch practice packs alongside English, with 500-word natural-language corpora and bundled attribution.

### Changed

- Local history now uses schema v2, retaining 2,000 individual runs before conserving older activity, totals, comparable averages, and personal bests in compacted rollups.
- Results now persist effective test modifiers, completion reason, metrics version, elapsed time, local day, timezone offset, and bounded interval samples.
- Local persistence now uses bounded, no-follow descriptor reads and private atomic writes, rejecting symlinks on read, special files, oversized content, invalid UTF-8, unsafe path components, and excessive history structures; settings from newer schemas remain untouched.
- Settings and history saves are revision-checked, conflicting history operations rebase onto the latest document, untrusted seed text is forced to plain rendering, and CSV export neutralizes spreadsheet-formula prefixes.
- The overlay now opens on the bar widget’s output or the currently focused Hyprland monitor instead of always targeting the first monitor, and `Ctrl+Alt+M` moves it to the next display.

### Fixed

- Character color bindings now handle uninitialized typing state safely, and new tests initialize that state before publishing their word delegates, preventing startup null-reference warning bursts (#1).

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

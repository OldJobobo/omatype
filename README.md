# OmaType

OmaType (`jobo.omatype`) is an original MIT-licensed, offline typing-practice plugin for Omarchy. It takes visual cues from the calm, distraction-free category of typing trainers without copying Monkeytype code, word data, or assets.

![OmaType typing interface](preview.png)

## Features

- Responsive full-screen overlay using the active Omarchy background, foreground, accent, muted, urgent, and typography tokens.
- Time tests: 15, 30, 60, or 120 seconds.
- Word tests: 10, 25, 50, or 100 words.
- Optional punctuation and numbers.
- Seeded deterministic generation from an original 229-word English list.
- A local picker with English plus 36 programming-language vocabularies, including Nix, Bash, Python, Rust, JavaScript, TypeScript, C/C++, Go, SQL, Zig, and more.
- Programming packs use original OmaType-curated keywords, operators, syntax terms, and common API identifiers; they do not copy Monkeytype dictionaries.
- Correct/error character state with monotonic keystroke, mistake, correction, and corrected-error telemetry; backspace repairs the display without erasing historical effort.
- WPM, raw WPM, accuracy, and consistency metrics plus a chart of discrete one-second interval speed.
- A compact bar widget showing the latest local result.
- Normalized, newest-first local history capped at 100 tests.
- A componentized five-section settings drawer for test defaults, input behavior, timer/live metrics, typography and line geometry, highlighting and typed-text effects, caret presentation, focus mode, reduced motion, contrast, and error indicators.
- Versioned, fail-closed preferences stored separately from history at `~/.config/omarchy/omatype-settings.json`; behavior and test preferences are snapshotted when a new test starts.

No account, telemetry, network request, copied Monkeytype source, or copied Monkeytype asset is used. History is local to `~/.local/state/omarchy/omatype-history.json`.

## Layout

- `manifest.json` — Quattro schema-v1 plugin manifest.
- `OmaType.qml` — full-screen overlay entry point.
- `BarWidget.qml` — bar widget entry point.
- `src/` — deterministic generator, typing state, metrics, session composition, history normalization, settings, centered layout, and the offline language-pack registry.
- `data/words-en.json` — original project word list.
- `tests/` — Node built-in tests and QML contract checks.

## Installation

Install the public repository with Omarchy's plugin manager:

```sh
omarchy plugin add https://github.com/OldJobobo/omatype.git --enable
```

OmaType requires the Omarchy Quattro shell. It has no third-party runtime, package-manager, account, network, telemetry, or cloud-service dependency.

For a local development checkout instead:

```sh
mkdir -p ~/.config/omarchy/plugins
ln -s /absolute/path/to/omatype ~/.config/omarchy/plugins/jobo.omatype
omarchy plugin validate ~/.config/omarchy/plugins/jobo.omatype
omarchy plugin enable jobo.omatype right
omarchy-restart-shell
```

## Removal

Remove the plugin safely through Omarchy:

```sh
omarchy plugin remove jobo.omatype
```

Removal does not delete the user's preferences or typing history. To erase those files too, the user may explicitly remove `~/.config/omarchy/omatype-settings.json` and `~/.local/state/omarchy/omatype-history.json` after uninstalling.

## Permissions and data

Like all Quattro plugins, OmaType runs unsandboxed with the current user's permissions inside `omarchy-shell`. OmaType uses that access only for its own local configuration and state files plus the host shell command that opens or closes its interface. It does not use the network, invoke a package manager, request elevated privileges, read credentials, or modify unrelated user configuration.

The manifest declares both entry points:

- overlay: `OmaType.qml`
- bar widget: `BarWidget.qml`

`OmaType.qml` owns the full-screen `PanelWindow` and exclusive typing focus. Quattro keeps the plugin instance alive and invokes its `open(payloadJson)` and `close()` functions. `BarWidget.qml` uses the supported `BarIconButton` contract and calls `bar.run(...)` to toggle `jobo.omatype` through `omarchy-shell`.

Open it directly with:

```sh
omarchy-shell shell toggle jobo.omatype '{}'
```

For pointer-free launch, assign that command to any collision-free global shortcut in the host's normal Omarchy/Hyprland keybinding configuration. OmaType deliberately does not claim a system-wide key during plugin installation; use Omarchy's keybinding list to choose one that does not replace an existing host action.

## Controls

- Type any printable character to begin.
- **Backspace** repairs the previous character.
- **Ctrl+R** always creates a fresh test and seed. The configurable quick-restart key can additionally use Tab, Escape, Enter, or be disabled.
- **Ctrl+Escape** always closes OmaType, even when Escape is assigned to quick restart. Plain **Escape** closes an open panel first; otherwise it follows the configured quick-restart behavior or closes the overlay.
- **Enter** starts the next test from results and can optionally end an active test early.
- **Ctrl+M** switches between time and word modes. **Ctrl+Up/Down** cycles the available test lengths. **Ctrl+P** and **Ctrl+N** toggle punctuation and numbers for future English tests.
- **Ctrl+,** opens or closes Test, Behavior, Display, Caret, and Access settings. The drawer focuses its first row immediately. Use **Ctrl+1** through **Ctrl+5** or **Ctrl+Left/Right** to change sections, and **Tab/Shift+Tab** or **Up/Down** to move through rows. Left/Right changes the focused value; **Enter/Space** advances it; **Home/End** jumps to the first/last row; **Page Up/Page Down** scrolls; **R** resets the current section; and **Escape** closes settings.
- **Ctrl+L** opens or closes the language picker. Use arrows or Tab/Shift+Tab to move, Home/End to jump, Page Up/Page Down to move by three rows, Enter/Space to select, and Escape to close.
- Every setup choice and settings value has a keyboard-only path. Pointer and accessibility actions invoke the same bounded operations.
- Programming vocabularies keep their syntax tokens intact, so the English punctuation/number transformations are disabled while one is selected.

## Development and validation

Requires Node.js 20 or newer; there are no npm dependencies.

```sh
tests/run
node -e 'for (const f of ["manifest.json", "data/words-en.json"]) JSON.parse(require("node:fs").readFileSync(f))'
git diff --check
```

QML runtime validation requires Qt 6, Quickshell, and the Quattro plugin host. Contract tests intentionally keep deterministic business logic testable without a compositor.

## License

MIT. See `LICENSE`.

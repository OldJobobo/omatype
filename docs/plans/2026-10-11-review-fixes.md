# Review fixes plan (2026-10-11)

Source: full plugin review against the Quattro host on Wintermute (Omarchy
shell v4.0.0-796). Headless suite passed (148/0/3 skipped); the ProgressView
Quickshell runtime test failed deterministically on the target host; the
running shell log had no OmaType warnings. Work happens on
`agent/review-fixes` in `~/Projects/omatype-worktrees/review-fixes`, one
commit per step, full gates before the PR.

## Steps

1. **Runtime tests pass on Wintermute.** Silence `qt.qpa.wayland.textinput`
   warnings via logging rules and force a UTF-8 locale in the spawn env of
   `tests/qml-runtime.test.js`. Keep the zero-warnings assertion.
2. **SecureFile failure path when the helper cannot start.** Detect
   `running` flipping false without `exited`, emit `loadFailed`/`saveFailed`,
   continue the queue. Add a `helperInterpreter` property (default
   `/usr/bin/python3`, contract-tested) so a fixture can exercise it. Surface
   helper error text in a persistent footer status in the overlay.
3. **No hardcoded plugin id.** Overlay derives `pluginId` from `manifest.id`;
   bar widget gains `moduleName` for host injection; literals remain only as
   fallbacks.
4. **Toggle through `bar.shell.toggle`** with `bar.run` as fallback. Update
   README and docs test.
5. **Cheap bar widget.** Clean only the first history entry instead of
   normalizing the document; drop the dead schema-1 branch. Defer a separate
   last-result file until measured.
6. **Own-save echoes must not resync setup.** Record the revision after each
   settings save and skip `loadSettings(true)` when the reload returns it.
   Clear on `close()`.
7. **Helper edge cases.** Sweep stale temp files after taking the lock,
   resolve a symlinked `HOME` with `realpath` before the no-follow walk,
   name the offending component in directory errors. Tests for each.
8. **Reinstall on Wintermute as a git checkout** (needs owner approval):
   remove, `omarchy plugin add ... --enable`, re-enable in `right`, then the
   graphical acceptance pass.
9. **Release 0.2.2.** Bump manifest and manifest test, CHANGELOG, evidence
   doc. Gates: `nix-shell --run 'tests/run'`, README JSON check,
   `git diff --check`, `omarchy plugin validate` and three runtime-test runs
   on Wintermute from a temp copy. Open the PR; the owner merges.

## Status

Updated as steps land; see the commit history on the branch.

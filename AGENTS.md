# Agent workflow

## Startup is the agent's responsibility

The user may launch Pi in `~/Projects/omatype` and describe only the task.
Agents handle branches, worktrees, development environments, and verification.
Do not ask users to repeat those setup steps in their prompts.

## Isolate each task

- Treat `~/Projects/omatype` and `main` as a read-only control checkout; never edit, commit, or push directly on main.
- Fetch origin, then create a fresh branch/worktree from current `origin/main` before editing:
  `git worktree add -b agent/<task> ~/Projects/omatype-worktrees/<task> origin/main`.
- Continue inside that worktree. One writer per task; never reuse a worktree for unrelated work or revert another agent's changes.
- Do not bypass repository hooks.

## Environment and verification

- On Neuromancer/NixOS, use the task's pinned `shell.nix`: `nix-shell --run 'tests/run'`. No global package installs or host changes.
- Until this setup lands on main, use `nix-shell ~/Projects/omatype-worktrees/neuromancer-pilot/shell.nix --run 'tests/run'` from the task worktree. Do not edit the pilot for unrelated tasks.
- The shell supplies Node and Python and sets `OMATYPE_TEST_PYTHON` for secure-helper tests. Do not change the application's `/usr/bin/python3` Omarchy contract merely to accommodate the development host.
- Run the complete `tests/run` suite, JSON validation documented in README, and `git diff --check` before reporting readiness. Report skips explicitly; headless success is not graphical acceptance.
- Run real Quickshell/Wayland and plugin-host validation on Wintermute for QML or UI changes. Request approval before changing the installed plugin, restarting its shell, or touching real user history/preferences. Use isolated fixtures where possible.

## Delivery and cleanup

- Commit on the task branch; publish changes through a PR when requested. Never force-push protected branches.
- Record verification commands/results and remaining runtime risks.
- Only the human owner merges or closes PRs.
- Remove worktrees only after merge or explicit abandonment, and only after checking for uncommitted/unpushed work.
- Neuromancer's daily development backup includes the control repository, all `omatype-worktrees`, and Pi sessions. This local recovery copy is not a substitute for Git checkpoints or off-host backups.

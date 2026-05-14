
// This file has been removed as Nx Cloud CI is not used.

1. Report to user: CI failed with no tasks recorded
2. Retry: `git commit --allow-empty -m "chore: retry ci [monitor-ci]"` + push, enter wait mode
3. If retry also returns `cipe_no_tasks`: exit with failure

## Fix Action Flows

### Apply via MCP

Spawn UPDATE_FIX subagent with `APPLY`. New CI Attempt spawns automatically. No local git ops.

### Apply Locally + Enhance Flow

1. `nx-cloud apply-locally <shortLink>` (sets state to `APPLIED_LOCALLY`)
2. Enhance code to fix failing tasks
3. Run failing tasks to verify
4. If still failing → run `ci-state-update.mjs gate --gate-type local-fix`. If not allowed, commit current state and push (let CI be final judge). Otherwise loop back to enhance.
5. If passing → commit and push, enter wait mode

### Reject + Fix From Scratch Flow

1. Run `ci-state-update.mjs gate --gate-type local-fix`. If not allowed, print message and exit.
2. Spawn UPDATE_FIX subagent with `REJECT`
3. Fix from scratch locally
4. Commit and push, enter wait mode

## Environment vs Code Failure Recognition

When any local fix path runs a task and it fails, assess whether the failure is a **code issue** or an **environment/tooling issue** before running the gate script.

**Indicators of environment/tooling failures** (non-exhaustive): command not found / binary missing, OOM / heap allocation failures, permission denied, network timeouts / DNS failures, missing system libraries, Docker/container issues, disk space exhaustion.

When detected → bail immediately without running gate (no budget consumed). Report that the failure is an environment/tooling issue, not a code bug.

**Code failures** (compilation errors, test assertion failures, lint violations, type errors) are genuine candidates for local fix attempts and proceed normally through the gate.

## Git Safety

- Stage specific files by name — `git add -A` or `git add .` risks committing the user's unrelated work-in-progress or secrets

## Commit Message Format

```bash
git commit -m "fix(<projects>): <brief description>

Failed tasks: <taskId1>, <taskId2>
Local verification: passed|enhanced|failed-pushing-to-ci"
```

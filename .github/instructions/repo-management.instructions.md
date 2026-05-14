---
description: 'Use when working with git commits, releases, versioning, CI/CD, publishing, or changelog generation. Covers commit conventions, release workflow, and CI pipeline.'
---

# Repository Management

## Commit Conventions

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/) with **sentence-case** subjects.

Enforced by commitlint (`.commitlintrc.js`) + husky `commit-msg` hook.

Format: `type(scope): Subject in sentence case`

Examples:

```
feat(core): Add pitch bend support
fix(core): Correct overlap calculation in Stretch
chore: Update dependencies
docs(demo): Improve slider labels
```

Valid types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `ci`, `build`, `revert`

When the user asks Copilot to "stage and commit", Copilot must:

1. Stage the intended changes.
2. Create a commit using the Conventional Commits format above.
3. Use a sentence-case subject aligned with the repository configuration.
4. Select an appropriate type (and scope when useful) based on the actual changes.

## Release Workflow

1. Commits land on `master` following conventional commit format
2. `pnpm release` runs `nx release` — analyzes conventional commits, bumps version, generates per-project changelog, creates git tag
3. `nx release publish` publishes `@soundtouchjs/core` and `@soundtouchjs/audio-worklet` to npm
4. CI pushes tags and publishes automatically

Version bump rules (conventional commits):

- `feat` → minor bump
- `fix` → patch bump
- Breaking change (`BREAKING CHANGE:` footer or `!` after type) → major bump

Release config lives in `nx.json` under `"release"`.

## CI Pipeline (`.github/workflows/main.yml`)

Two jobs triggered by different events:

### `test` — runs on pull requests to `master`

1. Checkout → setup pnpm → install (`--frozen-lockfile`)
2. Typecheck → Build → Test

### `release` — runs on push to `master` (PR merge)

1. Checkout (full history) → setup pnpm → install (`--frozen-lockfile`)
2. Build
3. Create release (`pnpm release`) → Push tags → Publish to npm (`pnpm nx release publish`)

Uses whatever Node version ships with `ubuntu-latest` — no explicit Node setup step.

## Git Hooks (husky)

| Hook         | Action                      | CI Behavior           |
| ------------ | --------------------------- | --------------------- |
| `commit-msg` | `pnpm commitlint --edit $1` | Runs                  |
| `pre-commit` | `pnpm typecheck && pnpm lint` | Skipped (`$CI` guard) |

## Package Publishing

Only `packages/core` is published. The `"files"` field in its `package.json` controls what ships:

- `dist/` (compiled JS + declarations)
- `README.md`
- `LICENSE`

### Stage and Commit

In local development, this repository uses a Husky pre-commit hook to enforce linting, typechecking, and other tasks before commits are finalized. When staging and committing changes, Copilot must:

1. Wait for the pre-commit hook tasks to complete.
2. Summarize the output of the pre-commit hook tasks, including any errors or warnings encountered.
3. Ensure that the commit is finalized only if all pre-commit tasks pass successfully.

If any pre-commit tasks fail, Copilot must report the failure and provide guidance on resolving the issues before retrying the commit.

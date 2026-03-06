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

## Release Workflow

1. Commits land on `master` following conventional commit format
2. `pnpm release` runs `nx release` — analyzes conventional commits, bumps version, generates per-project changelog, creates git tag
3. `nx release publish` publishes `@soundtouchjs/core` to npm
4. CI pushes tags and publishes automatically

Version bump rules (conventional commits):

- `feat` → minor bump
- `fix` → patch bump
- Breaking change (`BREAKING CHANGE:` footer or `!` after type) → major bump

Release config lives in `nx.json` under `"release"`.

## CI Pipeline (`.github/workflows/main.yml`)

Triggers on push to `master`. Steps:

1. Checkout → setup pnpm (reads `packageManager` field) → install (`--frozen-lockfile`)
2. Typecheck → Build
3. Create release (`pnpm release`) → Push tags → Publish to npm (`pnpm nx release publish`)

Uses whatever Node version ships with `ubuntu-latest` — no explicit Node setup step.

## Git Hooks (husky)

| Hook         | Action                      | CI Behavior           |
| ------------ | --------------------------- | --------------------- |
| `commit-msg` | `pnpm commitlint --edit $1` | Runs                  |
| `pre-commit` | `pnpm typecheck`            | Skipped (`$CI` guard) |

## Package Publishing

Only `packages/core` is published. The `"files"` field in its `package.json` controls what ships:

- `dist/` (compiled JS + declarations)
- `README.md`
- `LICENSE`

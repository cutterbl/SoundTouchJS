# Copilot Workspace Instructions

## Local Environment

- Operating system: macOS
- Preferred shell: zsh
- `rg` (ripgrep) is not available in this environment

## Terminal Command Guidance

- Use `zsh`-compatible commands and syntax.
- Do not assume `rg` exists.
- For file discovery, use alternatives such as:
  - `find . -type f`
  - `ls -R`
- For text search, use alternatives such as:
  - `grep -R "pattern" .`
  - `grep -Rin "pattern" .`

## Behavior Expectation

- Always adapt command suggestions and scripts to this macOS + zsh setup.
- If a command example would normally use `rg`, replace it with `find`/`grep` equivalents.
- Keep documentation synchronized with code changes. When behavior, public APIs, defaults, or workflows change, update the relevant README/docs files in the same change.

## Git Commit Requests

- **Never commit directly to `master`.** All commits must go on a branch. If not already on a branch, create one before staging or committing anything.
- When the user asks to "stage and commit", stage all current changes by default unless the user explicitly scopes which changes to include, and create a commit using Conventional Commits format.
- The commit subject must be sentence-case and match repository conventions (for example: `feat(core): Add pitch bend support` or `chore: Update lint configuration`).
- Do not use vague commit subjects; choose the type/scope/subject based on the actual staged changes.

## "Update Everything" Dependency Workflow

When the user asks to "update everything" (or equivalent phrasing for workspace-wide dependency updates), run this process end-to-end:

1. Create and switch to a new branch named `fix/depUpdates[MMDDYY]` before making changes.
2. Upgrade dependencies using latest versions first; only regress specific packages if necessary after confirming a real compatibility failure.
3. Upgrade in this order:
  - Nx first using Nx-recommended CLI migration flow.
  - Storybook second using Storybook-recommended CLI upgrade flow.
  - Remaining workspace dependencies/devDependencies/peerDependencies afterward.
4. Apply any required config or script updates needed to keep CI/CD behavior intact.
5. Run full validation checks and ensure they pass:
  - typecheck
  - lint
  - build
  - test
  - coverage threshold checks
6. Clean up temporary artifacts created during the upgrade process.
7. Before staging/committing, explicitly ask the user to confirm they verified the final result.
8. Only after user confirmation, stage and commit all intended changes using a Conventional Commit message.

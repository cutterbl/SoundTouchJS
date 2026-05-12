# SoundTouchJS — Claude Code Instructions

## Code change requirements

Every code change — regardless of size — must include all three of the following:

### 1. JSDoc comments

All exported functions, classes, interfaces, types, and their members must carry JSDoc-style comments. Follow the patterns already in the codebase:

- Class-level `@remarks` for non-obvious behavior.
- `@param` and `@returns` for every public method.
- `@example` blocks where the usage pattern is not self-evident.
- Do **not** document the obvious (`@param value — the value`). Write only what a reader cannot deduce from the name and type alone.
- Internal/private members do not require JSDoc unless the *why* is genuinely non-obvious.

### 2. Tests

All changes must be accompanied by updated or new tests:

- Test files live alongside source as `*.spec.ts`.
- Use Vitest (`describe` / `it` / `expect`). Mock with `vi.mock` / `vi.fn` / `vi.stubGlobal`.
- Tests must exercise the changed behavior and any edge cases introduced.
- Remove tests that validate behavior that was deleted.
- Coverage targets: **branches ≥ 80 %**, **functions ≥ 90 %**. Do not regress below these thresholds.
- Run `pnpm --filter <package> exec vitest run` to verify before reporting a task complete.

### 3. Documentation

Update *all* of the following that are affected by the change:

- **README.md** — if the public API, install steps, or usage examples change.
- **Storybook stories** (`storybook/src/stories/**/*.stories.tsx`) — add, update, or remove stories to reflect the current API. Do not leave stories that demonstrate removed or changed APIs.
- **Storybook MDX docs** (`storybook/src/docs/**/*.mdx`) — keep API tables, parameter lists, and prose in sync with the actual code.

If a piece of documentation cannot be updated in the same PR (e.g., an external site), call it out explicitly.

## Commit discipline

This project uses **Conventional Commits**. Use the appropriate prefix:

| Prefix | When |
|--------|------|
| `feat` | new public API or user-visible feature |
| `fix` | bug fix |
| `perf` | performance improvement |
| `refactor` | internal restructuring with no behavior change |
| `docs` | documentation only |
| `test` | test only |
| `chore` | tooling, deps, config |

`feat` triggers a **minor** version bump; `fix` / `perf` / etc. trigger a **patch** bump; `docs` / `style` / `test` / `chore` cause **no** version bump.

## Project conventions

- **ESM-only, TypeScript 5.9 strict, ES2024 target.** No CommonJS output.
- **Zero runtime dependencies in `@soundtouchjs/core`.** Do not add any.
- All packages build with `pnpm build` via the Nx task graph.
- The AudioWorklet processor bundles core inline — keep the bundle size in mind when adding to core.
- Public API changes in `@soundtouchjs/audio-worklet` or `@soundtouchjs/core` require matching updates to interpolation-strategy packages if the change touches the strategy interface.

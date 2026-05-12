# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
# Build all packages
pnpm build                          # nx run-many -t build

# Run all tests
pnpm test                           # nx run-many -t test

# Typecheck all packages
pnpm typecheck                      # nx run-many -t typecheck

# Single-package commands (use Nx project name)
pnpm nx build core
pnpm nx test core
pnpm nx typecheck audio-worklet

# Run a single test file
pnpm nx test core -- --reporter=verbose --testPathPattern=Stretch

# Generate consolidated coverage report (branches ≥ 80%, functions ≥ 90%)
pnpm coverage:summary

# Start Storybook dev server
pnpm nx storybook storybook

# Start demo app dev server
pnpm dev                            # nx dev demo  (Vite on port 8080)

# Format all files
pnpm prettier

# Release (from master only)
pnpm release                        # nx release
```

## Architecture

**Monorepo**: Nx + pnpm workspaces. `packages/*` holds all published packages; `apps/demo` is the dev sandbox; `storybook/` is the documentation site.

**Processing pipeline** (`@soundtouchjs/core`): `SoundTouch` chains two DSP stages — `RateTransposer` (pitch/rate) and `Stretch` (WSOLA time-stretch). Stage order flips at runtime based on pitch direction to minimize artifacts. All samples are interleaved stereo (`L, R, L, R, …`). The `StretchPipe` interface allows the `Stretch` stage to be swapped out (e.g., for a phase vocoder).

**AudioWorklet integration** (`@soundtouchjs/audio-worklet`): `SoundTouchNode` (main thread) + `SoundTouchProcessor` (render thread). The processor is bundled separately by Vite into `.dist/soundtouch-processor.js` with `@soundtouchjs/core` resolved to local source so it is fully self-contained. Message passing (`port.postMessage`) is the only communication channel between threads. Three k-rate AudioParams: `pitch`, `pitchSemitones`, `playbackRate`.

**Worklet processor pattern**: Every worklet package (audio-worklet, phase-vocoder-worklet, formant-correction-worklet) has a two-step build defined in `project.json`: `tsc --build tsconfig.lib.json` (library) then `vite build` (processor bundle). The `vite.config.ts` uses source-level aliases to inline all dependencies into one ES module file. The `tsconfig.processor.json` compiles only `src/processor.ts` and excludes declaration output.

**Interpolation strategy plugins**: `RateTransposer` resolves its kernel through `interpolationStrategyRegistry.ts`. Strategies are registered objects with `id`, `kernel`, `defaultParams`, `normalizeParams`, and `applyParams`. Five built-in strategies: `lanczos` (default), `linear`, `hann`, `blackman`, `kaiser`. Each lives in its own `@soundtouchjs/interpolation-strategy-*` package, registered at startup via `registerXxxStrategy({ registerInterpolationStrategy })`. Strategy packages have no `project.json` — Nx auto-detects build from `tsconfig.lib.json`.

**AudioWorklet test setup** (`packages/audio-worklet/src/test-setup.ts`): stubs `AudioWorkletNode` globally via `vi.stubGlobal` so processor and node specs run in Node/jsdom without a browser.

**Nx target auto-detection**:
- `tsconfig.lib.json` present → Nx `@nx/js/typescript` plugin creates `build` and `typecheck` targets
- `vitest.config.ts` present → Nx `@nx/vite/plugin` creates `test` target
- Non-standard builds → explicit `project.json` with `nx:run-commands` executor

**`tsconfig.base.json`** sets `target: ES2024`, `module: ESNext`, `moduleResolution: bundler`, strict mode, and path aliases for all workspace packages.

---

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
- Run `pnpm nx test <package>` to verify before reporting a task complete.

### 3. Documentation

Update *all* of the following that are affected by the change:

- **README.md** — if the public API, install steps, or usage examples change.
- **Storybook stories** (`storybook/src/stories/**/*.stories.tsx`) — add, update, or remove stories to reflect the current API. Do not leave stories that demonstrate removed or changed APIs.
- **Storybook MDX docs** (`storybook/src/docs/**/*.mdx`) — keep API tables, parameter lists, and prose in sync with the actual code.

If a piece of documentation cannot be updated in the same PR (e.g., an external site), call it out explicitly.

## Commit discipline

This project uses **Conventional Commits**. Subjects must be sentence-case. Use the appropriate prefix:

| Prefix | When | Version bump |
|--------|------|--------------|
| `feat` | New public API or user-visible feature | minor |
| `feat!` / `BREAKING CHANGE:` | Removes or changes existing public API | major |
| `fix` | Bug fix | patch |
| `perf` | Performance improvement | patch |
| `refactor` | Internal restructuring, no behavior change | patch |
| `docs` | Documentation only | none |
| `test` | Test only | none |
| `chore` | Tooling, deps, config | patch |

## Project conventions

- **ESM-only, TypeScript 5.9 strict, ES2024 target.** No CommonJS output.
- **Zero runtime dependencies in `@soundtouchjs/core`.** Do not add any.
- All packages build with `pnpm build` via the Nx task graph.
- The AudioWorklet processor bundles core inline — keep bundle size in mind when adding to core.
- New worklet packages require `project.json` (custom tsc+vite build), `tsconfig.lib.json`, `tsconfig.processor.json`, `vite.config.ts` (with source alias for `@soundtouchjs/core`), and `vitest.config.ts`.
- Public API changes in `@soundtouchjs/audio-worklet` or `@soundtouchjs/core` require matching updates to interpolation-strategy packages if the change touches the strategy interface.
- Adding a new published package: add it to `nx.json release.projects`.

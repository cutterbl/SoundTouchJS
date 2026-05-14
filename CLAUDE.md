# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Never open responses with filler phrases like "Great question!", "Of course!", "Certainly!", "Absolutely!", "Sure!", or similar warmups.

Start every response with the actual answer.
No preamble, no acknowledgment of the question.
Just the information.

If you are uncertain about any fact, statistic, date, quote, or piece of information, say so explicitly before including it.

"I'm not certain about this" is always better than presenting a guess as a fact.

Never fill gaps in your knowledge with plausible-sounding information.
When in doubt, say so.

Match response length to task complexity.

Simple questions get direct, short answers.
Complex tasks get full, detailed responses.

Never compress or summarize work that requires real depth.
Never pad responses with restatements of the question or closing sentences that repeat what you just said.

Before making any change that significantly alters content I've already created (rewriting sections, removing paragraphs, restructuring the flow, changing tone), stop completely.

Describe exactly what you're about to change and why.
Wait for my confirmation before proceeding.

"I think this would be better" is not permission to change it.

Only change what I specifically asked you to change.

Do not rewrite, rephrase, restructure, or "improve" anything I didn't ask about, even if you think it would be better.

If you notice something that could be improved elsewhere, mention it at the end of your response.
Do not touch it unless I explicitly ask you to.

After completing any editing or writing task, always end with a brief summary:

- What was changed: [description]
- What was left untouched: [if relevant]
- What needs my attention: [anything requiring a decision or review]

Keep it short. This is a status update, not a recap of everything you just did.

Maintain a file called MEMORY.md. After any significant decision, about direction, format, content, approach, or strategy, add an entry:

## [Date], [Decision]

**What was decided:** [the choice made]
**Why:** [the reasoning]
**What was rejected:** [alternatives considered and why they were ruled out]

Read MEMORY.md at the start of every session before doing anything. Never contradict a logged decision without flagging it first.

Only modify files, functions, and lines of code directly and specifically related to the current task.

Do not refactor, rename, reorganize, reformat, or "improve" anything I did not explicitly ask you to change.

If you notice something worth fixing elsewhere, mention it in a note.
Do not touch it. Ever.

Before deleting any file, overwriting existing code, dropping database records, removing dependencies, or making any change that cannot be trivially undone, stop completely. List exactly what will be affected. Ask for explicit confirmation. Only proceed after I say yes in the current message.

The following actions require explicit in-session confirmation before executing, no exceptions:

- Deploying or pushing to any environment (staging, production, etc.)
- Running migrations or schema changes on any database
- Sending any email, message, or external API call
- Executing any command with irreversible external side effects

"You mentioned this earlier" is not confirmation. I must say yes in the current message.

Tech stack, always use these, never suggest alternatives unless I ask:

- Language(s): ES2024, Typescript
- Package manager: pnpm
- Testing: Vitest
- Linting / formatting: ESLint, Prettier

If something in the stack seems like the wrong tool, flag it, but use it anyway unless I say otherwise.

After completing any coding task, always end with:

- Files changed: [list every file touched]
- What was modified: [one line per file]
- Files intentionally not touched: [if relevant]
- Follow-up needed: [anything requiring my attention or a decision]

Keep it short. This is a status update, not a recap.

1. Ask, don't assume. If something is unclear or underspecified, ask before writing a single line. Never make silent assumptions about intent, architecture, or requirements.

2. Simplest solution first. Always implement the simplest thing that could work. Do not add abstractions, layers, or flexibility that weren't explicitly requested.

3. Don't touch unrelated code. If a file or function is not directly part of the current task, do not modify it, even if you think it could be improved.

4. Flag uncertainty explicitly. If you are not confident about an approach, a library's behavior, or a technical detail, say so before proceeding. Confidence without certainty causes more damage than admitting a gap.

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
- Internal/private members do not require JSDoc unless the _why_ is genuinely non-obvious.

### 2. Tests

All changes must be accompanied by updated or new tests:

- Test files live alongside source as `*.spec.ts`.
- Use Vitest (`describe` / `it` / `expect`). Mock with `vi.mock` / `vi.fn` / `vi.stubGlobal`.
- Tests must exercise the changed behavior and any edge cases introduced.
- Remove tests that validate behavior that was deleted.
- Coverage targets: **branches ≥ 80 %**, **functions ≥ 90 %**. Do not regress below these thresholds.
- Run `pnpm nx test <package>` to verify before reporting a task complete.

### 3. Documentation

Update _all_ of the following that are affected by the change:

- **README.md** — if the public API, install steps, or usage examples change.
- **Storybook stories** (`storybook/src/stories/**/*.stories.tsx`) — add, update, or remove stories to reflect the current API. Do not leave stories that demonstrate removed or changed APIs.
- **Storybook MDX docs** (`storybook/src/docs/**/*.mdx`) — keep API tables, parameter lists, and prose in sync with the actual code.

If a piece of documentation cannot be updated in the same PR (e.g., an external site), call it out explicitly.

## Commit discipline

This project uses **Conventional Commits**. Subjects must be sentence-case. Use the appropriate prefix:

| Prefix                       | When                                       | Version bump |
| ---------------------------- | ------------------------------------------ | ------------ |
| `feat`                       | New public API or user-visible feature     | minor        |
| `feat!` / `BREAKING CHANGE:` | Removes or changes existing public API     | major        |
| `fix`                        | Bug fix                                    | patch        |
| `perf`                       | Performance improvement                    | patch        |
| `refactor`                   | Internal restructuring, no behavior change | patch        |
| `docs`                       | Documentation only                         | none         |
| `test`                       | Test only                                  | none         |
| `chore`                      | Tooling, deps, config                      | patch        |

## Project conventions

- **ESM-only, TypeScript 5.9 strict, ES2024 target.** No CommonJS output.
- **Zero runtime dependencies in `@soundtouchjs/core`.** Do not add any.
- All packages build with `pnpm build` via the Nx task graph.
- The AudioWorklet processor bundles core inline — keep bundle size in mind when adding to core.
- New worklet packages require `project.json` (custom tsc+vite build), `tsconfig.lib.json`, `tsconfig.processor.json`, `vite.config.ts` (with source alias for `@soundtouchjs/core`), and `vitest.config.ts`.
- Public API changes in `@soundtouchjs/audio-worklet` or `@soundtouchjs/core` require matching updates to interpolation-strategy packages if the change touches the strategy interface.
- Adding a new published package: add it to `nx.json release.projects`.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

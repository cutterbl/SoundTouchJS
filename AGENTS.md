# SoundTouchJS Monorepo

## Local Environment

- OS: macOS
- Shell: zsh
- `rg` (ripgrep) is not installed
- Prefer `find` and `grep` when searching files/content

## Architecture

Nx monorepo with pnpm workspaces and TypeScript project references.

```
packages/core/   → @soundtouchjs/core (publishable library)
apps/demo/       → Development demo app (private, Vite dev server)
```

- **Library build**: TSC via `@nx/js/typescript` plugin (inferred from `tsconfig.lib.json`)
- **Demo build**: Vite via `@nx/vite/plugin` (inferred from `index.html`)
- **Task orchestration**: Nx handles dependency ordering — `build` depends on `^build`

## Code Style

- TypeScript, strict mode, ES2024 target, ESNext modules
- Module resolution: `bundler`
- ESM only (`"type": "module"` in all package.json files)
- Prettier with single quotes (see `.prettierrc`)
- No default exports from core library modules — use named exports in `index.ts`
- Prefer `import type` for type-only imports

## Build and Test

```sh
pnpm install              # Install all workspace dependencies
pnpm build                # Build all projects (nx run-many -t build)
pnpm typecheck            # Typecheck all projects
pnpm dev                  # Start demo dev server (Vite on port 8080)
pnpm prettier             # Format all files
```

Test execution rule:

- Always run Vitest with `--run` (never watch mode), e.g. `pnpm exec vitest --run`.

Individual project commands:

```sh
pnpm nx build core        # Build the library (TSC → packages/core/.dist/)
pnpm nx build demo        # Build the demo app (Vite → apps/demo/dist/)
pnpm nx dev demo          # Dev server with HMR
```

Package build output convention:

- Publishable packages build to `.dist/` (dot-prefixed) and publish ESM outputs from there.

## Conventions

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) with **sentence-case** subjects, enforced by commitlint + husky
- Releases via `nx release` — bumps version, generates changelog, tags, and publishes
- The demo app resolves `@soundtouchjs/core` to source (not dist) during development via a Vite alias
- Workspace dependency uses `"workspace:*"` protocol (pnpm)
- CI runs on GitHub Actions (`.github/workflows/main.yml`)
- Pre-commit hook runs typecheck and lint (skipped in CI via `$CI` env var)
- Keep docs up to date with code changes: update affected README/docs files whenever public behavior, APIs, defaults, or workflows are changed

## Do Not

- Do not add comments or docstrings to code unless the logic is non-obvious
- Do not use CommonJS (`require`/`module.exports`) anywhere
- Do not use `any` type — use `unknown` with narrowing or proper generics
- Do not add dependencies to the core library — it has zero runtime dependencies
- Do not commit `.dist/`, `dist/`, `.nx/`, or `*.tsbuildinfo` files

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

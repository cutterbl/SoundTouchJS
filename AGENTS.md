# SoundTouchJS Monorepo

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

Individual project commands:

```sh
pnpm nx build core        # Build the library (TSC → packages/core/dist/)
pnpm nx build demo        # Build the demo app (Vite → apps/demo/dist/)
pnpm nx dev demo          # Dev server with HMR
```

## Conventions

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) with **sentence-case** subjects, enforced by commitlint + husky
- Releases via `nx release` — bumps version, generates changelog, tags, and publishes
- The demo app resolves `@soundtouchjs/core` to source (not dist) during development via a Vite alias
- Workspace dependency uses `"workspace:*"` protocol (pnpm)
- CI runs on GitHub Actions (`.github/workflows/main.yml`)
- Pre-commit hook runs typecheck (skipped in CI via `$CI` env var)

## Do Not

- Do not add comments or docstrings to code unless the logic is non-obvious
- Do not use CommonJS (`require`/`module.exports`) anywhere
- Do not use `any` type — use `unknown` with narrowing or proper generics
- Do not add dependencies to the core library — it has zero runtime dependencies
- Do not commit `dist/`, `.nx/`, or `*.tsbuildinfo` files

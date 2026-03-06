---
description: 'Use when writing or modifying TypeScript files. Covers type safety rules, module conventions, and patterns specific to this codebase.'
applyTo: '**/*.ts'
---

# TypeScript Standards

- Target: ES2024, module: ESNext, moduleResolution: bundler
- Strict mode enabled — do not use `@ts-ignore` or `@ts-expect-error` without justification
- No `any` — use `unknown` with type narrowing, or define proper interfaces
- Use `import type { ... }` for type-only imports
- Use `export type` for re-exporting types from `index.ts`
- Prefer interfaces for object shapes; use type aliases for unions, intersections, and mapped types
- Use `readonly` for properties that should not be reassigned after construction
- Numeric constants used in audio processing (buffer sizes, overlap factors) should be typed as `number`, not magic-number enums
- Web Audio API types come from the DOM lib — no additional `@types` packages needed

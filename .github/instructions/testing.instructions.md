---
description: 'Use when creating, modifying, or reviewing unit tests. Covers test file conventions, mocking patterns, and structure for Vitest specs.'
applyTo: '**/*.spec.ts'
---

# Unit Testing

## Framework and Config

- Vitest is the test runner — import `describe`, `it`, `expect`, `vi` from `vitest`
- Per-project config lives in each project's `vitest.config.ts`
- Run all tests: `pnpm test` (alias for `nx run-many -t test`)
- Run one project: `pnpm nx test core`

## File Naming and Location

- Test files use the `*.spec.ts` naming convention (not `*.test.ts`)
- Co-locate specs next to the source file they test: `src/Foo.spec.ts` tests `src/Foo.ts`
- One spec file per source module — match the filename exactly

## Structure

- Top-level `describe` block named after the module or class under test
- Nested `describe` blocks for methods, getters/setters, or logical groups
- Use `it` (not `test`) with descriptive present-tense labels
- Import the module under test with a `.js` extension (ESM resolution)

```ts
import { describe, it, expect } from 'vitest';
import MyModule from './MyModule.js';

describe('MyModule', () => {
  describe('someMethod', () => {
    it('returns the expected value', () => {
      // ...
    });
  });
});
```

## Mocking

- Use `vi.fn()` for mock functions and `vi.spyOn()` to spy on existing methods
- Web Audio API types (`BaseAudioContext`, `AudioBuffer`, `ScriptProcessorNode`, `AudioProcessingEvent`) are not available in Node — create typed mock objects cast via `as unknown as T`
- Define mock factory functions (e.g. `createMockAudioContext()`, `createMockAudioBuffer()`) at the top of the spec file for reuse across tests
- Keep mocks minimal — only implement the properties and methods the code under test actually uses
- Prefer spying on real objects (`vi.spyOn(filter, 'extract')`) over replacing entire modules when the real implementation is safe to run

## Assertions

- Prefer specific matchers: `toBe`, `toEqual`, `toBeCloseTo`, `toBeGreaterThan`, `toHaveBeenCalledWith`
- Use `toBeCloseTo` for floating-point comparisons in audio processing code
- Use `not.toThrow()` to verify constructors and setters accept valid input
- Use `toThrow()` or `toThrowError()` for expected error paths

## What to Test

- Constructor initialization and default values
- Public getters and setters (including side effects)
- Core processing logic (e.g. `extract`, `process`, `putSamples`)
- Edge cases: zero-length buffers, boundary values, empty input
- Error paths: invalid arguments, out-of-range values
- Event registration and removal (for classes like `PitchShifter`)

## What Not to Test

- Private implementation details — test through the public API
- Third-party library internals
- Type-level correctness (that's the compiler's job)

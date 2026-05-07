# resolveInterpolationStrategy

## Import

```ts
import { resolveInterpolationStrategy } from '@soundtouchjs/core';
```

## Purpose

Resolves a strategy option to either a concrete interpolation kernel or a built-in base strategy id.

## Signature

```ts
resolveInterpolationStrategy(
  strategy?: string | { id: string },
): BuiltInInterpolationStrategy | InterpolationKernel
```

## Behavior

- Returns a kernel function when strategy registration includes `kernel`.
- Returns a built-in strategy id otherwise.
- Throws for unknown ids.

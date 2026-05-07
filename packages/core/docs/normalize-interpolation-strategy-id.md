# normalizeInterpolationStrategyId

## Import

```ts
import { normalizeInterpolationStrategyId } from '@soundtouchjs/core';
```

## Purpose

Normalizes an interpolation strategy option to a validated strategy id.

## Signature

```ts
normalizeInterpolationStrategyId(strategy?: string | { id: string }): string
```

## Behavior

- Uses the active strategy when `strategy` is omitted.
- Throws for unknown ids.

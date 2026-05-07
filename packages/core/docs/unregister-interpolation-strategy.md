# unregisterInterpolationStrategy

## Import

```ts
import { unregisterInterpolationStrategy } from '@soundtouchjs/core';
```

## Purpose

Removes a previously registered non-built-in interpolation strategy.

## Signature

```ts
unregisterInterpolationStrategy(strategyId: string): boolean
```

## Behavior

- Returns `false` when strategy id is unknown or built-in.
- Returns `true` when removal succeeds.
- Resets active strategy to `lanczos8` if the removed strategy was active.

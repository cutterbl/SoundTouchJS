# setActiveInterpolationStrategy

## Import

```ts
import { setActiveInterpolationStrategy } from '@soundtouchjs/core';
```

## Purpose

Sets the process-wide active interpolation strategy.

## Signature

```ts
setActiveInterpolationStrategy(strategy: string | { id: string }): void
```

## Behavior

- Validates that the target strategy is registered.
- Throws an error for unknown ids.

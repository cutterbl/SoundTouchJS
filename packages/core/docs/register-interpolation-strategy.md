# registerInterpolationStrategy

## Import

```ts
import { registerInterpolationStrategy } from '@soundtouchjs/core';
```

## Purpose

Registers a custom interpolation strategy in the process-wide registry.

## Signature

```ts
registerInterpolationStrategy(registration: InterpolationStrategyRegistration): void
```

## Behavior

- Adds or replaces a strategy by id.
- Uses `registration.baseStrategy ?? 'lanczos8'` when no kernel is provided.
- Marks the new strategy id as active.

## Notes

- Use unique ids to avoid accidental replacement.
- Strategy ids are shared process-wide.

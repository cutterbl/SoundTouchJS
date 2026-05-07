# listInterpolationStrategies

## Import

```ts
import { listInterpolationStrategies } from '@soundtouchjs/core';
```

## Purpose

Returns all registered strategy ids in sorted order.

## Signature

```ts
listInterpolationStrategies(): readonly string[]
```

## Notes

- Sorting is lexicographic.
- Includes built-ins and custom registrations.

# @cxing/interpolation-strategy-linear

Linear interpolation strategy plugin for SoundTouchJS.

## Usage

```ts
import { registerInterpolationStrategy, SoundTouch } from '@soundtouchjs/core';
import { registerLinearStrategy } from '@cxing/interpolation-strategy-linear';

registerLinearStrategy({ registerInterpolationStrategy });

const st = new SoundTouch({
  interpolationStrategy: 'linear',
});
```

## Related docs

- Core interpolation registration API: [../core/docs/register-interpolation-strategy.md](../core/docs/register-interpolation-strategy.md)
- Core interpolation strategy overview: [../core/docs/README.md](../core/docs/README.md)

## Exports

- `linearKernel`: Interpolation kernel implementation.
- `linearStrategy`: Strategy descriptor with id `linear`.
- `registerLinearStrategy`: Helper that registers `linearStrategy` into a compatible registry.

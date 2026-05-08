# @soundtouchjs/interpolation-strategy-linear

Linear interpolation strategy plugin for SoundTouchJS.

## Usage

```ts
import { registerInterpolationStrategy, SoundTouch } from '@soundtouchjs/core';
import { registerLinearStrategy } from '@soundtouchjs/interpolation-strategy-linear';

registerLinearStrategy({ registerInterpolationStrategy });

const st = new SoundTouch({
  interpolationStrategy: 'linear',
});

st.setInterpolationStrategyParams({ edgeHoldFrames: 3 });
```

## Params

- `edgeHoldFrames` (default `1`, normalized to `0..32`)

## Related docs

- Core interpolation registration API: [../core/docs/register-interpolation-strategy.md](../core/docs/register-interpolation-strategy.md)
- Core interpolation strategy overview: [../core/docs/README.md](../core/docs/README.md)

## Exports

- `linearKernel`: Interpolation kernel implementation.
- `linearStrategy`: Strategy descriptor with id `linear`.
- `registerLinearStrategy`: Helper that registers `linearStrategy` into a compatible registry.
- `linearStrategy.defaultParams`: Runtime defaults for strategy params.

## License

MPL-2.0 — see [LICENSE](../../LICENSE) for details.

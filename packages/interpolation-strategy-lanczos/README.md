## License

MPL-2.0 — see [LICENSE](../../LICENSE) for details.

# @soundtouchjs/interpolation-strategy-lanczos

Lanczos interpolation strategy plugin for SoundTouchJS.

## Usage

```ts
import { registerInterpolationStrategy, SoundTouch } from '@soundtouchjs/core';
import { registerLanczosStrategy } from '@soundtouchjs/interpolation-strategy-lanczos';

registerLanczosStrategy({ registerInterpolationStrategy });

const st = new SoundTouch({
  interpolationStrategy: 'lanczos8',
});

st.setInterpolationStrategyParams({ radius: 6 });
```

## Params

- `radius` (default `4`, normalized to `2..8`)

## Related docs

- Core interpolation registration API: [../core/docs/register-interpolation-strategy.md](../core/docs/register-interpolation-strategy.md)
- Core interpolation strategy overview: [../core/docs/README.md](../core/docs/README.md)

## Exports

- `lanczosKernel`: Interpolation kernel implementation.
- `lanczosStrategy`: Strategy descriptor with id `lanczos8`.
- `registerLanczosStrategy`: Helper that registers `lanczosStrategy` into a compatible registry.
- `lanczosStrategy.defaultParams`: Runtime defaults for strategy params.

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

- Core interpolation registration API: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies-strategy-plugin-authoring--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies-strategy-plugin-authoring--docs)
- Core interpolation strategy overview: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies--docs)

## Exports

- `lanczosKernel`: Interpolation kernel implementation.
- `lanczosStrategy`: Strategy descriptor with id `lanczos8`.
- `registerLanczosStrategy`: Helper that registers `lanczosStrategy` into a compatible registry.
- `lanczosStrategy.defaultParams`: Runtime defaults for strategy params.

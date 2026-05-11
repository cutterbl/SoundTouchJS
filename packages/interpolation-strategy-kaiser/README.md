## License

MPL-2.0 — see [LICENSE](../../LICENSE) for details.

# @soundtouchjs/interpolation-strategy-kaiser

Kaiser interpolation strategy plugin for SoundTouchJS.

## Usage

```ts
import { registerInterpolationStrategy, SoundTouch } from '@soundtouchjs/core';
import { registerKaiserStrategy } from '@soundtouchjs/interpolation-strategy-kaiser';

registerKaiserStrategy({ registerInterpolationStrategy });

const st = new SoundTouch({
  interpolationStrategy: 'kaiser',
});

st.setInterpolationStrategyParams({ zeroCrossings: 6, beta: 10 });
```

## Profile

Tunable windowed-sinc strategy with strong flexibility for quality and transition-width tradeoffs.

## Params

- `zeroCrossings` (default `4`, normalized to `2..16`)
- `beta` (default `8.6`, normalized to `0..20`)

## Related docs

- Core interpolation registration API: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies-strategy-plugin-authoring--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies-strategy-plugin-authoring--docs)
- Core interpolation strategy overview: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies--docs)

## Exports

- `kaiserKernel`: Interpolation kernel implementation.
- `kaiserStrategy`: Strategy descriptor with id `kaiser`.
- `registerKaiserStrategy`: Helper that registers `kaiserStrategy` into a compatible registry.
- `kaiserStrategy.defaultParams`: Runtime defaults for strategy params.

# @soundtouchjs/interpolation-strategy-kaiser

Kaiser interpolation strategy plugin for SoundTouchJS.

[I accept cash](https://paypal.me/cutterbl?locale.x=en_US) if you like what's been done.

Part of the [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) monorepo — for more information and so much more.

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
- `beta` (default `8.6`, normalized to `0..20`) — Kaiser window shape parameter; higher = sharper cutoff, more ringing
- `normalize` (default `false`) — when true, kernel weights are normalized to sum to 1
- `windowPower` (default `1`) — exponent applied to the Kaiser window shape; values above 1 sharpen the window

## Related docs

- Core interpolation registration API: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies-strategy-plugin-authoring--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies-strategy-plugin-authoring--docs)
- Core interpolation strategy overview: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies--docs)

## Exports

- `kaiserKernel`: Interpolation kernel implementation.
- `kaiserStrategy`: Strategy descriptor with id `kaiser`.
- `registerKaiserStrategy`: Helper that registers `kaiserStrategy` into a compatible registry.
- `kaiserStrategy.defaultParams`: Runtime defaults for strategy params.

## License

MPL-2.0 — see [LICENSE](../../LICENSE) for details.

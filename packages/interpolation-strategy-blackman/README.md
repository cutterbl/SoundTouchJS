## License

MPL-2.0 — see [LICENSE](../../LICENSE) for details.

# @soundtouchjs/interpolation-strategy-blackman

Blackman interpolation strategy plugin for SoundTouchJS.

## Usage

```ts
import { registerInterpolationStrategy, SoundTouch } from '@soundtouchjs/core';
import { registerBlackmanStrategy } from '@soundtouchjs/interpolation-strategy-blackman';

registerBlackmanStrategy({ registerInterpolationStrategy });

const st = new SoundTouch({
  interpolationStrategy: 'blackman',
});

st.setInterpolationStrategyParams({ zeroCrossings: 6 });
```

## Profile

Better stopband rejection than Hann with a slightly wider transition band.

## Params

- `zeroCrossings` (default `4`, normalized to `2..8`)

## Related docs

- Core interpolation registration API: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies-strategy-plugin-authoring--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies-strategy-plugin-authoring--docs)
- Core interpolation strategy overview: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies--docs)

## Exports

- `blackmanKernel`: Interpolation kernel implementation.
- `blackmanStrategy`: Strategy descriptor with id `blackman`.
- `registerBlackmanStrategy`: Helper that registers `blackmanStrategy` into a compatible registry.
- `blackmanStrategy.defaultParams`: Runtime defaults for strategy params.

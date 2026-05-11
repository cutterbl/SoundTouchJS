## License

MPL-2.0 — see [LICENSE](../../LICENSE) for details.

# @soundtouchjs/interpolation-strategy-hann

Hann interpolation strategy plugin for SoundTouchJS.

## Usage

```ts
import { registerInterpolationStrategy, SoundTouch } from '@soundtouchjs/core';
import { registerHannStrategy } from '@soundtouchjs/interpolation-strategy-hann';

registerHannStrategy({ registerInterpolationStrategy });

const st = new SoundTouch({
  interpolationStrategy: 'hann',
});

st.setInterpolationStrategyParams({ zeroCrossings: 6 });
```

## Profile

Good general-purpose quality with moderate roll-off.

## Params

- `zeroCrossings` (default `4`, normalized to `2..8`)

## Related docs

- Core interpolation registration API: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies-strategy-plugin-authoring--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies-strategy-plugin-authoring--docs)
- Core interpolation strategy overview: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies--docs)

## Exports

- `hannKernel`: Interpolation kernel implementation.
- `hannStrategy`: Strategy descriptor with id `hann`.
- `registerHannStrategy`: Helper that registers `hannStrategy` into a compatible registry.
- `hannStrategy.defaultParams`: Runtime defaults for strategy params.

# @soundtouchjs/interpolation-strategy-linear

Linear interpolation strategy plugin for SoundTouchJS.

[I accept cash](https://paypal.me/cutterbl?locale.x=en_US) if you like what's been done.

Part of the [SoundTouchJS](https://github.com/cutterbl/SoundTouchJS) monorepo — for more information and so much more.

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

- `edgeHoldFrames` (default `1`, normalized to `0..32`) — frames held at edges to avoid clicks
- `blend` (default `1`, normalized to `0..1`) — `1` = pure linear interpolation; `0` = nearest-neighbor; values between blend the two
- `normalize` (default `false`) — when true, kernel weights are normalized to sum to 1
- `zeroCrossings` — alias for `edgeHoldFrames` (accepted for cross-strategy API consistency)

## Related docs

- Core interpolation registration API: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies-strategy-plugin-authoring--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies-strategy-plugin-authoring--docs)
- Core interpolation strategy overview: [https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies--docs](https://cutterscrossing.com/SoundTouchJS/?path=/docs/interpolation-strategies--docs)

## Exports

- `linearKernel`: Interpolation kernel implementation.
- `linearStrategy`: Strategy descriptor with id `linear`.
- `registerLinearStrategy`: Helper that registers `linearStrategy` into a compatible registry.
- `linearStrategy.defaultParams`: Runtime defaults for strategy params.

## License

MPL-2.0 — see [LICENSE](../../LICENSE) for details.

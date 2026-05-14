import { registerInterpolationStrategy } from '@soundtouchjs/core';
import { registerLinearStrategy } from '@soundtouchjs/interpolation-strategy-linear';
import { registerHannStrategy } from '@soundtouchjs/interpolation-strategy-hann';
import { registerBlackmanStrategy } from '@soundtouchjs/interpolation-strategy-blackman';
import { registerKaiserStrategy } from '@soundtouchjs/interpolation-strategy-kaiser';

registerLinearStrategy({ registerInterpolationStrategy });
registerHannStrategy({ registerInterpolationStrategy });
registerBlackmanStrategy({ registerInterpolationStrategy });
registerKaiserStrategy({ registerInterpolationStrategy });

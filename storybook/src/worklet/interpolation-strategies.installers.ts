import { registerInterpolationStrategy } from '@soundtouchjs/core';
import { registerBlackmanStrategy } from '@soundtouchjs/interpolation-strategy-blackman';
import { registerHannStrategy } from '@soundtouchjs/interpolation-strategy-hann';
import { registerKaiserStrategy } from '@soundtouchjs/interpolation-strategy-kaiser';

registerHannStrategy({ registerInterpolationStrategy });
registerBlackmanStrategy({ registerInterpolationStrategy });
registerKaiserStrategy({ registerInterpolationStrategy });

# PROCESSOR_NAME

## Import

```ts
import { PROCESSOR_NAME } from '@soundtouchjs/audio-worklet';
```

## Purpose

`PROCESSOR_NAME` is the shared identifier used by both the main-thread node wrapper and the worklet processor registration.

## Usage

Most consumers do not need to use this constant directly.

```ts
const name = PROCESSOR_NAME;
```

It is mainly useful for diagnostics, custom assertions, or tests that verify expected processor identity.

## 2026-07-07, Stretch constructor sample-rate option

**What was decided:** Add `sampleRate` to `StretchConstructorOptions`, pass it through `SoundTouch` when constructing the built-in `Stretch`, and keep `setParameters(sampleRate, ...)` as the runtime/update path.
**Why:** `Stretch` does not own or inspect an audio source directly, so the correct sample rate must be injected by the caller or owning pipeline instead of assuming 44100 at construction time.
**What was rejected:** Teaching `Stretch` to infer sample rate from buffers or source abstractions it does not receive, and leaving the constructor fixed at an implicit 44100 default.

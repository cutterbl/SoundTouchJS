# @soundtouchjs/demo

Private demo application for developing and testing `@soundtouchjs/core`.

## Setup

- Vite dev server on port 8080 with auto-open
- `@soundtouchjs/core` resolves to **source** (not dist) via Vite alias for live HMR
- Static assets in `public/` (includes sample MP3)

## Structure

```
index.html       → Entry point (Vite root)
src/main.ts      → Demo logic — audio loading, slider bindings, playback control
public/          → Static assets served by Vite
vite.config.ts   → Dev server + alias config
```

## Rules

- This app is private — never published
- Import from `@soundtouchjs/core` (not relative paths to `../../packages/core`)
- Use DOM type assertions (`as HTMLInputElement`, etc.) for `getElementById` calls
- Guard `shifter` access with null checks — it's loaded asynchronously

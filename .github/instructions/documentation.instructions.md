---
description: 'Use when modifying public behavior, APIs, package exports, configuration, or developer workflows. Keep docs synchronized with code changes.'
applyTo: '**/*.{ts,tsx,js,jsx,mjs,cjs,json,yml,yaml}'
---

# Documentation Maintenance

When code changes alter behavior, APIs, configuration, defaults, workflows, or package structure, update relevant documentation in the same change.

## Required actions

- Update package README files when user-facing usage, options, defaults, or examples change.
- Update docs indexes and per-API docs under `packages/*/docs/` when public exports change.
- Ensure examples compile conceptually with current constructor signatures and option names.
- Add or adjust cross-links so new docs are discoverable from related READMEs.
- If no documentation changes are needed, explicitly state why in the PR or summary.

## Minimum checklist for API-affecting changes

- `packages/core/README.md` reviewed
- `packages/core/docs/README.md` reviewed
- `packages/audio-worklet/README.md` reviewed (if worklet behavior is affected)
- `packages/audio-worklet/docs/README.md` reviewed (if worklet exports are affected)
- Relevant strategy package README reviewed when interpolation behavior or registration changes

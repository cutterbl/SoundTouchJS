# Copilot Workspace Instructions

## Local Environment

- Operating system: macOS
- Preferred shell: zsh
- `rg` (ripgrep) is not available in this environment

## Terminal Command Guidance

- Use `zsh`-compatible commands and syntax.
- Do not assume `rg` exists.
- For file discovery, use alternatives such as:
  - `find . -type f`
  - `ls -R`
- For text search, use alternatives such as:
  - `grep -R "pattern" .`
  - `grep -Rin "pattern" .`

## Behavior Expectation

- Always adapt command suggestions and scripts to this macOS + zsh setup.
- If a command example would normally use `rg`, replace it with `find`/`grep` equivalents.
- Keep documentation synchronized with code changes. When behavior, public APIs, defaults, or workflows change, update the relevant README/docs files in the same change.

# Runtime Library

The runtime package provides shared logic for SymbolCast input, state
management, and command handling.

## Structure
- `src/` – TypeScript sources
- `quantum/` – quantum framework wrappers
- `dist/` – compiled output
- `package.json` – build scripts and dependencies

## Building
From repository root:
```bash
npm run build -w runtime
```
The build outputs to `runtime/dist`.

# @eco/js-sdk

Shared TypeScript runtime consumed by the web shell, automation tools, and future mobile surfaces. It currently exposes in-memory SymbolCast command dispatch, gesture mocks, and AI model inventory helpers.

## Building

```bash
npm run build -w sdks/js
```

## Testing

```bash
npm run test -w sdks/js
```

The compiled output under `dist/` powers workspace consumers via the package exports defined in `package.json`.

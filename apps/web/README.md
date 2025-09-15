# E-CO Web Shell

The web shell is a Next.js 14 application that embeds the Bevy renderer (via WASM) alongside the SymbolCast UI, model dashboard, and portal manager. It consumes the shared `@eco/js-sdk` package for state, AI model management, and command dispatch.

## Development

```bash
cd apps/web
npm install
npm run dev
```

The build step copies `shared/environments.json` into `public/environments.json` so the UI can list available worlds. Tailwind CSS powers the HUD overlay, while `@react-three/fiber` renders the procedural terrain background.

## Testing

```bash
npm test
```

Vitest and Testing Library cover the core client widgets. Use `npm run lint` to run Next.js ESLint rules.

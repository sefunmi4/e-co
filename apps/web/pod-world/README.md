# E-CO Web Shell

The web shell is a Next.js 14 application that embeds the Bevy renderer (via WASM) alongside the SymbolCast UI, model dashboard, and portal manager. It consumes the shared `@eco/js-sdk` package for state, AI model management, and command dispatch.

The codebase is now split between two top-level folders:

- `frontend/` contains the App Router entrypoints and UI components. Root level files inside `app/` simply proxy to the real implementations in this directory so Next.js can continue to discover the routes.
- `backend/` stores data shims and server-leaning helpers that the UI pulls from until production services come online.

## Development

```bash
cd apps/web/pod-world
npm install
npm run dev
```

The build step copies `shared/environments.json` into `public/environments.json` so the UI can list available worlds. Tailwind CSS powers the HUD overlay, while `@react-three/fiber` renders the procedural terrain background.

## Testing

```bash
npm test
```

Vitest and Testing Library cover the core client widgets. Use `npm run lint` to run Next.js ESLint rules.

# Ether Pod Web Shell

Ether Pod is the browser-based SymbolCast shell. The Next.js application hosts
the 3D renderer, desktop UI, and supporting server helpers that provide mocked
world data until the production services come online.

## Repository layout

```
ether-pod/
├── app/         # Proxy entrypoints so Next.js can discover the routes
├── backend/     # Server helpers consumed via the @backend/* alias
├── frontend/    # App Router pages, layouts, and UI components
├── public/      # Static assets copied into the build output
└── scripts/     # Utility scripts such as copy-env
```

Files under `app/` simply re-export implementations from `frontend/app`. Keeping
the real code in `frontend/` lets the UI live beside components and client
utilities while the proxies satisfy Next.js' filesystem routing.

## Development

Install dependencies and launch the combined frontend/backend runtime:

```bash
cd apps/web/ether-pod
npm install
npm run dev
```

The `dev` script mirrors `shared/environments.json` into
`public/environments.json` before starting the Next.js dev server on
`http://localhost:3000`. Server-leaning helpers live in `backend/` and are
imported using the `@backend/*` alias defined in `tsconfig.json`, so the same
process can serve API routes, server components, and data loaders without a
separate Node service.

## Production builds

```bash
npm run build
npm start
```

`npm run build` compiles the Next.js app, while `npm start` runs the production
server. Use `npm run lint` to apply the framework's ESLint rules.

## Testing

```bash
npm test
```

Vitest and Testing Library cover UI widgets and hooks. Add server-focused tests
in `frontend/` or `backend/` as new capabilities land.

## Open Graph images

Published pods expose a pre-rendered Open Graph preview at
`/api/og/p/[slug]`. The handler composes a marketing card using the pod
snapshot title and hero camera angle, and caches the generated image for
24 hours (`max-age=86400`) with a 7 day CDN `s-maxage` so repeat requests
stay fast.

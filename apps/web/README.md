# Web Applications

The `apps/web` workspace contains the browser experiences that ship with the
E-CO project. Each app pairs a UI surface with a supporting server so the two
parts can evolve independently.

## Ethos (`ethos/`)

Ethos delivers the cooperative questing workflow. The package is split into:

- `backend/` – Node.js + Express API backed by PostgreSQL and Socket.IO.
- `frontend/` – Vite powered React interface that consumes the REST and socket
  endpoints.

### Local development

```bash
# API (port 3000 by default)
cd apps/web/ethos/backend
npm install
# create .env with DATABASE_URL and JWT_SECRET or export them in your shell
npm start

# UI (served from http://localhost:5173)
cd apps/web/ethos/frontend
npm install
VITE_API_URL=http://localhost:3000 npm run dev
```

The backend README documents migrations, tests, and environment variables. The
frontend README covers linting, builds, and socket configuration.

## Ether Pod (`ether-pod/`)

Ether Pod hosts the SymbolCast VR shell inside a Next.js 14 runtime. The code is
arranged as:

- `frontend/` – App Router pages, layouts, and reusable UI components.
- `backend/` – Server-only helpers that are imported via the `@backend/*` alias
  from within the same Next process.
- `app/` – Thin proxy files so Next.js can discover the real routes in
  `frontend/app`.

### Local development

```bash
cd apps/web/ether-pod
npm install
npm run dev
```

The `dev` script mirrors `shared/environments.json` into
`public/environments.json` before starting the combined frontend/backend server
on `http://localhost:3000`.

Refer to each application's README for additional build, lint, and test
information.

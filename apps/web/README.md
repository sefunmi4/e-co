# Web Applications

This directory houses the web experiences that ship with the E-CO project. Each
application contains a browser-facing frontend and a supporting backend layer so
that the two pieces can evolve independently.

## Ethos (`ethos/`)

Ethos is the cooperative questing experience. The folder contains:

- `backend/` – a Node.js + Express API with PostgreSQL storage. It exposes the
  quest, guild, and notification endpoints documented in `API.md`.
- `frontend/` – a Vite powered React client that consumes the API and sockets.

Development quick start:

```bash
# start the API
cd apps/web/ethos/backend
npm install
DATABASE_URL=postgres://user:pass@localhost:5432/ethos JWT_SECRET=change-me npm start

# in a new shell start the UI
cd apps/web/ethos/frontend
npm install
VITE_API_URL=http://localhost:3000 npm run dev
```

See `ethos/README.md` for more detail on configuration, migrations, and testing.

## Ether Pod (`ether-pod/`)

Ether Pod hosts the immersive SymbolCast shell. The folder is structured as:

- `frontend/` – the Next.js App Router implementation and UI components.
- `backend/` – server-leaning helpers that the Next runtime can import through
  the `@backend/*` TypeScript alias.
- `app/` – thin proxy files that let Next.js discover the real routes housed in
  `frontend/app`.

To run the experience locally, the Next.js dev server is sufficient:

```bash
cd apps/web/ether-pod
npm install
npm run dev
```

This command copies `shared/environments.json` into `public/environments.json`
and starts the combined frontend/backend runtime. Refer to
`ether-pod/README.md` for additional scripts and testing notes.

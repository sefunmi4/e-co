# Ethos Web Experience

Ethos powers the cooperative questing surface for E-CO. The application is split
into a standalone Express backend and a Vite-driven React frontend so that
server capabilities and the UI can evolve independently. This guide documents
how to run, test, and configure both halves.

## Project structure

```
ethos/
├── API.md          # HTTP contract for quests, guilds, notifications, etc.
├── backend/        # Express API, PostgreSQL migrations, Socket.IO bridge
└── frontend/       # Vite UI that consumes the API and websocket events
```

## Backend API (`backend/`)

The backend exposes authentication, quest, guild, and notification endpoints and
broadcasts live updates over Socket.IO.

### Environment variables

Define the following variables in a `.env` file or export them before starting
the server:

- `DATABASE_URL` – PostgreSQL connection string (for example
  `postgres://user:pass@localhost:5432/ethos`).
- `JWT_SECRET` – secret used to sign login tokens.
- `PORT` *(optional)* – HTTP port, defaults to `3000`.

Migrations located in `backend/migrations/` are applied automatically on boot.
Run `node migrate.js` manually if you need to reapply them outside of the normal
startup flow.

### Commands

```bash
cd apps/web/ethos/backend
npm install            # installs Express, pg, Socket.IO, Jest, etc.
npm start              # runs migrations and launches the API
npm test               # executes the Jest suite against a pg-mem instance
```

The Jest tests spin up an in-memory PostgreSQL database (via `pg-mem`), so no
external database is required to validate the routes.

## Frontend (`frontend/`)

The frontend is a Vite + React application that communicates with the backend
through REST and Socket.IO.

### Environment variables

The client reads the backend origin from `VITE_API_URL`. Create a `.env.local`
file or export the variable in your shell before running Vite:

```
VITE_API_URL=http://localhost:3000
```

If the variable is omitted the client defaults to `http://localhost:3000`.

### Commands

```bash
cd apps/web/ethos/frontend
npm install            # installs React, Tailwind, shadcn/ui components
npm run dev            # starts the Vite dev server on http://localhost:5173
npm run build          # produces an optimized build in dist/
npm run preview        # serves the production build locally
npm run lint           # runs ESLint with the local configuration
```

The dev server proxies API calls and socket connections to the backend
configured by `VITE_API_URL`, so ensure the Express service is running before
logging in.

## Running both services together

1. Start the backend in one terminal: `DATABASE_URL=… JWT_SECRET=… npm start`.
2. Start the frontend in another terminal:
   `VITE_API_URL=http://localhost:3000 npm run dev`.
3. Visit `http://localhost:5173` to access the full Ethos quest flow.

With both processes running you can exercise authentication, quests, guilds,
and live notifications locally.

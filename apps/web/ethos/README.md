# Ethos Web Experience

Ethos is the cooperative questing surface for E-CO. The application is split
into a standalone Express backend and a Vite powered React frontend so that
server capabilities and UI can iterate independently. This document explains the
local development workflow for both halves.

## Prerequisites

- Node.js 18+
- npm 9+
- A PostgreSQL instance reachable via connection string

## Repository Layout

```
ethos/
├── API.md          # Reference for the available HTTP endpoints
├── backend/        # Express API, database migrations, and socket server
└── frontend/       # Vite UI that consumes the API and websocket events
```

## Backend API (`backend/`)

The backend exposes authentication, quest, guild, and notification endpoints.
It also ships with Socket.IO support for live updates.

### Configuration

Create a `.env` file in `backend/` or export the following variables before
running the service:

- `DATABASE_URL` – PostgreSQL connection string (e.g.
  `postgres://user:pass@localhost:5432/ethos`).
- `JWT_SECRET` – secret used to sign login tokens.
- `PORT` (optional) – defaults to `3000`.

Migrations in `backend/migrations/` are applied automatically on boot. To run
them manually you can execute `node migrate.js` from the backend folder.

### Commands

```bash
cd apps/web/ethos/backend
npm install       # installs express, pg, socket.io, etc.
npm start         # starts the API with migrations
npm test          # runs the Jest integration tests (uses pg-mem)
```

The Jest suite spins up an in-memory PostgreSQL instance, so no database is
required to run the tests.

## Frontend (`frontend/`)

The frontend is a Vite + React application that communicates with the backend
via REST and Socket.IO.

### Configuration

The client reads the backend URL from the `VITE_API_URL` environment variable.
Create a `.env.local` file or export it before running Vite:

```bash
VITE_API_URL=http://localhost:3000
```

### Commands

```bash
cd apps/web/ethos/frontend
npm install   # installs React, Tailwind, and UI dependencies
npm run dev   # starts the Vite dev server on http://localhost:5173
npm run build # produces an optimized production build
npm run lint  # runs ESLint using the local config
```

## Running Both Services Together

1. Start the backend in one terminal: `DATABASE_URL=... JWT_SECRET=... npm start`.
2. Start the frontend in another terminal: `VITE_API_URL=http://localhost:3000 npm run dev`.
3. Visit `http://localhost:5173` and log in using credentials seeded via the
   migrations or through the registration endpoint.

With both processes running you can exercise the full Ethos quest flow locally.

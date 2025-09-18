# Ethos Backend

This package contains the Express API that powers the Ethos questing experience.
It manages authentication, quest management, guild features, and websocket
notifications while persisting state in PostgreSQL.

## Setup

```bash
cd apps/web/ethos/backend
npm install
```

Create a `.env` file (or export the variables directly) with the connection
information the service expects:

```
DATABASE_URL=postgres://user:pass@localhost:5432/ethos
JWT_SECRET=change-me
PORT=3000 # optional, defaults to 3000
```

## Running the server

```bash
npm start
```

The startup script runs every SQL file in `migrations/` so the schema stays in
sync. To execute them manually outside the normal boot process run
`node migrate.js`.

## Testing

```bash
npm test
```

The Jest suite uses `pg-mem` to simulate PostgreSQL, allowing the tests to run
without a live database. Supertest drives the HTTP endpoints directly against
the Express app to verify routing, authentication, and data access.

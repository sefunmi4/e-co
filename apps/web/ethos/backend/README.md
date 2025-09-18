# Ethos Backend

This folder contains the Express API that powers the Ethos questing experience.
It manages authentication, quest management, and websocket notifications while
persisting state in PostgreSQL.

## Getting Started

```bash
cd apps/web/ethos/backend
npm install
```

Create a `.env` file with the connection details that the service expects:

```
DATABASE_URL=postgres://user:pass@localhost:5432/ethos
JWT_SECRET=change-me
PORT=3000 # optional, defaults to 3000
```

With the environment variables in place you can boot the server:

```bash
npm start
```

The startup script automatically executes the SQL files in
`migrations/` so that the schema stays in sync. To rerun them manually execute
`node migrate.js`.

## Testing

```bash
npm test
```

The Jest suite uses `pg-mem` to simulate PostgreSQL, so the tests run without a
real database. Supertest drives the HTTP endpoints directly against the Express
app, ensuring the routes, authentication, and migrations stay healthy.

# Development Workflow

## Database seeding

The Ethos gateway ships with an idempotent demo seed that provisions three sample creators, their pods, artifacts, and quests. Run it any time after configuring `DATABASE_URL`:

```bash
npm run seed:demo-data
```

The script runs the latest gateway migrations and then inserts (or updates) the demo records, so you can safely re-run it whenever you need to refresh the dataset.

## Resetting local data

To wipe all local gateway tables without destroying the database, drop and recreate the `public` schema and then re-run the migrations and seed:

```bash
psql "$DATABASE_URL" <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
SQL

npm run seed:demo-data
```

Dropping the schema clears every table, index, and constraint, so only use this in a disposable development environment. After the schema reset, the seed command will rebuild the schema (through migrations) and restore the demo content in one step.

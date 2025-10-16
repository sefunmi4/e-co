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

## Realtime bridge controls

The realtime Socket.IO bridge enforces burst limits and can be toggled at runtime without a redeploy. Configure it via environment variables (defaults shown in parentheses):

- `REALTIME_BRIDGE_ENABLED` (`true`) / `REALTIME_BRIDGE_DISABLED` (`false`): coarse on/off switches. If either disables the bridge, new events are rejected with a `bridge_disabled` error.
- `REALTIME_BRIDGE_WINDOW_MS` (`10000`): rolling window (in milliseconds) used when tracking burst counts.
- `REALTIME_BRIDGE_MAX_EVENTS_PER_USER` (`60`): maximum events a single user can emit across all rooms during the window.
- `REALTIME_BRIDGE_MAX_EVENTS_PER_ROOM` (`200`): maximum events that can target a specific room during the window (shared across users).
- `REALTIME_BRIDGE_MAX_EVENTS_PER_USER_ROOM` (`40`): maximum events a given user can send to a single room during the window.
- `REALTIME_BRIDGE_TRACKED_EVENTS` / `REALTIME_BRIDGE_EXCLUDED_EVENTS`: optional comma-separated allow/deny lists of event names. By default, connection lifecycle events are ignored and every other event is throttled.
- `REALTIME_BRIDGE_FLAG_FILE`: optional path to a JSON file that can override the feature flag at runtime. The file should contain `true`/`false` or `{ "bridgeEnabled": true }`. Changes are picked up automatically.

When throttling kicks in, the server logs a `bridge_throttled` entry (including the scope and reset time) and the client receives an error packet carrying the same metadata. Feature-flag toggles emit a `bridge_disabled` error so clients can surface maintenance messaging.

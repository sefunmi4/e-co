# Ethos Frontend

This package is the Vite + React client for the Ethos questing experience. It
renders the player dashboard, cooperative quest flows, and live activity feed by
communicating with the Express API in `../backend`.

## Environment Configuration

The frontend reads the backend origin from the `VITE_API_URL` environment
variable. Create a `.env.local` file in this directory (or export it in your
shell) before running the dev server:

```
VITE_API_URL=http://localhost:3000
```

When the variable is not provided the client defaults to
`http://localhost:3000`.

## Commands

```bash
npm install   # install dependencies
npm run dev   # start the Vite dev server on http://localhost:5173
npm run build # create a production build in dist/
npm run lint  # run ESLint using the local configuration
```

The dev server proxies REST calls and Socket.IO events to the backend defined by
`VITE_API_URL`, so ensure the Express service is running before logging in.

## Testing

Unit tests are currently covered by the backend service. Add Vitest or Cypress
here as the UI surface grows.

# @eco/js-sdk

Shared TypeScript runtime consumed by the web shell, automation tools, and future mobile surfaces. It currently exposes in-memory SymbolCast command dispatch, gesture mocks, and AI model inventory helpers.

## Authentication helper

Use the `AuthClient` exported from `@eco/js-sdk/auth` to manage login flows and refresh session rotation against the Ethos gateway:

```ts
import { AuthClient } from '@eco/js-sdk/auth';

const auth = new AuthClient({ baseUrl: 'https://gateway.ethos.example' });
const session = await auth.login('user@example.com', 'hunter2');

const refreshed = await auth.refresh({
  sessionId: session.refreshSessionId!,
  refreshToken: session.refreshToken!,
});
```

## Building

```bash
npm run build -w sdks/js
```

## Testing

```bash
npm run test -w sdks/js
```

The compiled output under `dist/` powers workspace consumers via the package exports defined in `package.json`.

# Auth Workflow

The Ethos gateway issues short-lived JSON Web Tokens (JWTs) for authenticated API calls and maintains long-lived refresh sessions
in Postgres. Clients are expected to pair the opaque refresh token with the issued session identifier when requesting new access
tokens.

## Session lifecycle

1. `POST /auth/login`, `POST /auth/register`, or `POST /auth/guest` returns a payload containing:
   - `token`: a JWT that expires after 12 hours.
   - `refresh_token`: an opaque string that can only be used once.
   - `refresh_session_id`: a UUID that identifies the server-side refresh session.
   - `refresh_expires_at`: an ISO-8601 timestamp indicating when the refresh session expires (currently 30 days).
2. Persist the `refresh_token` and `refresh_session_id` together. Store the JWT where it can be used for `Authorization: Bearer` headers.
3. When the JWT expires (or is about to expire) call `POST /auth/refresh` with:

   ```json
   {
     "session_id": "<refresh_session_id>",
     "refresh_token": "<refresh_token>"
   }
   ```

4. The gateway validates the refresh session, rotates the stored token, and responds with a payload matching the original
   session response. The returned `refresh_token` **replaces** the previous token and must be stored for the next refresh.
5. Any attempt to reuse an older refresh token is rejected with `401 Unauthorized`, allowing clients to detect compromised or
   invalidated sessions and prompt for sign-in again.

## SDK integration

The `@eco/js-sdk` package exposes an `AuthClient` helper that encapsulates the workflow:

```ts
import { AuthClient } from '@eco/js-sdk/auth';

const auth = new AuthClient({ baseUrl: 'https://gateway.ethos.example' });
const session = await auth.login('user@example.com', 'correct horse battery staple');

// Later, refresh the session
const refreshed = await auth.refresh({
  sessionId: session.refreshSessionId!,
  refreshToken: session.refreshToken!,
});
```

The client automatically POSTs to `/auth/refresh` and normalizes the response into camelCase fields while preserving the raw
payload for advanced use cases.

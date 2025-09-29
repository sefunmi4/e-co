# Ethos Gateway API Contract

The Ethos gateway exposes REST, gRPC, gRPC-Web, and Server-Sent Events so the
Next.js client, other services, and Matrix integrations can coordinate guild
conversations.

## Authentication

All authenticated endpoints require a JWT in the `Authorization: Bearer <token>`
header. Tokens are minted by the login endpoint and verified against
`ETHOS_JWT_SECRET`.

### `POST /auth/login`

Request body:

```json
{
  "email": "user@example.com",
  "password": "hunter2",
  "matrix_access_token": "optional Matrix token"
}
```

Response body:

```json
{
  "token": "<jwt>",
  "matrix_access_token": "<optional Matrix token>",
  "matrix_homeserver": "https://matrix.example",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "display_name": "Ethos Operative",
    "is_guest": false
  }
}
```

### `POST /auth/guest`

Create an ephemeral guest account and return a JWT for temporary access. A
custom display name can be supplied, otherwise a friendly alias is generated.

Request body:

```json
{
  "display_name": "Observer"
}
```

Response body (same shape as the login response):

```json
{
  "token": "<jwt>",
  "user": {
    "id": "uuid",
    "email": "guest+abc123@ethos.local",
    "display_name": "Observer",
    "is_guest": true
  }
}
```

### `POST /auth/logout`

Stateless endpoint that allows clients to record a logout action. Clients should
discard their cached token after calling this route.

### `GET /auth/session`

Returns the hydrated session for the calling user (same shape as the login
response). Used by the Zustand store to restore state across reloads.

## Conversations

### `GET /api/conversations`

Returns the conversations, initial message history, and presence snapshot
available to the authenticated user.

```json
{
  "conversations": [
    {
      "id": "room-id",
      "topic": "Raid planning",
      "participants": [
        { "user_id": "user-1", "display_name": "Scout" },
        { "user_id": "user-2", "display_name": "Strategist" }
      ],
      "updated_at": 1713484923000,
      "messages": [
        {
          "id": "event-id",
          "conversation_id": "room-id",
          "sender_id": "user-1",
          "body": "Recon complete",
          "timestamp_ms": 1713484923000
        }
      ]
    }
  ],
  "presence": [
    {
      "user_id": "user-1",
      "state": "STATE_ONLINE",
      "updated_at": 1713484922000
    }
  ]
}
```

### `POST /api/conversations`

Create a new conversation (and Matrix room when bridging is enabled).

```json
{
  "participant_user_ids": ["user-1", "user-2"],
  "topic": "Quest sync"
}
```

### `GET /api/conversations/:id/messages`

Fetch the full message history for a conversation. Useful for paginating beyond
the initial bootstrap response.

### `POST /api/conversations/:id/messages`

Append a message to a conversation, publish an event over NATS (`ethos.chat.*`),
and forward the payload to Matrix when configured.

```json
{ "body": "Let's move" }
```

### `GET /api/conversations/:id/stream?token=<jwt>`

Server-Sent Events endpoint. Emits payloads with `message` or `presence` types:

```json
{ "type": "message", "message": { ...Message... } }
{ "type": "presence", "presence": { ...PresenceEvent... } }
```

## gRPC / gRPC-Web

`proto/ethos.proto` defines `ethos.v1.ConversationsService` with the following
operations:

- `ListConversations` – mirror of the REST bootstrap response
- `CreateConversation` – create a conversation/Matrix room
- `SendMessage` – append a message (triggers NATS + Matrix fanout)
- `StreamMessages` – server-streaming API that first replays history then emits
  new messages
- `StreamPresence` – server-streaming API for presence updates (optionally
  filtered by user IDs)

Both tonic (Rust) and Connect-Web (TypeScript) clients are generated from the
same protobuf definition. The browser client uses gRPC-Web over HTTP/2 while the
Next.js UI primarily consumes REST + SSE for hydration.

## NATS subjects

Chat mutations publish JSON payloads to `ethos.chat.<conversation_id>`. Downstream
services can subscribe to these subjects to mirror events into analytics
pipelines, bots, or additional delivery mechanisms.

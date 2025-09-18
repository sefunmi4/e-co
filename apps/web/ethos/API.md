# API Documentation

## Authentication
- **POST /auth/register**
  - Request: `{ email, password }`
  - Response: `{ user: { id, email, created_at } }`
- **POST /auth/login**
  - Request: `{ email, password }`
  - Response: `{ token }`
- **GET /auth/me** (requires `Authorization: Bearer <token>`)
  - Response: `{ id, email, created_at }`

## Quests (requires authentication)
- **GET /api/quests**
  - Query params: `guild_id?`
  - Response: `[{ id, title, description, user_id, guild_id, created_at }]`
- **POST /api/quests**
  - Request: `{ title, description, guild_id? }`
  - Response: created quest (must be member of guild to post with `guild_id`)
- **GET /api/quests/:id**
  - Response: single quest
- **PUT /api/quests/:id**
  - Request: `{ title?, description?, user_id?, guild_id? }`
  - Response: updated quest
- **DELETE /api/quests/:id**
  - Response: `204 No Content`

## Guilds (requires authentication)
- **GET /api/guilds** – list guilds
- **POST /api/guilds** – create guild `{ name, description, owner_id }`
- **GET /api/guilds/:id** – retrieve guild
- **PUT /api/guilds/:id** – update guild `{ name?, description?, owner_id? }`
- **DELETE /api/guilds/:id** – delete guild

## Guild Memberships (requires authentication)
- **GET /api/guild_memberships** – filter memberships by `guild_id`, `user_id`, `user_email`, `status`
- **POST /api/guild_memberships** – request membership `{ guild_id }`
- **POST /api/guild_memberships/:id/approve** – approve membership request (owner/moderator only) `{ role? }`
- **DELETE /api/guild_memberships/:id** – revoke or leave membership

## Quest Logs (requires authentication)
- **GET /api/quest_logs** – list logs
- **POST /api/quest_logs** – create log `{ quest_id, user_id, action }`
- **GET /api/quest_logs/:id** – retrieve log
- **PUT /api/quest_logs/:id** – update log `{ quest_id?, user_id?, action? }`
- **DELETE /api/quest_logs/:id** – delete log

# Ethos Web Experience

Ethos now ships as a Next.js 14 experience backed by a Rust gateway that speaks
Matrix, REST, gRPC, and Server-Sent Events. The frontend and gateway live inside
this repository so you can iterate on the interaction model, protobuf
definitions, and infrastructure without jumping between projects.

## Project structure

```
ethos/
├── API.md                 # HTTP + gRPC contract for the gateway
├── frontend/              # Next.js application (app router + Tailwind)
└── ../../services/ethos-gateway
    ├── src/               # Axum + tonic gateway bridging Matrix/NATS
    └── tests/             # Integration coverage for REST + gRPC flows
```

The Rust crate is colocated under `services/ethos-gateway` so it can be reused by
other e-co binaries.

## Frontend (`frontend/`)

The web application is a Next.js 14 project that consumes gRPC-Web clients
generated from `proto/ethos.proto` with Connect-Web. TailwindCSS powers the
visual system and a shared Zustand store coordinates authentication, Matrix
session hydration, conversation state, and live SSE updates.

### Environment variables

Configure the gateway endpoint via the following variables:

- `NEXT_PUBLIC_GATEWAY_URL` – Base URL for REST/SSE/gRPC-Web (defaults to
  `http://localhost:8080`).

### Commands

```bash
cd apps/web/ethos/frontend
npm install            # install dependencies and buf CLI
npm run dev            # start Next.js in development mode (port 3000)
npm run build          # create a production build
npm run start          # launch the production server
npm run lint           # run ESLint via next lint
npm run proto:gen      # regenerate Connect-Web clients from proto/ethos.proto
npm test               # run Vitest coverage for stores/components
```

The Vitest suite covers the Zustand session and conversation stores to ensure
client-side orchestration remains stable as the gateway evolves.

## Gateway (`services/ethos-gateway`)

`ethos-gateway` is an Axum + tonic service that authenticates JWTs, bridges
Matrix room operations, publishes chat events over NATS, and exposes:

- REST endpoints for authentication, conversation bootstrapping, and message
  fanout
- gRPC and gRPC-Web services generated from `proto/ethos.proto`
- Server-Sent Events for lightweight streaming to browsers

The crate uses an in-memory room service by default and can be compiled with the
`matrix` feature to delegate to a Matrix homeserver via `matrix-sdk`.

### Environment variables

- `ETHOS_JWT_SECRET` – Secret used to verify/issue JWTs (defaults to an insecure
  development value)
- `ETHOS_HTTP_ADDR` – HTTP listen address (`0.0.0.0:8080` by default)
- `ETHOS_GRPC_ADDR` – gRPC listen address (`0.0.0.0:8081` by default)
- `ETHOS_NATS_URL` – Optional NATS connection string for publishing chat events
- `ETHOS_MATRIX_HOMESERVER` / `ETHOS_MATRIX_ACCESS_TOKEN` – Optional Matrix
  credentials when bridging to a homeserver

### Commands

```bash
cd services/ethos-gateway
cargo build            # compile the gateway
cargo test             # run integration tests for REST/gRPC flows
cargo run              # start the gateway on the configured addresses
```

The integration tests stub Matrix/NATS dependencies and exercise login,
conversation hydration, gRPC streaming, and event publication logic.

## Proto definitions and generated clients

`proto/ethos.proto` defines the shared contract for conversations, presence, and
message events. Run `npm run proto:gen` from the frontend to regenerate the
TypeScript clients (Connect-Web) and recompile the Rust stubs occurs
automatically via `build.rs` in the gateway crate.

## Developing locally

1. Generate TypeScript clients if the proto definition changed: `npm run proto:gen`.
2. Start the gateway: `cargo run -p ethos-gateway`.
3. Boot the Next.js app: `npm run dev` inside `apps/web/ethos/frontend`.
4. Visit `http://localhost:3000` to authenticate, join Matrix-backed rooms, and
   stream chat updates end-to-end.

Vitest and the Rust integration suite provide coverage for the shared Zustand
stores, chat UI, and the gateway’s Matrix/gRPC behaviour. Run both regularly to
catch regressions before shipping.

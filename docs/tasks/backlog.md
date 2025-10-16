# Outstanding Tasks

The following tasks capture the remaining scope identified after the last audit.

## Seed demo content (`seed-1`)
- **Summary:** Implement a repeatable seed routine that loads demo creators, pods, artifacts, and quests into the local environment.
- **Scope:** Database seed scripts, service bootstrapping hooks.
- **Acceptance Criteria:** Running the seed command populates three pods with associated artifacts and quests without duplicating data.

## Auth token refresh (`api-auth`)
- **Summary:** Add a refresh endpoint that rotates JWTs and persists refresh token sessions.
- **Scope:** Gateway auth router, session storage, client SDK integration.
- **Acceptance Criteria:** Refresh requests return a new access token and rotate refresh tokens while preserving role claims.

## Socket.IO rooms (`rt-1`)
- **Summary:** Stand up a Socket.IO server that manages pod, guild, and room channels.
- **Scope:** Gateway realtime service, client connection helpers.
- **Acceptance Criteria:** Clients can join and leave rooms and receive presence user counts in real time.

## Matrix bridge controls (`rt-2`)
- **Summary:** Introduce rate limiting and feature flag toggles for the Matrix bridge integration.
- **Scope:** Realtime bridge middleware, configuration flags, telemetry.
- **Acceptance Criteria:** Rate limits apply bursts and feature flags can enable or disable the bridge at runtime.

## Day/night toggle (`r3f-1`)
- **Summary:** Extend the Ether-Pod renderer with a day/night lighting toggle and related performance instrumentation.
- **Scope:** `apps/web/ether-pod` scene setup, shader utilities, UI controls.
- **Acceptance Criteria:** Mid-tier devices sustain 45 FPS while toggling between day and night lighting states.

## Builder primitives (`builder-1`)
- **Summary:** Deliver UI and persistence for placing primitive items, manipulating gizmos, and saving snapshots.
- **Scope:** Ether-Pod builder UI, snapshot hydrator, backend persistence endpoints.
- **Acceptance Criteria:** Users can place primitives, adjust transforms, and persist snapshots that reload correctly.

## Pod OG images (`seo-1`)
- **Summary:** Generate per-pod Open Graph images that reflect the pod title and hero camera angle.
- **Scope:** Public pod route, image rendering handler, caching strategy.
- **Acceptance Criteria:** Visiting an OG image URL renders the card with the correct pod metadata.

## Provider adapters (`provider-1`)
- **Summary:** Flesh out provider adapters for Printify and Shopify with mock data mapping.
- **Scope:** Commerce provider abstraction, adapter implementations, test fixtures.
- **Acceptance Criteria:** Adapters expose a consistent interface and return mapped mock data for catalog and fulfillment calls.

## Checkout Playwright flow (`e2e-1`)
- **Summary:** Author an end-to-end Playwright spec that covers viewing a pod, inspecting an artifact, and completing a checkout flow.
- **Scope:** Playwright test suite, test data seeding, CI integration.
- **Acceptance Criteria:** The new spec passes locally and on CI, exercising the full pod-to-checkout journey.

## Asset guardrails (`perf-1`)
- **Summary:** Add build-time checks that enforce maximum texture sizes (≤2K) and require KTX2 compression.
- **Scope:** Build scripts, asset pipeline tooling, CI enforcement.
- **Acceptance Criteria:** Builds fail when textures exceed the limits or lack KTX2 variants, with actionable error messages.

## Analytics events (`evt-1`)
- **Summary:** Emit analytics events for pod entry, artifact views, checkout starts, and sales.
- **Scope:** Gateway analytics middleware, event storage/streaming layer, client instrumentation.
- **Acceptance Criteria:** Events are recorded and available for downstream processing.

## Dashboard aggregates (`dash-1`)
- **Summary:** Provide an API that returns daily and weekly aggregates per pod and artifact.
- **Scope:** Analytics API endpoints, aggregation queries, documentation.
- **Acceptance Criteria:** The dashboard endpoint responds with aggregate metrics scoped by pod and artifact, matching stored events.

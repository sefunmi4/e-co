# Shared analytics event schemas

This package defines the canonical event contracts used across the Ethos
experience. Both the Rust services and the TypeScript frontends import these
schemas to ensure that analytics payloads stay aligned as the pipeline evolves.

## Events

| Event | Description |
| ----- | ----------- |
| `pod_entered` | A viewer entered a published pod experience. |
| `artifact_viewed` | A published artifact was rendered or inspected. |
| `checkout_started` | A shopper initiated a checkout flow. |
| `sale_recorded` | An order transitioned into a paid or fulfilled state. |

Every payload includes an ISO-8601 `occurred_at` timestamp and may optionally
set an `origin` field (`client` or `server`) to describe where the event was
captured.

In Rust, consume `events::AnalyticsEvent` and the associated structs. In
TypeScript, import the union from `@shared/events` to strongly type client side
instrumentation.

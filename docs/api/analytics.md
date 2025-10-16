# Analytics API

The analytics endpoints expose aggregated gateway events grouped by time windows. Event
records are stored in the `analytics_events` table and can reference either a pod or an
artifact. Each endpoint returns counts for the selected entity type bucketed by the
requested time window.

## Time windows

The `window` query parameter accepts the following values:

- `hour`
- `day` (default)
- `week`

Buckets are reported with an inclusive `bucket_start` timestamp and an exclusive
`bucket_end` timestamp.

## Pagination

All analytics endpoints support pagination with the `page` and `page_size` query
parameters. Pages are 1-indexed. If `page_size` exceeds 200 the server automatically
reduces it to 200.

## `GET /api/analytics/pods`

Returns aggregated pod-related events.

### Query parameters

| Name        | Type    | Description                                      |
| ----------- | ------- | ------------------------------------------------ |
| `window`    | string  | Time window to bucket by (`hour`, `day`, `week`). |
| `page`      | integer | Page number (default `1`).                        |
| `page_size` | integer | Number of buckets per page (default `50`).       |

### Response

```
{
  "data": [
    {
      "pod_id": "a7fcb4fe-5f07-4e20-9af5-15e617c901c6",
      "bucket_start": "2024-05-20T00:00:00Z",
      "bucket_end": "2024-05-21T00:00:00Z",
      "total": 12
    }
  ],
  "window": "day",
  "page": 1,
  "page_size": 50,
  "has_more": false
}
```

## `GET /api/analytics/artifacts`

Returns aggregated artifact-related events. The query parameters and pagination behave the
same as the pod endpoint.

### Response

```
{
  "data": [
    {
      "artifact_id": "6b7ccf45-2a29-4c78-8b21-2d3f1ad97f77",
      "bucket_start": "2024-05-20T00:00:00Z",
      "bucket_end": "2024-05-27T00:00:00Z",
      "total": 3
    }
  ],
  "window": "week",
  "page": 1,
  "page_size": 50,
  "has_more": false
}
```

## `POST /api/analytics/events`

Ingests raw analytics events that reference pods, artifacts, or checkout flows. Events are
validated against the schemas exported in `shared/events` and persisted to the
`analytics_events` table for aggregation.

### Request body

```
{
  "events": [
    {
      "type": "pod_entered",
      "pod_id": "a7fcb4fe-5f07-4e20-9af5-15e617c901c6",
      "occurred_at": "2024-05-20T12:00:00Z"
    },
    {
      "type": "artifact_viewed",
      "artifact_id": "6b7ccf45-2a29-4c78-8b21-2d3f1ad97f77",
      "pod_id": "a7fcb4fe-5f07-4e20-9af5-15e617c901c6"
    },
    {
      "type": "checkout_started",
      "artifact_ids": [
        "6b7ccf45-2a29-4c78-8b21-2d3f1ad97f77"
      ],
      "pod_id": "a7fcb4fe-5f07-4e20-9af5-15e617c901c6"
    },
    {
      "type": "sale_completed",
      "order_id": "a4a70e58-9681-49b3-8a68-395e0ae7b2e5",
      "artifact_id": "6b7ccf45-2a29-4c78-8b21-2d3f1ad97f77",
      "pod_id": "a7fcb4fe-5f07-4e20-9af5-15e617c901c6"
    }
  ]
}
```

### Response

The endpoint returns `202 Accepted` once the events have been enqueued. Invalid payloads
respond with `400 Bad Request`.

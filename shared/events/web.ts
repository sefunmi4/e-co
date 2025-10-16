export const EVENT_POD_ENTERED = "pod_entered" as const;
export const EVENT_ARTIFACT_VIEWED = "artifact_viewed" as const;
export const EVENT_CHECKOUT_STARTED = "checkout_started" as const;
export const EVENT_SALE_COMPLETED = "sale_completed" as const;

export type EventType =
  | typeof EVENT_POD_ENTERED
  | typeof EVENT_ARTIFACT_VIEWED
  | typeof EVENT_CHECKOUT_STARTED
  | typeof EVENT_SALE_COMPLETED;

export interface AnalyticsEventPayloadBase {
  type: EventType;
  occurred_at?: string;
}

export interface PodEnteredPayload extends AnalyticsEventPayloadBase {
  type: typeof EVENT_POD_ENTERED;
  pod_id: string;
}

export interface ArtifactViewedPayload extends AnalyticsEventPayloadBase {
  type: typeof EVENT_ARTIFACT_VIEWED;
  artifact_id: string;
  pod_id?: string | null;
}

export interface CheckoutStartedPayload extends AnalyticsEventPayloadBase {
  type: typeof EVENT_CHECKOUT_STARTED;
  artifact_ids: string[];
  pod_id?: string | null;
}

export interface SaleCompletedPayload extends AnalyticsEventPayloadBase {
  type: typeof EVENT_SALE_COMPLETED;
  order_id: string;
  artifact_id: string;
  pod_id?: string | null;
}

export type AnalyticsEventPayload =
  | PodEnteredPayload
  | ArtifactViewedPayload
  | CheckoutStartedPayload
  | SaleCompletedPayload;

export interface AnalyticsClientOptions {
  endpoint?: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

const DEFAULT_ENDPOINT = "/api/analytics/events";

const normaliseTimestamp = (value?: Date | string): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
};

const sendPayload = async (
  payload: AnalyticsEventPayload,
  { endpoint = DEFAULT_ENDPOINT, headers, fetchImpl }: AnalyticsClientOptions = {},
): Promise<void> => {
  try {
    const body = JSON.stringify({ events: [payload] });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(endpoint, blob);
      if (sent) {
        return;
      }
    }
    const fetcher = fetchImpl ?? (typeof fetch !== "undefined" ? fetch : null);
    if (!fetcher) {
      return;
    }
    await fetcher(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...(headers ?? {}) },
      body,
      keepalive: true,
    });
  } catch (error) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("analytics event dispatch failed", error);
    }
  }
};

export interface PodEnteredInput {
  podId: string;
  occurredAt?: Date | string;
}

export const trackPodEntered = (
  { podId, occurredAt }: PodEnteredInput,
  options?: AnalyticsClientOptions,
) =>
  sendPayload(
    {
      type: EVENT_POD_ENTERED,
      pod_id: podId,
      occurred_at: normaliseTimestamp(occurredAt),
    },
    options,
  );

export interface ArtifactViewedInput {
  artifactId: string;
  podId?: string | null;
  occurredAt?: Date | string;
}

export const trackArtifactViewed = (
  { artifactId, podId, occurredAt }: ArtifactViewedInput,
  options?: AnalyticsClientOptions,
) =>
  sendPayload(
    {
      type: EVENT_ARTIFACT_VIEWED,
      artifact_id: artifactId,
      pod_id: podId ?? undefined,
      occurred_at: normaliseTimestamp(occurredAt),
    },
    options,
  );

export interface CheckoutStartedInput {
  artifactIds: string[];
  podId?: string | null;
  occurredAt?: Date | string;
}

export const trackCheckoutStarted = (
  { artifactIds, podId, occurredAt }: CheckoutStartedInput,
  options?: AnalyticsClientOptions,
) => {
  if (!Array.isArray(artifactIds) || artifactIds.length === 0) {
    return Promise.resolve();
  }
  return sendPayload(
    {
      type: EVENT_CHECKOUT_STARTED,
      artifact_ids: artifactIds,
      pod_id: podId ?? undefined,
      occurred_at: normaliseTimestamp(occurredAt),
    },
    options,
  );
};

export interface SaleCompletedInput {
  orderId: string;
  artifactId: string;
  podId?: string | null;
  occurredAt?: Date | string;
}

export const trackSaleCompleted = (
  { orderId, artifactId, podId, occurredAt }: SaleCompletedInput,
  options?: AnalyticsClientOptions,
) =>
  sendPayload(
    {
      type: EVENT_SALE_COMPLETED,
      order_id: orderId,
      artifact_id: artifactId,
      pod_id: podId ?? undefined,
      occurred_at: normaliseTimestamp(occurredAt),
    },
    options,
  );

export type { AnalyticsEventPayload as AnalyticsEventEnvelope };

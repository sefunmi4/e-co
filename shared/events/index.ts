export type EventOrigin = "client" | "server";

export interface PodEnteredEvent {
  pod_id: string;
  user_id?: string;
  session_id?: string;
  occurred_at: string;
  referrer?: string | null;
  origin?: EventOrigin;
}

export interface ArtifactViewedEvent {
  artifact_id: string;
  pod_id?: string;
  user_id?: string;
  surface?: string;
  variant_id?: string;
  occurred_at: string;
  origin?: EventOrigin;
}

export interface CheckoutStartedEvent {
  order_id?: string;
  user_id?: string;
  cart_total_cents?: number;
  item_count?: number;
  occurred_at: string;
  origin?: EventOrigin;
  metadata?: unknown;
}

export interface SaleRecordedEvent {
  order_id: string;
  user_id: string;
  total_cents: number;
  occurred_at: string;
  origin?: EventOrigin;
  status?: string;
}

export type AnalyticsEvent =
  | ({ type: "pod_entered" } & PodEnteredEvent)
  | ({ type: "artifact_viewed" } & ArtifactViewedEvent)
  | ({ type: "checkout_started" } & CheckoutStartedEvent)
  | ({ type: "sale_recorded" } & SaleRecordedEvent);

export const ANALYTICS_ENDPOINT = "/api/analytics/events";

export const isAnalyticsEvent = (value: unknown): value is AnalyticsEvent => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.type !== "string") {
    return false;
  }
  const { type } = record;
  return (
    type === "pod_entered" ||
    type === "artifact_viewed" ||
    type === "checkout_started" ||
    type === "sale_recorded"
  );
};

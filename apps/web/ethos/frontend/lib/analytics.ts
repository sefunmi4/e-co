import {
  ANALYTICS_ENDPOINT,
  type AnalyticsEvent,
  type CheckoutStartedEvent,
  type SaleRecordedEvent,
} from '@shared/events';

const DEFAULT_GATEWAY_URL = 'http://localhost:8080';

const resolveGatewayBase = () => {
  const configured = process.env.NEXT_PUBLIC_GATEWAY_URL;
  if (!configured) {
    return DEFAULT_GATEWAY_URL;
  }
  return configured.endsWith('/') ? configured.slice(0, -1) : configured;
};

const resolveEndpoint = () => `${resolveGatewayBase()}${ANALYTICS_ENDPOINT}`;

export async function sendAnalyticsEvent(event: AnalyticsEvent) {
  try {
    await fetch(resolveEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Failed to send analytics event', error);
    }
  }
}

export async function trackCheckoutStarted(context: {
  orderId?: string;
  userId?: string;
  cartTotalCents?: number;
  itemCount?: number;
  metadata?: unknown;
}) {
  const event: CheckoutStartedEvent & { type: 'checkout_started' } = {
    type: 'checkout_started',
    order_id: context.orderId,
    user_id: context.userId,
    cart_total_cents: context.cartTotalCents,
    item_count: context.itemCount,
    metadata: context.metadata,
    occurred_at: new Date().toISOString(),
    origin: 'client',
  };
  await sendAnalyticsEvent(event);
}

export async function trackSaleRecorded(context: {
  orderId: string;
  userId: string;
  totalCents: number;
  status?: string;
}) {
  const event: SaleRecordedEvent & { type: 'sale_recorded' } = {
    type: 'sale_recorded',
    order_id: context.orderId,
    user_id: context.userId,
    total_cents: context.totalCents,
    status: context.status,
    occurred_at: new Date().toISOString(),
    origin: 'client',
  };
  await sendAnalyticsEvent(event);
}

import {
  ANALYTICS_ENDPOINT,
  type AnalyticsEvent,
  type ArtifactViewedEvent,
  type PodEnteredEvent,
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

async function send(event: AnalyticsEvent) {
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
      console.warn('Failed to publish analytics event', error);
    }
  }
}

export function trackPodEntered(context: {
  podId: string;
  userId?: string;
  sessionId?: string;
  referrer?: string | null;
}) {
  const event: PodEnteredEvent & { type: 'pod_entered' } = {
    type: 'pod_entered',
    pod_id: context.podId,
    user_id: context.userId,
    session_id: context.sessionId,
    referrer: context.referrer ?? undefined,
    occurred_at: new Date().toISOString(),
    origin: 'client',
  };
  void send(event);
}

export function trackArtifactViewed(context: {
  artifactId: string;
  podId?: string;
  surface?: string;
}) {
  const event: ArtifactViewedEvent & { type: 'artifact_viewed' } = {
    type: 'artifact_viewed',
    artifact_id: context.artifactId,
    pod_id: context.podId,
    surface: context.surface,
    occurred_at: new Date().toISOString(),
    origin: 'client',
  };
  void send(event);
}

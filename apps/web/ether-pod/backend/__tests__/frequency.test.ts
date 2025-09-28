import { describe, expect, beforeEach, it, vi } from 'vitest';
import getFrequency, {
  ensureFrequencySubscription,
  resetFrequencySubscriptions,
} from '@backend/lib/frequency';
import {
  overrideActionsClientFactory,
  resetActionsClientFactory,
  type ActionsClient,
} from '@backend/grpc/actionsClient';
import {
  DEFAULT_FREQUENCY,
  DEFAULT_JOB_ID,
  resetFrequencyStore,
} from '@frontend/state/frequency';

describe('frequency streaming', () => {
  beforeEach(() => {
    resetFrequencyStore();
    resetFrequencySubscriptions();
    resetActionsClientFactory();
  });

  it('subscribes once and applies streaming updates', async () => {
    const updates = [0.12, 0.27];
    const mockClient: Partial<ActionsClient> = {
      streamFrequencies: vi.fn(async function* ({ jobId }: { jobId: string }) {
        for (const value of updates) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          yield {
            jobId,
            frequency: value,
            amplitude: 0.5,
            timestampMs: BigInt(Date.now()),
          };
        }
      }),
      cast: vi.fn(),
      evaluate: vi.fn(),
      recognizeGesture: vi.fn(),
    };

    overrideActionsClientFactory(() => mockClient as ActionsClient);

    const initial = getFrequency();
    expect(initial).toBe(DEFAULT_FREQUENCY);

    ensureFrequencySubscription(DEFAULT_JOB_ID);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const current = getFrequency();
    expect(current).toBeCloseTo(updates[updates.length - 1], 5);
  });
});

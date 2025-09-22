import { createActionsClient } from "@backend/grpc/actionsClient";
import {
  DEFAULT_FREQUENCY,
  DEFAULT_JOB_ID,
  getFrequencyValue,
  setFrequency,
} from "@frontend/state/frequency";

type SubscriptionMap = Map<string, Promise<void>>;

const subscriptions: SubscriptionMap = new Map();

const subscribeToJob = async (jobId: string) => {
  try {
    const client = createActionsClient();
    const stream = client.streamFrequencies({ jobId });
    for await (const update of stream) {
      const timestamp =
        typeof update.timestampMs === "bigint"
          ? Number(update.timestampMs)
          : Number(update.timestampMs ?? Date.now());
      const value = typeof update.frequency === "number" ? update.frequency : DEFAULT_FREQUENCY;
      setFrequency(jobId, value, timestamp);
    }
  } catch (err) {
    console.error("frequency stream failed", err);
    subscriptions.delete(jobId);
  }
};

export const ensureFrequencySubscription = (jobId: string = DEFAULT_JOB_ID) => {
  if (!subscriptions.has(jobId)) {
    const task = subscribeToJob(jobId);
    subscriptions.set(jobId, task);
    task.catch((err) => {
      console.error("frequency subscription error", err);
      subscriptions.delete(jobId);
    });
  }
};

export const resetFrequencySubscriptions = () => {
  subscriptions.clear();
};

export default function getFrequency(jobId: string = DEFAULT_JOB_ID): number {
  ensureFrequencySubscription(jobId);
  return getFrequencyValue(jobId);
}

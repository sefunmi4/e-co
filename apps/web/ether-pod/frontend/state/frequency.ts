import { create } from "zustand";

export const DEFAULT_FREQUENCY = 0.05;
export const DEFAULT_JOB_ID = "ether-pod-terrain";

type FrequencyState = {
  values: Record<string, number>;
  updatedAt: Record<string, number>;
  setFrequency: (jobId: string, value: number, timestamp?: number) => void;
};

export const useFrequencyStore = create<FrequencyState>((set) => ({
  values: {},
  updatedAt: {},
  setFrequency: (jobId, value, timestamp) =>
    set((state) => ({
      values: { ...state.values, [jobId]: value },
      updatedAt: { ...state.updatedAt, [jobId]: timestamp ?? Date.now() },
    })),
}));

export const setFrequency = (jobId: string, value: number, timestamp?: number) =>
  useFrequencyStore.getState().setFrequency(jobId, value, timestamp);

export const getFrequencyValue = (jobId: string) =>
  useFrequencyStore.getState().values[jobId] ?? DEFAULT_FREQUENCY;

export const resetFrequencyStore = () =>
  useFrequencyStore.setState({ values: {}, updatedAt: {} });

export const useFrequency = (jobId: string) =>
  useFrequencyStore((state) => state.values[jobId] ?? DEFAULT_FREQUENCY);

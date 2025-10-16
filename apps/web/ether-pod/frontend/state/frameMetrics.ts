import { create } from "zustand";

type FrameMetrics = {
  fps: number;
  averageFps: number;
  minFps: number;
  samples: number;
  targetFps: number;
  update: (metrics: { fps: number; averageFps: number; minFps: number; samples: number }) => void;
  reset: () => void;
};

const TARGET_FPS = 45;

export const useFrameMetricsStore = create<FrameMetrics>((set) => ({
  fps: TARGET_FPS,
  averageFps: TARGET_FPS,
  minFps: TARGET_FPS,
  samples: 0,
  targetFps: TARGET_FPS,
  update: ({ fps, averageFps, minFps, samples }) =>
    set({ fps, averageFps, minFps, samples }),
  reset: () =>
    set({
      fps: TARGET_FPS,
      averageFps: TARGET_FPS,
      minFps: TARGET_FPS,
      samples: 0,
      targetFps: TARGET_FPS,
    }),
}));

export const useFrameMetrics = () =>
  useFrameMetricsStore((state) => ({
    fps: state.fps,
    averageFps: state.averageFps,
    minFps: state.minFps,
    samples: state.samples,
    targetFps: state.targetFps,
  }));

export const updateFrameMetrics = (
  metrics: Pick<FrameMetrics, "fps" | "averageFps" | "minFps" | "samples">,
) => useFrameMetricsStore.getState().update(metrics);

export const resetFrameMetrics = () =>
  useFrameMetricsStore.getState().reset();

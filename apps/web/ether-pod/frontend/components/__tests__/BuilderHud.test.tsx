import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { act, beforeEach, describe, expect, it } from "vitest";
import BuilderHud from "../BuilderHud";
import {
  resetLightingStore,
  useLightingStore,
} from "@frontend/state/lighting";
import {
  resetFrameMetrics,
  updateFrameMetrics,
} from "@frontend/state/frameMetrics";

describe("BuilderHud", () => {
  beforeEach(() => {
    resetLightingStore();
    resetFrameMetrics();
  });

  it("renders lighting options and reflects the current preset", () => {
    render(<BuilderHud />);
    const select = screen.getByLabelText("Lighting preset") as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe("day");
    expect(screen.getByText("Builder HUD")).toBeInTheDocument();
  });

  it("updates the lighting preset when a new option is selected", () => {
    render(<BuilderHud />);
    const select = screen.getByLabelText("Lighting preset") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "night" } });
    expect(select.value).toBe("night");
    expect(useLightingStore.getState().preset).toBe("night");
  });

  it("displays frame metrics and status based on performance", () => {
    render(<BuilderHud />);
    const fps = screen.getByText(/FPS/i).nextElementSibling;
    expect(fps?.textContent).toBe("45");

    act(() => {
      updateFrameMetrics({ fps: 38.4, averageFps: 38.4, minFps: 32.1, samples: 12 });
    });

    expect(screen.getByText("Profiling")).toBeInTheDocument();
    const avg = screen.getByText(/Avg/i).nextElementSibling;
    expect(avg?.textContent).toBe("38");
    const min = screen.getByText(/Min/i).nextElementSibling;
    expect(min?.textContent).toBe("32");

    act(() => {
      updateFrameMetrics({ fps: 62.2, averageFps: 58.6, minFps: 48.4, samples: 18 });
    });

    expect(screen.getByText("On Target")).toBeInTheDocument();
    const fpsNode = screen.getByText(/FPS/i).nextElementSibling;
    expect(fpsNode?.textContent).toBe("62");
  });
});

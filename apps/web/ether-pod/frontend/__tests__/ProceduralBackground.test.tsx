import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProceduralBackground from '../components/ProceduralBackground';
import {
  DEFAULT_FREQUENCY,
  DEFAULT_JOB_ID,
  resetFrequencyStore,
  setFrequency,
} from '@frontend/state/frequency';
import { resetFrameMetrics } from '@frontend/state/frameMetrics';

const fiberMocks = vi.hoisted(() => ({
  scene: { background: null as unknown, fog: null as unknown },
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="terrain-canvas" {...props}>
      {children}
    </div>
  ),
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    callback({}, 1 / 60);
  },
  useThree: () => fiberMocks.scene,
}));

vi.mock('@react-three/drei', () => ({
  PointerLockControls: () => null,
}));

vi.mock('three', () => {
  class MockBufferAttribute {
    count = 1;
    getX = vi.fn(() => 0);
    getY = vi.fn(() => 0);
    setZ = vi.fn();
  }

  class MockPlaneGeometry {
    attributes = { position: new MockBufferAttribute() };
    computeVertexNormals = vi.fn();
  }

  class MockColor {
    value: string;
    constructor(value: string) {
      this.value = value;
    }
  }

  class MockFog {
    color: string;
    near: number;
    far: number;
    constructor(color: string, near: number, far: number) {
      this.color = color;
      this.near = near;
      this.far = far;
    }
  }

  return {
    PlaneGeometry: MockPlaneGeometry,
    BufferAttribute: MockBufferAttribute,
    Color: MockColor,
    Fog: MockFog,
  };
});

const frequencyMocks = vi.hoisted(() => ({
  ensureFrequencySubscription: vi.fn(),
}));

const { ensureFrequencySubscription } = frequencyMocks;

vi.mock('@backend/lib/frequency', () => ({
  __esModule: true,
  ensureFrequencySubscription: frequencyMocks.ensureFrequencySubscription,
  default: () => DEFAULT_FREQUENCY,
}));

vi.mock('simplex-noise', () => {
  return {
    __esModule: true,
    default: class {
      noise2D() {
        return 0.5;
      }
    },
  };
});

describe('ProceduralBackground', () => {
  beforeEach(() => {
    resetFrequencyStore();
    resetFrameMetrics();
    ensureFrequencySubscription.mockClear();
  });

  it('reflects frequency updates from the store', async () => {
    render(<ProceduralBackground />);

    const canvas = await screen.findByTestId('terrain-canvas');
    expect(canvas.getAttribute('data-frequency')).toBe(
      String(DEFAULT_FREQUENCY)
    );

    act(() => {
      setFrequency(DEFAULT_JOB_ID, 0.31);
    });

    await waitFor(() => {
      expect(canvas.getAttribute('data-frequency')).toBe('0.31');
      expect(canvas.getAttribute('data-lighting')).toBeDefined();
    });

    expect(ensureFrequencySubscription).toHaveBeenCalledWith(DEFAULT_JOB_ID);
  });
});

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

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, ...props }: { children: React.ReactNode }) => (
    <div data-testid="terrain-canvas" {...props}>
      {children}
    </div>
  ),
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

  return {
    PlaneGeometry: MockPlaneGeometry,
    BufferAttribute: MockBufferAttribute,
  };
});

const frequencyMocks = vi.hoisted(() => ({
  ensureFrequencySubscription: vi.fn(),
}));

const { ensureFrequencySubscription } = frequencyMocks;

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

vi.mock('@backend/lib/frequency', () => ({
  __esModule: true,
  ensureFrequencySubscription: frequencyMocks.ensureFrequencySubscription,
  default: () => DEFAULT_FREQUENCY,
}));

describe('ProceduralBackground', () => {
  beforeEach(() => {
    resetFrequencyStore();
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
    });

    expect(ensureFrequencySubscription).toHaveBeenCalledWith(DEFAULT_JOB_ID);
  });
});

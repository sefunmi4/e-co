import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SnapshotSceneHydrator from '../SnapshotSceneHydrator';
import type { SnapshotManifest, SnapshotTour } from '@backend/lib/pods';

const manifest: SnapshotManifest = {
  nodes: [{ id: 'origin', position: [0, 0, 0] }],
};

const tour: SnapshotTour = {
  steps: [
    { target: 'origin', description: 'Center of the world' },
  ],
};

describe('SnapshotSceneHydrator', () => {
  const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

  beforeEach(() => {
    dispatchEventSpy.mockClear();
  });

  afterEach(() => {
    dispatchEventSpy.mockReset();
  });

  it('exposes the manifest and hydrates the scene', async () => {
    render(<SnapshotSceneHydrator slug="aurora" manifest={manifest} />);
    expect(screen.getByTestId('scene-loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('scene-ready')).toBeInTheDocument();
    });

    const scopedWindow = window as unknown as {
      __ECO_ACTIVE_SCENE__?: { slug: string; manifest: SnapshotManifest };
    };

    expect(scopedWindow.__ECO_ACTIVE_SCENE__).toMatchObject({
      slug: 'aurora',
      manifest,
    });
    expect(screen.getByTestId('scene-manifest-json')).toHaveTextContent('origin');
  });

  it('applies tours and dispatches tour events', async () => {
    render(<SnapshotSceneHydrator slug="aurora" manifest={manifest} tour={tour} />);

    await waitFor(() => {
      expect(screen.getByTestId('scene-tour-json')).toBeInTheDocument();
    });

    const scopedWindow = window as unknown as { __ECO_ACTIVE_TOUR__?: SnapshotTour | null };
    expect(scopedWindow.__ECO_ACTIVE_TOUR__).toEqual(tour);
    expect(dispatchEventSpy).toHaveBeenCalled();
    const event = dispatchEventSpy.mock.calls[0]?.[0] as CustomEvent;
    expect(event.type).toBe('eco:tour:apply');
    expect(event.detail.slug).toBe('aurora');
  });
});


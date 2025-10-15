"use client";

import { useEffect, useState } from 'react';
import type { SnapshotManifest, SnapshotTour } from '@backend/lib/pods';

interface Props {
  slug: string;
  manifest: SnapshotManifest;
  tour?: SnapshotTour | null;
}

interface WindowWithEco extends Window {
  __ECO_ACTIVE_SCENE__?: { slug: string; manifest: SnapshotManifest };
  __ECO_ACTIVE_TOUR__?: SnapshotTour | null;
}

const applyTour = (tour: SnapshotTour | null | undefined, slug: string) => {
  const scopedWindow = window as WindowWithEco;
  scopedWindow.__ECO_ACTIVE_TOUR__ = tour ?? null;
  if (tour) {
    const event = new CustomEvent('eco:tour:apply', {
      detail: { slug, tour },
    });
    window.dispatchEvent(event);
  }
};

const exposeManifest = (manifest: SnapshotManifest, slug: string) => {
  const scopedWindow = window as WindowWithEco;
  scopedWindow.__ECO_ACTIVE_SCENE__ = { slug, manifest };
};

export default function SnapshotSceneHydrator({ slug, manifest, tour }: Props) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    exposeManifest(manifest, slug);
    applyTour(tour ?? null, slug);
    const timer = window.setTimeout(() => {
      setHydrated(true);
    }, 0);
    return () => {
      const scopedWindow = window as WindowWithEco;
      if (scopedWindow.__ECO_ACTIVE_SCENE__?.slug === slug) {
        delete scopedWindow.__ECO_ACTIVE_SCENE__;
      }
      if (scopedWindow.__ECO_ACTIVE_TOUR__) {
        scopedWindow.__ECO_ACTIVE_TOUR__ = null;
      }
      window.clearTimeout(timer);
    };
  }, [manifest, slug, tour]);

  if (!hydrated) {
    return (
      <div
        className="rounded-lg border border-indigo-500/40 bg-indigo-900/40 px-6 py-4 text-indigo-100 shadow-lg"
        data-testid="scene-loading"
      >
        Preparing scene…
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-3xl space-y-4 rounded-xl border border-indigo-400/40 bg-slate-950/70 p-6 text-left text-indigo-100 shadow-xl"
      data-testid="scene-ready"
    >
      <section aria-labelledby="scene-manifest" className="space-y-2">
        <header>
          <h2 id="scene-manifest" className="text-sm font-semibold uppercase tracking-wide text-indigo-200">
            Scene Manifest
          </h2>
        </header>
        <pre className="max-h-64 overflow-auto rounded bg-slate-900/80 p-3 text-xs" data-testid="scene-manifest-json">
          {JSON.stringify(manifest, null, 2)}
        </pre>
      </section>
      {tour && (
        <section aria-labelledby="scene-tour" className="space-y-2">
          <header>
            <h2 id="scene-tour" className="text-sm font-semibold uppercase tracking-wide text-indigo-200">
              Guided Tour
            </h2>
          </header>
          <pre className="max-h-48 overflow-auto rounded bg-slate-900/80 p-3 text-xs" data-testid="scene-tour-json">
            {JSON.stringify(tour, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}


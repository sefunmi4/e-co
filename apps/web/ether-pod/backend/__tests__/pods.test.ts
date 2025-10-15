import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchSnapshotExperience,
  type PodSnapshot,
  type SnapshotManifest,
  type SnapshotTour,
} from '../lib/pods';

const buildSnapshot = (overrides: Partial<PodSnapshot> = {}): PodSnapshot => ({
  artifact_id: 'artifact-alpha',
  owner_id: 'owner-1',
  published_at: new Date().toISOString(),
  pod: {
    id: 'pod-alpha',
    owner_id: 'owner-1',
    title: 'Aurora Research Pod',
    description: 'A curated exploration of Aurora.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  items: [],
  ...overrides,
});

describe('fetchSnapshotExperience', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads snapshot manifests and tours from provided URLs', async () => {
    const manifest: SnapshotManifest = { root: 'aurora', scenes: [] };
    const tour: SnapshotTour = { steps: [{ id: 'intro' }] };

    const snapshots: PodSnapshot[] = [
      buildSnapshot({
        items: [
          {
            id: 'item-manifest',
            pod_id: 'pod-alpha',
            item_type: 'snapshot_manifest',
            item_data: { url: 'https://indexer.example/p/aurora/manifest.json' },
            position: 0,
            created_at: new Date().toISOString(),
          },
          {
            id: 'item-tour',
            pod_id: 'pod-alpha',
            item_type: 'tour',
            item_data: { url: 'https://indexer.example/p/aurora/tour.json' },
            position: 1,
            created_at: new Date().toISOString(),
          },
        ],
      }),
    ];

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => snapshots })
      .mockResolvedValueOnce({ ok: true, json: async () => manifest })
      .mockResolvedValueOnce({ ok: true, json: async () => tour });

    vi.stubGlobal('fetch', fetchMock);

    const experience = await fetchSnapshotExperience('artifact-alpha');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(experience?.manifest).toEqual(manifest);
    expect(experience?.tour).toEqual(tour);
    expect(experience?.manifestUrl).toContain('manifest.json');
    expect(experience?.tourUrl).toContain('tour.json');
  });

  it('matches snapshots using slugified titles', async () => {
    const snapshots: PodSnapshot[] = [
      buildSnapshot({
        artifact_id: 'different',
        pod: {
          id: 'pod-2',
          owner_id: 'owner-1',
          title: 'Deep Space Archives',
          description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        items: [
          {
            id: 'inline-manifest',
            pod_id: 'pod-2',
            item_type: 'manifest',
            item_data: { scenes: [] },
            position: 0,
            created_at: new Date().toISOString(),
          },
        ],
      }),
    ];

    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => snapshots });

    vi.stubGlobal('fetch', fetchMock);

    const experience = await fetchSnapshotExperience('deep-space-archives');

    expect(experience).not.toBeNull();
    expect(experience?.manifest).toMatchObject({ scenes: [] });
  });

  it('returns null when no snapshot matches the slug', async () => {
    const snapshots: PodSnapshot[] = [buildSnapshot()];
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => snapshots });
    vi.stubGlobal('fetch', fetchMock);

    const experience = await fetchSnapshotExperience('missing');
    expect(experience).toBeNull();
  });

  it('throws when the gateway responds with an error', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 502 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchSnapshotExperience('broken')).rejects.toThrow('Gateway responded with status 502');
  });
});


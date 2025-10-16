import { env } from '@e-co/config';
import { error as logError } from '@eco/js-sdk/logger';
import {
  deserializeSnapshot,
  serializeSnapshot,
  type BuilderSnapshot,
  type SerializedPrimitive,
} from '../../src/builder';

const resolveEcoApiBase = () => env.etherPod.ecoApiUrl;

const resolveIndexerBase = () => env.etherPod.ecoIndexerUrl;

export interface PodSnapshot {
  artifact_id: string;
  owner_id: string;
  pod: PodSummary;
  items: PodItem[];
  published_at: string;
}

export interface PodSummary {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PodItem {
  id: string;
  pod_id: string;
  artifact_id?: string | null;
  item_type: string;
  item_data: unknown;
  position: number;
  created_at: string;
}

const BUILDER_SNAPSHOT_ITEM_TYPE = 'builder_snapshot';

const parseBuilderSnapshot = (payload: unknown): BuilderSnapshot | null => {
  if (!isRecord(payload)) {
    return null;
  }
  const { version, primitives } = payload;
  if (typeof version !== 'number' || !Array.isArray(primitives)) {
    return null;
  }
  if (!primitives.every(isSerializedPrimitive)) {
    return null;
  }
  const snapshot: BuilderSnapshot = {
    version,
    primitives: (primitives as SerializedPrimitive[]).map((primitive) => ({
      ...primitive,
      metadata: primitive.metadata ? { ...primitive.metadata } : undefined,
    })),
  };
  try {
    const normalised = serializeSnapshot(deserializeSnapshot(snapshot));
    return normalised;
  } catch (error) {
    logError('Failed to normalise builder snapshot', error);
    return null;
  }
};

const buildSnapshotPayload = (snapshot: BuilderSnapshot): BuilderSnapshot => {
  const primitives = serializeSnapshot(snapshot.primitives);
  return {
    version: primitives.version,
    primitives: primitives.primitives,
  };
};

export type SnapshotManifest = Record<string, unknown>;
export type SnapshotTour = Record<string, unknown>;

export interface SnapshotExperience {
  snapshot: PodSnapshot;
  manifest: SnapshotManifest;
  manifestUrl: string;
  tour?: SnapshotTour | null;
  tourUrl?: string | null;
}

interface ManifestResolutionResult {
  manifest: SnapshotManifest;
  manifestUrl: string;
}

interface TourResolutionResult {
  tour: SnapshotTour | null;
  tourUrl: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isVector = (value: unknown): value is { x: number; y: number; z: number } =>
  isRecord(value) && ['x', 'y', 'z'].every((axis) => typeof value[axis] === 'number');

const isSerializedPrimitive = (value: unknown): value is SerializedPrimitive =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.kind === 'string' &&
  isVector(value.position) &&
  isVector(value.rotation) &&
  isVector(value.scale);

const sanitizeSlug = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

const resolveSlugCandidates = (snapshot: PodSnapshot) => {
  const candidates = new Set<string>();
  if (snapshot.artifact_id) {
    candidates.add(snapshot.artifact_id.toLowerCase());
  }
  if (snapshot.pod.id) {
    candidates.add(snapshot.pod.id.toLowerCase());
  }
  if (snapshot.pod.title) {
    candidates.add(sanitizeSlug(snapshot.pod.title));
  }
  return candidates;
};

const findSnapshot = (snapshots: PodSnapshot[], slug: string) => {
  const normalizedSlug = slug.toLowerCase();
  return snapshots.find((candidate) => {
    const possible = resolveSlugCandidates(candidate);
    return possible.has(normalizedSlug);
  });
};

const resolveManifestCandidate = (snapshot: PodSnapshot) =>
  snapshot.items.find((item) => /manifest|snapshot/i.test(item.item_type));

const resolveTourCandidate = (snapshot: PodSnapshot) =>
  snapshot.items.find((item) => /tour/i.test(item.item_type));

const extractUrl = (
  payload: unknown,
  { fallbackBase, kind }: { fallbackBase: string | null; kind: 'manifest' | 'tour' },
): string | null => {
  if (typeof payload === 'string' && payload.trim()) {
    return absolutizeUrl(payload.trim(), fallbackBase);
  }
  if (!isRecord(payload)) {
    return null;
  }
  const keys = [
    `${kind}Url`,
    `${kind}_url`,
    'url',
    'href',
    'source',
  ];
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return absolutizeUrl(value.trim(), fallbackBase);
    }
  }
  return null;
};

const absolutizeUrl = (value: string, base: string | null) => {
  try {
    return new URL(value).toString();
  } catch (error) {
    if (!base) {
      return value;
    }
    try {
      return new URL(value, base.endsWith('/') ? base : `${base}/`).toString();
    } catch (nested) {
      return value;
    }
  }
};

const fetchJson = async <T>(
  url: string,
  { label, optional }: { label: string; optional?: boolean },
): Promise<T | null> => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    if (optional && response.status === 404) {
      return null;
    }
    throw new Error(`${label} request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
};

const fallbackUrl = (slug: string, file: string, base: string | null) => {
  if (!base) return null;
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmedBase}/p/${encodeURIComponent(slug)}/${file}`;
};

const resolveManifest = async (
  snapshot: PodSnapshot,
  slug: string,
  indexerBase: string | null,
): Promise<ManifestResolutionResult> => {
  const candidate = resolveManifestCandidate(snapshot);
  if (candidate) {
    const { item_data: data } = candidate;
    if (isRecord(data) && (data.scenes || data.root || data.nodes)) {
      return {
        manifest: data as SnapshotManifest,
        manifestUrl: 'inline',
      };
    }
    const url = extractUrl(data, { kind: 'manifest', fallbackBase: indexerBase });
    if (url) {
      const manifest = await fetchJson<SnapshotManifest>(url, {
        label: 'Snapshot manifest',
      });
      return { manifest, manifestUrl: url };
    }
    if (typeof data === 'string') {
      const manifest = await fetchJson<SnapshotManifest>(data, {
        label: 'Snapshot manifest',
      });
      return { manifest, manifestUrl: data };
    }
  }
  const fallback = fallbackUrl(slug, 'manifest.json', indexerBase);
  if (fallback) {
    const manifest = await fetchJson<SnapshotManifest>(fallback, {
      label: 'Snapshot manifest',
    });
    return { manifest, manifestUrl: fallback };
  }
  throw new Error('Snapshot manifest not available');
};

const resolveTour = async (
  snapshot: PodSnapshot,
  slug: string,
  indexerBase: string | null,
): Promise<TourResolutionResult> => {
  const candidate = resolveTourCandidate(snapshot);
  if (candidate) {
    const { item_data: data } = candidate;
    if (isRecord(data) && data.steps) {
      return { tour: data as SnapshotTour, tourUrl: 'inline' };
    }
    const url = extractUrl(data, { kind: 'tour', fallbackBase: indexerBase });
    if (url) {
      try {
        const tour = await fetchJson<SnapshotTour>(url, {
          label: 'Snapshot tour',
          optional: true,
        });
        return { tour, tourUrl: tour ? url : null };
      } catch (error) {
        logError('Failed to fetch snapshot tour', error);
        return { tour: null, tourUrl: null };
      }
    }
  }
  const fallback = fallbackUrl(slug, 'tour.json', indexerBase);
  if (!fallback) {
    return { tour: null, tourUrl: null };
  }
  try {
    const tour = await fetchJson<SnapshotTour>(fallback, {
      label: 'Snapshot tour',
      optional: true,
    });
    return { tour, tourUrl: tour ? fallback : null };
  } catch (error) {
    logError('Failed to fetch snapshot tour', error);
    return { tour: null, tourUrl: null };
  }
};

export const fetchSnapshotExperience = async (
  slug: string,
): Promise<SnapshotExperience | null> => {
  const apiBase = resolveEcoApiBase();
  const indexerBase = resolveIndexerBase();
  const response = await fetch(new URL('/api/public/pods', apiBase), { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Gateway responded with status ${response.status}`);
  }
  const snapshots = (await response.json()) as PodSnapshot[];
  const snapshot = findSnapshot(snapshots, slug);
  if (!snapshot) {
    return null;
  }
  const { manifest, manifestUrl } = await resolveManifest(snapshot, slug, indexerBase);
  const { tour, tourUrl } = await resolveTour(snapshot, slug, indexerBase);
  return { snapshot, manifest, manifestUrl, tour: tour ?? null, tourUrl: tourUrl ?? null };
};

export const extractBuilderSnapshot = (snapshot: PodSnapshot): BuilderSnapshot | null => {
  const candidate = snapshot.items.find(
    (item) => item.item_type === BUILDER_SNAPSHOT_ITEM_TYPE,
  );
  if (!candidate) {
    return null;
  }
  return parseBuilderSnapshot(candidate.item_data);
};

interface PersistBuilderSnapshotOptions {
  podId: string;
  snapshot: BuilderSnapshot;
  token?: string;
  visibility?: string;
}

export const persistBuilderSnapshot = async ({
  podId,
  snapshot,
  token,
  visibility = 'public',
}: PersistBuilderSnapshotOptions) => {
  const apiBase = resolveEcoApiBase();
  const url = new URL(`/api/pods/${encodeURIComponent(podId)}/hydrate`, apiBase);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const payload = buildSnapshotPayload(snapshot);
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      snapshot: payload,
      visibility,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to persist builder snapshot (status ${response.status})`);
  }
  return (await response.json()) as PodItem;
};


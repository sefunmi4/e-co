import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { parse as parseToml } from 'toml';

export interface WorldCard {
  id: string;
  name: string;
  summary: string;
  entry_scene: string;
  portals: string[];
}

const resolveWorldRoot = () => {
  const candidates = [
    process.env.ECO_MANIFEST_ROOT,
    path.resolve(process.cwd(), 'examples/worlds'),
    path.resolve(process.cwd(), '../examples/worlds'),
    path.resolve(process.cwd(), '../../examples/worlds'),
    path.resolve(process.cwd(), '../../../examples/worlds'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(process.cwd(), 'examples/worlds');
};

const worldRoot = resolveWorldRoot();

export const searchWorldCards = async (query: string, limit = 6): Promise<WorldCard[]> => {
  const trimmed = query.trim();
  const gateway = process.env.ECO_API_URL ?? 'http://localhost:8080';

  if (trimmed) {
    try {
      const url = new URL('/query', gateway);
      url.searchParams.set('q', trimmed);
      url.searchParams.set('limit', String(limit));
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        const payload = (await response.json()) as { results: WorldCard[] };
        return payload.results;
      }
    } catch (error) {
      console.warn('eco-api unavailable, falling back to local manifests', error);
    }
  }

  const entries = await fs.readdir(worldRoot, { withFileTypes: true });
  const matches: WorldCard[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(worldRoot, entry.name, 'ECO.toml');
    try {
      const raw = await fs.readFile(manifestPath, 'utf-8');
      const manifest = parseToml(raw) as {
        name?: string;
        version?: string;
        entry_scene?: string;
        portals?: Array<{ target?: string }>;
        summary?: string;
      };
      const portals = (manifest.portals ?? [])
        .map((portal) => portal?.target)
        .filter((target): target is string => Boolean(target));
      const card: WorldCard = {
        id: entry.name,
        name: manifest.name ?? entry.name,
        summary:
          manifest.summary ??
          `${manifest.name ?? entry.name} v${manifest.version ?? '0.0.0'} with ${portals.length} portals`,
        entry_scene: manifest.entry_scene ?? '',
        portals,
      };
      if (!trimmed) {
        matches.push(card);
        continue;
      }
      const haystack = [
        card.name.toLowerCase(),
        card.summary.toLowerCase(),
        card.entry_scene.toLowerCase(),
        ...portals.map((p) => p.toLowerCase()),
      ];
      if (haystack.some((field) => field.includes(trimmed.toLowerCase()))) {
        matches.push(card);
      }
    } catch (error) {
      console.warn('Failed to load ECO manifest for search', manifestPath, error);
    }
  }

  matches.sort((a, b) => a.name.localeCompare(b.name));
  return matches.slice(0, limit);
};

export const readEcoManifest = async <T = Record<string, unknown>>(worldId: string): Promise<T> => {
  const manifestPath = path.join(worldRoot, worldId, 'ECO.toml');
  const content = await fs.readFile(manifestPath, 'utf-8');
  return parseToml(content) as T;
};

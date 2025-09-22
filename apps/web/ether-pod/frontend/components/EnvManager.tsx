"use client";

import type { ComponentType } from 'react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { info, error as logError } from '@eco/js-sdk/logger';
import Window from './Window';
import ProceduralBackground from './ProceduralBackground';

interface Props {
  onWorldChange?: (component: ComponentType | null) => void;
}

interface WorldCard {
  id: string;
  name: string;
  summary: string;
  entry_scene?: string;
  entryScene?: string;
  portals: string[];
}

interface WorldOption {
  id: string;
  name: string;
  summary: string;
  entryScene: string;
  portals: string[];
}

type PortalStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SymbolCastNavigationDetail {
  worldId?: string;
  portalTarget?: string;
}

const ENV_KEY = 'etheros.currentEnv';

const normalizeCard = (card: WorldCard): WorldOption => ({
  id: card.id,
  name: card.name,
  summary: card.summary,
  entryScene: card.entryScene ?? card.entry_scene ?? '',
  portals: card.portals ?? [],
});

const resolveWorldComponent = async (
  entryScene: string,
): Promise<ComponentType | null> => {
  if (!entryScene) {
    return ProceduralBackground;
  }
  try {
    const mod = await import(/* webpackIgnore: true */ entryScene);
    return (mod.default ?? ProceduralBackground) as ComponentType;
  } catch (err) {
    logError('Failed to load entry scene, falling back to procedural background', err);
    return ProceduralBackground;
  }
};

export default function EnvManager({ onWorldChange }: Props) {
  const [query, setQuery] = useState('Aurora');
  const [results, setResults] = useState<WorldOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorld, setSelectedWorld] = useState<WorldOption | null>(null);
  const [portalStatus, setPortalStatus] = useState<Record<string, PortalStatus>>({});

  const fetchWorlds = useCallback(
    async (search: string) => {
      if (!search.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/worlds/search?q=${encodeURIComponent(search)}&limit=6`,
          { cache: 'no-store' },
        );
        if (!response.ok) {
          throw new Error(`Gateway responded with ${response.status}`);
        }
        const payload = (await response.json()) as { results: WorldCard[] };
        const normalized = payload.results.map(normalizeCard);
        setResults(normalized);
        info(`Resolved ${normalized.length} ECO manifests for query`, search);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logError('Failed to fetch ECO manifests', err);
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadPortal = useCallback(async (target: string) => {
    setPortalStatus((prev) => ({ ...prev, [target]: 'loading' }));
    try {
      if (target.endsWith('.wasm') || target.endsWith('.wasm.js')) {
        const response = await fetch(target, { cache: 'reload' });
        if (!response.ok) {
          throw new Error(`Portal module request failed: ${response.status}`);
        }
      } else if (target.startsWith('eco://')) {
        info(`Portal target uses ECO transport: ${target}`);
      } else {
        await import(/* webpackIgnore: true */ target);
      }
      setPortalStatus((prev) => ({ ...prev, [target]: 'ready' }));
    } catch (err) {
      logError(`Failed to prepare portal ${target}`, err);
      setPortalStatus((prev) => ({ ...prev, [target]: 'error' }));
    }
  }, []);

  const selectWorld = useCallback(
    async (world: WorldOption) => {
      setSelectedWorld(world);
      setPortalStatus(() =>
        world.portals.reduce<Record<string, PortalStatus>>((acc, target) => {
          acc[target] = 'idle';
          return acc;
        }, {}),
      );
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(ENV_KEY, world.id);
      }
      info(`Switching environment to ${world.id}`);
      if (onWorldChange) {
        const component = await resolveWorldComponent(world.entryScene);
        onWorldChange(component);
      }
      await Promise.all(world.portals.map((portal) => loadPortal(portal)));
    },
    [loadPortal, onWorldChange],
  );

  const storedWorld = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const id = window.localStorage.getItem(ENV_KEY);
    if (!id) return null;
    return id;
  }, []);

  useEffect(() => {
    void fetchWorlds('Aurora');
  }, [fetchWorlds]);

  useEffect(() => {
    if (!storedWorld || results.length === 0) return;
    const world = results.find((candidate) => candidate.id === storedWorld);
    if (world) {
      void selectWorld(world);
    }
  }, [results, storedWorld, selectWorld]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SymbolCastNavigationDetail>).detail;
      if (!detail) return;
      if (detail.worldId) {
        const world = results.find((item) => item.id === detail.worldId);
        if (world) {
          void selectWorld(world);
        }
      }
      if (detail.portalTarget) {
        void loadPortal(detail.portalTarget);
      }
    };
    window.addEventListener('symbolcast:navigate', handler as EventListener);
    return () => window.removeEventListener('symbolcast:navigate', handler as EventListener);
  }, [results, selectWorld, loadPortal]);

  const portalEntries = selectedWorld
    ? selectedWorld.portals.map((portal) => ({
        target: portal,
        status: portalStatus[portal] ?? 'idle',
      }))
    : [];

  return (
    <Window className="top-4 left-4 bg-gray-950/80 text-white rounded-xl shadow-xl border border-indigo-500/30 p-4 w-80 space-y-3">
      <header className="space-y-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-200">
          Worlds
        </h2>
        <p className="text-xs text-indigo-200/80">
          Search live ECO manifests and jump through SymbolCast portals.
        </p>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void fetchWorlds(query || 'Aurora');
        }}
        className="space-y-2"
      >
        <label htmlFor="world-search" className="text-xs text-indigo-200">
          Search the Axum gateway
        </label>
        <div className="flex gap-2">
          <input
            id="world-search"
            className="flex-1 rounded bg-gray-900/70 px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            placeholder="Aurora, Chronos, …"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            type="submit"
            className="rounded bg-indigo-500 px-3 py-1 text-sm font-medium hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          >
            Go
          </button>
        </div>
      </form>
      {loading && <p className="text-xs text-indigo-200">Loading manifests…</p>}
      {error && <p className="text-xs text-red-300">{error}</p>}
      <ul className="space-y-2 max-h-40 overflow-y-auto" aria-label="Available worlds">
        {results.map((world) => (
          <li key={world.id}>
            <button
              type="button"
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                selectedWorld?.id === world.id
                  ? 'border-indigo-500 bg-indigo-500/20'
                  : 'border-indigo-500/20 hover:border-indigo-400'
              }`}
              onClick={() => void selectWorld(world)}
            >
              <div className="font-semibold text-indigo-100">{world.name}</div>
              <p className="text-xs text-indigo-200/80">{world.summary}</p>
            </button>
          </li>
        ))}
        {results.length === 0 && !loading && (
          <li className="text-xs text-indigo-200/70">Search for a world to begin.</li>
        )}
      </ul>
      {portalEntries.length > 0 && (
        <section className="space-y-2" aria-label="Portals">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-200">
            Portals
          </h3>
          <ul className="space-y-1">
            {portalEntries.map(({ target, status }) => (
              <li key={target} className="flex items-center justify-between text-xs text-indigo-100">
                <span className="truncate" title={target}>
                  {target}
                </span>
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                    status === 'ready'
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : status === 'loading'
                      ? 'bg-indigo-500/20 text-indigo-200'
                      : status === 'error'
                      ? 'bg-red-500/20 text-red-200'
                      : 'bg-gray-500/20 text-gray-200'
                  }`}
                >
                  {status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Window>
  );
}

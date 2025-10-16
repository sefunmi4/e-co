"use client";

import React, { useMemo } from "react";
import {
  LIGHTING_PRESETS,
  type LightingPreset,
} from "../../src/scene/lighting";
import {
  setLightingPreset,
  useLightingPreset,
} from "@frontend/state/lighting";
import { useFrameMetrics } from "@frontend/state/frameMetrics";

const formatFps = (value: number) => Math.round(value);

export default function BuilderHud() {
  const preset = useLightingPreset();
  const metrics = useFrameMetrics();

  const options = useMemo(
    () =>
      Object.entries(LIGHTING_PRESETS).map(([key, definition]) => ({
        value: key as LightingPreset,
        label: definition.label,
      })),
    [],
  );

  const meetsTarget = metrics.averageFps >= metrics.targetFps;
  const statusColor = meetsTarget ? "text-emerald-400" : "text-amber-300";

  const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextPreset = event.target.value as LightingPreset;
    setLightingPreset(nextPreset);
  };

  return (
    <div className="pointer-events-none absolute top-4 right-4 z-30 flex w-72 flex-col gap-3">
      <section className="pointer-events-auto rounded-xl border border-indigo-500/40 bg-slate-950/80 p-4 shadow-xl">
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-indigo-200">
            Builder HUD
          </h2>
          <span
            className={`text-[0.65rem] font-semibold uppercase tracking-[0.25em] ${statusColor}`}
          >
            {meetsTarget ? "On Target" : "Profiling"}
          </span>
        </header>
        <div className="space-y-3 text-sm text-indigo-100">
          <div className="space-y-2">
            <label className="block text-xs font-medium uppercase tracking-[0.2em] text-indigo-300">
              Lighting Preset
            </label>
            <select
              aria-label="Lighting preset"
              className="w-full rounded-lg border border-indigo-500/40 bg-slate-900/60 px-3 py-2 text-sm text-indigo-100 focus:border-indigo-300 focus:outline-none"
              onChange={handlePresetChange}
              value={preset}
            >
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-indigo-500/30 bg-slate-900/60 px-3 py-2 text-xs">
            <dl className="space-y-1">
              <div className="flex items-center justify-between">
                <dt className="uppercase tracking-[0.2em] text-indigo-300">FPS</dt>
                <dd className="font-semibold text-indigo-50">
                  {formatFps(metrics.fps)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="uppercase tracking-[0.2em] text-indigo-300">Avg</dt>
                <dd className="font-semibold text-indigo-50">
                  {formatFps(metrics.averageFps)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="uppercase tracking-[0.2em] text-indigo-300">Min</dt>
                <dd className="font-semibold text-indigo-50">
                  {formatFps(metrics.minFps)}
                </dd>
              </div>
              <div className="flex items-center justify-between text-[0.65rem] text-indigo-300/70">
                <dt className="uppercase tracking-[0.25em]">Target</dt>
                <dd>{metrics.targetFps} FPS</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
}

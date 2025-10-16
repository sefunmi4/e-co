import type { SnapshotManifest } from "@backend/lib/pods";

export type LightingPreset = "day" | "goldenHour" | "night";

export interface LightingDefinition {
  label: string;
  ambient: {
    color: string;
    intensity: number;
  };
  directional: {
    color: string;
    intensity: number;
    position: [number, number, number];
  };
  fog?: {
    color: string;
    near: number;
    far: number;
  };
  terrainColor: string;
  background: string;
}

export const LIGHTING_PRESETS: Record<LightingPreset, LightingDefinition> = {
  day: {
    label: "Day",
    ambient: {
      color: "#ffffff",
      intensity: 0.55,
    },
    directional: {
      color: "#f9fbff",
      intensity: 1.15,
      position: [12, 18, 6],
    },
    fog: {
      color: "#8ec5ff",
      near: 40,
      far: 140,
    },
    terrainColor: "#8bcf8f",
    background: "#0f172a",
  },
  goldenHour: {
    label: "Golden Hour",
    ambient: {
      color: "#ffedd5",
      intensity: 0.35,
    },
    directional: {
      color: "#f97316",
      intensity: 0.9,
      position: [-14, 10, -4],
    },
    fog: {
      color: "#fcd34d",
      near: 30,
      far: 110,
    },
    terrainColor: "#d97706",
    background: "#1e1b4b",
  },
  night: {
    label: "Night",
    ambient: {
      color: "#c7d2fe",
      intensity: 0.2,
    },
    directional: {
      color: "#6366f1",
      intensity: 0.55,
      position: [6, 14, -8],
    },
    fog: {
      color: "#312e81",
      near: 20,
      far: 90,
    },
    terrainColor: "#312e81",
    background: "#020617",
  },
};

export const DEFAULT_LIGHTING_PRESET: LightingPreset = "day";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const coerceRecord = (value: unknown): Record<string, unknown> =>
  (isRecord(value) ? value : {});

const isLightingPreset = (value: unknown): value is LightingPreset =>
  typeof value === "string" && value in LIGHTING_PRESETS;

export const resolveLightingPresetFromManifest = (
  manifest?: SnapshotManifest | null,
): LightingPreset | null => {
  if (!manifest) return null;
  const rendering = (manifest as Record<string, unknown>).rendering;
  if (!isRecord(rendering)) return null;
  const lighting = coerceRecord(rendering.lighting);
  const preset = lighting.preset;
  if (isLightingPreset(preset)) {
    return preset;
  }
  return null;
};

export const persistLightingPresetToManifest = (
  manifest: SnapshotManifest,
  preset: LightingPreset,
) => {
  const rendering = coerceRecord((manifest as Record<string, unknown>).rendering);
  const lighting = coerceRecord(rendering.lighting);
  lighting.preset = preset;
  const definition = LIGHTING_PRESETS[preset];
  lighting.configuration = {
    ambient: definition.ambient,
    directional: definition.directional,
    fog: definition.fog ?? null,
    terrainColor: definition.terrainColor,
    background: definition.background,
    updatedAt: new Date().toISOString(),
  };
  rendering.lighting = lighting;
  (manifest as Record<string, unknown>).rendering = rendering;
};

export const ensureLightingPresetOnManifest = (
  manifest: SnapshotManifest,
  preset: LightingPreset,
) => {
  persistLightingPresetToManifest(manifest, preset);
};

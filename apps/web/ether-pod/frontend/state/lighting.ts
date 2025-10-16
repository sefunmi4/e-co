import { create } from "zustand";
import type { SnapshotManifest } from "@backend/lib/pods";
import {
  DEFAULT_LIGHTING_PRESET,
  LIGHTING_PRESETS,
  ensureLightingPresetOnManifest,
  persistLightingPresetToManifest,
  resolveLightingPresetFromManifest,
  type LightingPreset,
} from "../../src/scene/lighting";

type LightingState = {
  preset: LightingPreset;
  manifest?: SnapshotManifest;
  manifestSlug?: string;
  setPreset: (preset: LightingPreset) => void;
  attachManifest: (manifest: SnapshotManifest, slug?: string) => void;
  detachManifest: (slug?: string) => void;
};

export const useLightingStore = create<LightingState>((set, get) => ({
  preset: DEFAULT_LIGHTING_PRESET,
  manifest: undefined,
  manifestSlug: undefined,
  setPreset: (preset) => {
    if (!(preset in LIGHTING_PRESETS)) {
      return;
    }
    const state = get();
    if (state.manifest) {
      persistLightingPresetToManifest(state.manifest, preset);
    }
    set({ preset });
  },
  attachManifest: (manifest, slug) => {
    const resolvedPreset =
      resolveLightingPresetFromManifest(manifest) ?? get().preset;
    ensureLightingPresetOnManifest(manifest, resolvedPreset);
    set({
      preset: resolvedPreset,
      manifest,
      manifestSlug: slug,
    });
  },
  detachManifest: (slug) => {
    const { manifestSlug } = get();
    if (manifestSlug && slug && manifestSlug !== slug) {
      return;
    }
    set({ manifest: undefined, manifestSlug: undefined });
  },
}));

export const useLightingPreset = () =>
  useLightingStore((state) => state.preset);

export const setLightingPreset = (preset: LightingPreset) =>
  useLightingStore.getState().setPreset(preset);

export const attachLightingManifest = (
  manifest: SnapshotManifest,
  slug?: string,
) => useLightingStore.getState().attachManifest(manifest, slug);

export const detachLightingManifest = (slug?: string) =>
  useLightingStore.getState().detachManifest(slug);

export const resetLightingStore = () =>
  useLightingStore.setState({
    preset: DEFAULT_LIGHTING_PRESET,
    manifest: undefined,
    manifestSlug: undefined,
  });

"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import SimplexNoise from "simplex-noise";
import {
  DEFAULT_JOB_ID,
  useFrequency,
} from "@frontend/state/frequency";
import { ensureFrequencySubscription } from "@backend/lib/frequency";
import {
  DEFAULT_LIGHTING_PRESET,
  LIGHTING_PRESETS,
  type LightingDefinition,
} from "../../src/scene/lighting";
import { useLightingPreset } from "@frontend/state/lighting";
import {
  resetFrameMetrics,
  updateFrameMetrics,
} from "@frontend/state/frameMetrics";

type TerrainProps = {
  frequency: number;
  color: string;
};

function Terrain({ frequency, color }: TerrainProps) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(100, 100, 64, 64);
    const noise = new SimplexNoise();
    const position = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = noise.noise2D(x * frequency, y * frequency) * 2;
      position.setZ(i, z);
    }
    geo.computeVertexNormals();
    return geo;
  }, [frequency]);

  return (
    <mesh geometry={geometry} rotation-x={-Math.PI / 2} receiveShadow>
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

type LightingRigProps = {
  config: LightingDefinition;
};

function LightingRig({ config }: LightingRigProps) {
  const { scene } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color(config.background);
    if (config.fog) {
      scene.fog = new THREE.Fog(
        config.fog.color,
        config.fog.near,
        config.fog.far,
      );
    } else {
      scene.fog = null;
    }
    return () => {
      scene.fog = null;
    };
  }, [config, scene]);

  return (
    <>
      <ambientLight
        color={config.ambient.color}
        intensity={config.ambient.intensity}
      />
      <directionalLight
        color={config.directional.color}
        intensity={config.directional.intensity}
        position={config.directional.position}
      />
    </>
  );
}

function FrameMetricsProbe() {
  const accumulator = useRef<number[]>([]);
  const lastCommit = useRef<number>(performance.now());

  useFrame((_, delta) => {
    if (delta <= 0) {
      return;
    }
    const fps = 1 / delta;
    accumulator.current.push(fps);
    const now = performance.now();
    if (now - lastCommit.current >= 200 && accumulator.current.length) {
      const samples = accumulator.current.length;
      const sum = accumulator.current.reduce((total, value) => total + value, 0);
      const min = accumulator.current.reduce(
        (lowest, value) => (value < lowest ? value : lowest),
        accumulator.current[0] ?? fps,
      );
      updateFrameMetrics({
        fps,
        averageFps: sum / samples,
        minFps: min,
        samples,
      });
      accumulator.current = [];
      lastCommit.current = now;
    }
  });

  useEffect(() => () => {
    resetFrameMetrics();
  }, []);

  return null;
}

export default function ProceduralBackground() {
  const frequency = useFrequency(DEFAULT_JOB_ID);
  const presetKey = useLightingPreset();
  const lighting =
    LIGHTING_PRESETS[presetKey] ?? LIGHTING_PRESETS[DEFAULT_LIGHTING_PRESET];

  useEffect(() => {
    ensureFrequencySubscription(DEFAULT_JOB_ID);
  }, []);

  return (
    <Canvas
      className="fixed inset-0 -z-20"
      gl={{ alpha: true }}
      data-frequency={frequency}
      data-lighting={presetKey}
      style={{ background: "transparent" }}
    >
      <FrameMetricsProbe />
      <LightingRig config={lighting} />
      <Terrain frequency={frequency} color={lighting.terrainColor} />
      <PointerLockControls />
    </Canvas>
  );
}

"use client";

import React, { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import SimplexNoise from 'simplex-noise';
import {
  DEFAULT_JOB_ID,
  useFrequency,
} from '@frontend/state/frequency';
import { ensureFrequencySubscription } from '@backend/lib/frequency';

type TerrainProps = {
  frequency: number;
};

function Terrain({ frequency }: TerrainProps) {
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
    <mesh geometry={geometry} rotation-x={-Math.PI / 2}>
      <meshStandardMaterial color="#88cc88" />
    </mesh>
  );
}

export default function ProceduralBackground() {
  const frequency = useFrequency(DEFAULT_JOB_ID);

  useEffect(() => {
    ensureFrequencySubscription(DEFAULT_JOB_ID);
  }, []);

  return (
    <Canvas
      className="fixed inset-0 -z-20"
      gl={{ alpha: true }}
      data-frequency={frequency}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} />
      <Terrain frequency={frequency} />
      <PointerLockControls />
    </Canvas>
  );
}

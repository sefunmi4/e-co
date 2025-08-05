import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import SimplexNoise from 'simplex-noise';
import getFrequency from '../lib/frequency';

function Terrain() {
  const freq = getFrequency();
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(100, 100, 64, 64);
    const noise = new SimplexNoise();
    const position = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = noise.noise2D(x * freq, y * freq) * 2;
      position.setZ(i, z);
    }
    geo.computeVertexNormals();
    return geo;
  }, [freq]);

  return (
    <mesh geometry={geometry} rotation-x={-Math.PI / 2}>
      <meshStandardMaterial color="#88cc88" />
    </mesh>
  );
}

export default function ProceduralBackground() {
  return (
    <Canvas className="fixed inset-0 -z-10">
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} />
      <Terrain />
      <PointerLockControls />
    </Canvas>
  );
}

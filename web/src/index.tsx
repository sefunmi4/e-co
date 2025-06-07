import React, { useRef, useMemo, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

function Landscape() {
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(50, 50, 50, 50);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, Math.random() * 2);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh geometry={geom} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#88c" wireframe={false} />
    </mesh>
  );
}

function Scene() {
  const camRef = useRef<THREE.PerspectiveCamera>(null!);
  const [pos, setPos] = useState([0, 5, 10]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      setPos(p => {
        const [x, y, z] = p;
        const step = 1;
        switch (e.key) {
          case 'ArrowUp':
            return [x, y, z - step];
          case 'ArrowDown':
            return [x, y, z + step];
          case 'ArrowLeft':
            return [x - step, y, z];
          case 'ArrowRight':
            return [x + step, y, z];
          default:
            return p;
        }
      });
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);

  useFrame(() => {
    if (camRef.current) {
      camRef.current.position.set(pos[0], pos[1], pos[2]);
    }
  });

  return (
    <>
      <perspectiveCamera ref={camRef} position={pos} fov={75} />
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Landscape />
      <OrbitControls />
    </>
  );
}

const App = () => (
  <Canvas className="w-screen h-screen bg-black">
    <Scene />
  </Canvas>
);

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

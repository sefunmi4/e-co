import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Suspense, useMemo } from 'react';

function FloatingArtifact({ position, color, scale }: { position: [number, number, number]; color: string; scale: number }) {
  return (
    <mesh position={position} scale={scale} castShadow>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} metalness={0.3} roughness={0.2} />
    </mesh>
  );
}

function Scene() {
  const artifacts = useMemo(
    () => [
      { position: [0, 0.4, 0] as [number, number, number], color: '#8c7bff', scale: 1.4 },
      { position: [-2, -0.2, -1] as [number, number, number], color: '#4ac2ff', scale: 0.8 },
      { position: [1.6, 0.9, -1.8] as [number, number, number], color: '#ff7aa2', scale: 0.6 },
      { position: [-1.4, 1.2, 1.6] as [number, number, number], color: '#77ffad', scale: 0.7 },
    ],
    []
  );

  return (
    <>
      <color attach="background" args={["#04060f"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 4, 5]} intensity={1.4} castShadow />
      <pointLight position={[-4, -2, -3]} intensity={0.6} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[8, 64]} />
        <meshStandardMaterial color="#080b1c" metalness={0.1} roughness={0.8} />
      </mesh>

      {artifacts.map((artifact, index) => (
        <FloatingArtifact key={index} {...artifact} />
      ))}

      <Stars radius={50} depth={40} count={1200} factor={4} saturation={0} fade speed={1} />
      <OrbitControls enablePan={false} minDistance={4} maxDistance={8} />
    </>
  );
}

export function WorldPreview() {
  return (
    <section className="preview">
      <div className="preview__header">
        <div>
          <p className="eyebrow">Private landing site</p>
          <h2>Your Pod World: Atelier Orbits</h2>
        </div>
        <div className="preview__badges">
          <span>Spatial Search Enabled</span>
          <span>Invite-only</span>
        </div>
      </div>

      <div className="preview__canvas">
        <Suspense fallback={<div className="loading">Loading volumetric artifacts…</div>}>
          <Canvas shadows camera={{ position: [4, 3, 6], fov: 45 }}>
            <Scene />
          </Canvas>
        </Suspense>
      </div>

      <p className="preview__caption">
        Curate private artifacts before syncing them to the shared Ether Net directory. Enable portals so invited friends can
        teleport directly to this scene from their desktop shell.
      </p>
    </section>
  );
}

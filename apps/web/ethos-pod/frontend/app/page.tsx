'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import CommandPalette from '../components/CommandPalette';
import Desktop from '../components/Desktop';
import EnvManager from '../components/EnvManager';
import ForegroundOverlay from '../components/ForegroundOverlay';
import ModelDashboard from '../components/ModelDashboard';
import ProceduralBackground from '../components/ProceduralBackground';
import { info } from '@eco/js-sdk/logger';

export default function HomePage() {
  const [World, setWorld] = useState<ComponentType | null>(
    () => ProceduralBackground
  );

  useEffect(() => {
    info('Starting E-CO web shell');
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {World && <World />}
      <ForegroundOverlay />
      <Desktop />
      <EnvManager onWorldChange={setWorld} />
      <CommandPalette />
      <ModelDashboard />
    </div>
  );
}

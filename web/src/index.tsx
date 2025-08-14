import React from 'react';
import { info } from './logger';
import ReactDOM from 'react-dom/client';
import EnvManager from './components/EnvManager';
import CommandPalette from './components/CommandPalette';
import ModelDashboard from './components/ModelDashboard';
import ProceduralBackground from './components/ProceduralBackground';
import ForegroundOverlay from './components/ForegroundOverlay';
import Desktop from './components/Desktop';

const App = () => {
  const [World, setWorld] = React.useState<React.ComponentType | null>(
    () => ProceduralBackground
  );

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      {World && <World />}
      <ForegroundOverlay />
      <Desktop />
      <EnvManager onWorldChange={setWorld} />
      <CommandPalette />
      <ModelDashboard />
    </div>
  );
};

info('Starting web application');
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

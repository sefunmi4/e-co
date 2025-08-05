import React from 'react';
import { info } from './logger';
import ReactDOM from 'react-dom/client';
import EnvManager from './components/EnvManager';
import LauncherMenu from './components/LauncherMenu';
import CommandPalette from './components/CommandPalette';
import ModelDashboard from './components/ModelDashboard';
import ProceduralBackground from './components/ProceduralBackground';

const App = () => (
  <div className="w-screen h-screen relative overflow-hidden">
    <ProceduralBackground />
    <EnvManager />
    <LauncherMenu />
    <CommandPalette />
    <ModelDashboard />
  </div>
);

info('Starting web application');
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

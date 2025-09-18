import React from 'react';
import LauncherMenu from './LauncherMenu';

interface TaskbarProps {
  /** Names of open windows to display */
  openFolders: string[];
}

export default function Taskbar({ openFolders }: TaskbarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-10 bg-gray-900 text-white flex items-center px-2 space-x-2 z-30">
      <LauncherMenu />
      {openFolders.map((name) => (
        <div
          key={name}
          className="bg-gray-700 px-2 py-1 rounded text-sm"
        >
          {name}
        </div>
      ))}
    </div>
  );
}

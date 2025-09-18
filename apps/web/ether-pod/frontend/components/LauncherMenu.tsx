"use client";

import React, { useState } from 'react';
import { info } from '@eco/js-sdk/logger';
import Window from './Window';

const apps = [
  { name: 'Terminal', action: () => alert('Terminal launching...') },
  { name: 'Settings', action: () => alert('Settings opening...') },
  { name: 'Docs', action: () => window.open('https://example.com', '_blank') },
];

export default function LauncherMenu() {
  const [open, setOpen] = useState(false);

  return (
    <Window className="bottom-4 left-4">
      <button
        className="bg-gray-800 text-white px-3 py-2 rounded"
        onClick={() => {
          setOpen(!open);
          info(`Launcher menu ${!open ? 'opened' : 'closed'}`);
        }}
      >
        Start
      </button>
      {open && (
        <div className="mt-1 p-2 bg-white shadow-lg rounded w-40">
          <input
            placeholder="Search..."
            className="w-full mb-2 border px-1 py-0.5"
          />
          <ul className="space-y-1">
            {apps.map((app) => (
              <li key={app.name}>
                <button
                  onClick={() => {
                    info(`Launching ${app.name}`);
                    app.action();
                  }}
                  className="w-full text-left px-1 py-0.5 hover:bg-gray-100"
                >
                  {app.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Window>
  );
}

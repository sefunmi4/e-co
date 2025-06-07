import React, { useState } from 'react';

const apps = [
  { name: 'Terminal', action: () => alert('Terminal launching...') },
  { name: 'Settings', action: () => alert('Settings opening...') },
  { name: 'Docs', action: () => window.open('https://example.com', '_blank') },
];

export default function LauncherMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-4 left-4">
      <button
        className="bg-gray-800 text-white px-3 py-2 rounded"
        onClick={() => setOpen(!open)}
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
                  onClick={app.action}
                  className="w-full text-left px-1 py-0.5 hover:bg-gray-100"
                >
                  {app.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

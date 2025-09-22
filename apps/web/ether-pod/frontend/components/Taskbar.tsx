"use client";

import React from 'react';
import LauncherMenu from './LauncherMenu';
import { useEthosStore } from '../state/ethos';

export default function Taskbar() {
  const openRooms = useEthosStore((state) => state.openRooms);
  const rooms = useEthosStore((state) => state.rooms);
  const activeRoomId = useEthosStore((state) => state.activeRoomId);
  const setActiveRoom = useEthosStore((state) => state.setActiveRoom);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-12 bg-gray-950/80 backdrop-blur text-white flex items-center px-3 space-x-3 z-40 border-t border-indigo-500/30">
      <LauncherMenu />
      <nav className="flex items-center gap-2 overflow-x-auto" aria-label="Active conversations">
        {openRooms.map((id) => {
          const conversation = rooms[id];
          const label = conversation?.topic || id;
          const isActive = id === activeRoomId;
          return (
            <button
              key={id}
              type="button"
              className={`px-3 py-1.5 rounded-full text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 ${
                isActive
                  ? 'bg-indigo-500 text-white shadow'
                  : 'bg-gray-800/80 hover:bg-gray-700'
              }`}
              onClick={() => setActiveRoom(id)}
            >
              {label}
            </button>
          );
        })}
        {openRooms.length === 0 && (
          <span className="text-xs text-gray-400">
            Join a guild thread to pin it here.
          </span>
        )}
      </nav>
    </div>
  );
}

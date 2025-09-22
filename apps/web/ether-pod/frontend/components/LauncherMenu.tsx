"use client";

import React, { useMemo, useState } from 'react';
import Window from './Window';
import { useEthosStore } from '../state/ethos';

export default function LauncherMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const roomsRecord = useEthosStore((state) => state.rooms);
  const status = useEthosStore((state) => state.status);
  const openConversation = useEthosStore((state) => state.openConversation);

  const rooms = useMemo(() => Object.values(roomsRecord), [roomsRecord]);

  const filtered = useMemo(() => {
    if (!query) return rooms;
    const needle = query.toLowerCase();
    return rooms.filter((room) =>
      room.topic.toLowerCase().includes(needle) ||
      room.participantIds.some((id) => id.toLowerCase().includes(needle)),
    );
  }, [rooms, query]);

  const handleLaunch = async (conversationId: string) => {
    await openConversation(conversationId);
    setOpen(false);
  };

  return (
    <Window className="bottom-4 left-4">
      <button
        type="button"
        className="bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white px-4 py-2 rounded-full shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-300"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Guilds
      </button>
      {open && (
        <div className="mt-2 w-64 rounded-lg bg-gray-900/95 text-white shadow-xl border border-indigo-500/40 p-3 space-y-3">
          <div>
            <label htmlFor="guild-search" className="text-xs uppercase tracking-wide text-indigo-200 block mb-1">
              Search threads
            </label>
            <input
              id="guild-search"
              className="w-full rounded bg-gray-800 px-2 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              placeholder="Search by topic or member"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
          </div>
          {status === 'connecting' && (
            <p className="text-xs text-indigo-200">Connecting to Ethos…</p>
          )}
          <ul className="space-y-1 max-h-48 overflow-y-auto" role="menu">
            {filtered.map((room) => (
              <li key={room.id}>
                <button
                  type="button"
                  className="w-full text-left px-2 py-1 rounded hover:bg-indigo-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                  onClick={() => handleLaunch(room.id)}
                  role="menuitem"
                >
                  <div className="text-sm font-medium">{room.topic}</div>
                  <div className="text-xs text-indigo-200/80 truncate">
                    {room.participantIds.join(', ') || 'No participants'}
                  </div>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="text-xs text-indigo-200/70">No matching conversations</li>
            )}
          </ul>
        </div>
      )}
    </Window>
  );
}

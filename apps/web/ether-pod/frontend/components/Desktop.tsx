"use client";

import React, { useEffect } from 'react';
import ChatWindow from './ChatWindow';
import Taskbar from './Taskbar';
import { useEthosStore } from '../state/ethos';

export default function Desktop() {
  const bootstrap = useEthosStore((state) => state.bootstrap);
  const openRooms = useEthosStore((state) => state.openRooms);
  const status = useEthosStore((state) => state.status);
  const error = useEthosStore((state) => state.error);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <>
      <div className="absolute inset-0 z-20">
        {status === 'connecting' && (
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-indigo-500/40 bg-gray-950/70 px-6 py-4 text-indigo-100 shadow-xl">
            Connecting to Ethos…
          </div>
        )}
        {status === 'error' && error && (
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-red-500/50 bg-red-950/80 px-6 py-4 text-red-100 shadow-xl">
            {error}
          </div>
        )}
        {openRooms.map((conversationId, index) => (
          <ChatWindow key={conversationId} conversationId={conversationId} index={index} />
        ))}
      </div>
      <Taskbar />
    </>
  );
}

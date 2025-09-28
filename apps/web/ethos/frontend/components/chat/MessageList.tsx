"use client";

import type { EnrichedMessage } from "@/lib/stores/conversations";
import { useEffect, useRef } from "react";

interface MessageListProps {
  conversationId: string;
  loading: boolean;
  messages: EnrichedMessage[];
}

export default function MessageList({ conversationId, loading, messages }: MessageListProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [conversationId, messages.length]);

  return (
    <div ref={ref} className="flex-1 overflow-y-auto bg-slate-950 px-8 py-6">
      {loading ? (
        <p className="text-sm text-slate-400">Loading messages…</p>
      ) : (
        <ul className="space-y-4">
          {messages.map((item) => (
            <li key={item.message.id} className="space-y-1 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-slate-200">{item.sender.displayName ?? item.sender.userId}</span>
                <time className="font-mono text-[10px] uppercase tracking-wide text-slate-500">
                  {new Date(Number(item.message.timestampMs)).toLocaleTimeString()}
                </time>
              </div>
              <p className="whitespace-pre-line text-sm text-slate-100">{item.message.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

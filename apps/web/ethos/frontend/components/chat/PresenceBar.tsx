"use client";

import { Conversation } from "@/lib/proto/ethos_pb";
import { useConversationStore } from "@/lib/stores/conversations";
import clsx from "clsx";

interface PresenceBarProps {
  conversation: Conversation;
}

export default function PresenceBar({ conversation }: PresenceBarProps) {
  const presence = useConversationStore((state) => state.presence);

  return (
    <ul className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
      {conversation.participants.map((participant) => {
        const state = presence[participant.userId];
        return (
          <li
            key={participant.userId}
            className={clsx(
              "flex items-center gap-2 rounded-full border px-3 py-1",
              state?.state === "STATE_ONLINE"
                ? "border-emerald-500/40 text-emerald-200"
                : state?.state === "STATE_AWAY"
                  ? "border-amber-400/40 text-amber-200"
                  : "border-slate-700 text-slate-400"
            )}
          >
            <span className="font-semibold text-slate-100">{participant.displayName ?? participant.userId}</span>
            <span className="text-[10px] uppercase tracking-widest">
              {state ? state.state.replace("STATE_", "") : "OFFLINE"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

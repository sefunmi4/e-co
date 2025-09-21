"use client";

import { Conversation } from "@/lib/proto/ethos_pb";
import { useConversationStore } from "@/lib/stores/conversations";
import clsx from "clsx";

interface SidebarProps {
  conversations: Conversation[];
}

export default function Sidebar({ conversations }: SidebarProps) {
  const { activeConversationId, selectConversation } = useConversationStore((state) => ({
    activeConversationId: state.activeConversationId,
    selectConversation: state.selectConversation,
  }));

  return (
    <aside className="flex h-full flex-col border-r border-slate-800 bg-slate-950/70">
      <div className="border-b border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white">Conversations</h2>
        <p className="text-sm text-slate-400">Guild chatter and quest coordination rooms.</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {conversations.map((conversation) => {
            const isActive = conversation.id === activeConversationId;
            return (
              <li key={conversation.id}>
                <button
                  onClick={() => selectConversation(conversation.id)}
                  className={clsx(
                    "w-full rounded-xl px-4 py-3 text-left transition",
                    isActive
                      ? "bg-brand-500/20 text-white"
                      : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                  )}
                >
                  <p className="text-sm font-semibold">{conversation.topic || "Untitled"}</p>
                  <p className="text-xs text-slate-400">
                    {conversation.participants.map((p) => p.displayName || p.userId).join(", ")}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

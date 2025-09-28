"use client";

import { useConversationStore } from "@/lib/stores/conversations";
import MessageComposer from "./MessageComposer";
import MessageList from "./MessageList";
import PresenceBar from "./PresenceBar";

export default function ConversationView() {
  const { activeConversation, loading } = useConversationStore((state) => ({
    activeConversation: state.activeConversation,
    loading: state.loading,
  }));

  if (!activeConversation) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-4 bg-slate-950">
        <h2 className="text-xl font-semibold text-white">Choose a conversation</h2>
        <p className="max-w-md text-center text-sm text-slate-400">
          Select a guild chat to load Matrix history via the Rust gateway, or start a new quest-focused conversation.
        </p>
      </section>
    );
  }

  return (
    <section className="flex h-full flex-col bg-slate-950">
      <div className="border-b border-slate-800 px-8 py-4">
        <h2 className="text-lg font-semibold text-white">{activeConversation.topic || "Untitled conversation"}</h2>
        <PresenceBar conversation={activeConversation} />
      </div>
      <MessageList
        conversationId={activeConversation.id}
        loading={loading}
        messages={activeConversation.messages}
      />
      <MessageComposer conversationId={activeConversation.id} />
    </section>
  );
}

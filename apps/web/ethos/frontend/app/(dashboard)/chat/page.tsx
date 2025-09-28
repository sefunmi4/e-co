"use client";

import ConversationView from "@/components/chat/ConversationView";
import Sidebar from "@/components/layout/Sidebar";
import { useConversationStore } from "@/lib/stores/conversations";
import { useSessionStore } from "@/lib/stores/session";
import { useEffect } from "react";

export default function ChatPage() {
  const { status, token } = useSessionStore((state) => ({
    status: state.status,
    token: state.session?.token,
  }));
  const bootstrap = useConversationStore((state) => state.bootstrap);
  const teardownStream = useConversationStore((state) => state.teardownStream);
  const conversations = useConversationStore((state) => state.conversations);

  useEffect(() => {
    if (status === "authenticated" && token) {
      bootstrap();
    }
    return () => {
      teardownStream();
    };
  }, [status, token, bootstrap, teardownStream]);

  return (
    <div className="grid h-full grid-cols-[20rem_1fr] overflow-hidden">
      <Sidebar conversations={conversations} />
      <ConversationView />
    </div>
  );
}

"use client";

import { useConversationStore } from "@/lib/stores/conversations";
import { FormEvent, useState } from "react";

interface MessageComposerProps {
  conversationId: string;
}

export default function MessageComposer({ conversationId }: MessageComposerProps) {
  const { sendMessage, sending } = useConversationStore((state) => ({
    sendMessage: state.sendMessage,
    sending: state.sending,
  }));
  const [body, setBody] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) return;
    await sendMessage(conversationId, body);
    setBody("");
  };

  return (
    <form onSubmit={onSubmit} className="border-t border-slate-800 bg-slate-950/90 px-8 py-4">
      <div className="flex items-end gap-3">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          placeholder="Share your update, drop a quest artifact, or coordinate a raid…"
          className="flex-1 resize-none rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-white shadow-inner focus:border-brand-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </form>
  );
}

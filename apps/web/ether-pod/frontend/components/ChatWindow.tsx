"use client";

import React, { useMemo, useState } from 'react';
import Window from './Window';
import {
  useEthosStore,
  type NormalizedMessage,
} from '../state/ethos';
import { PresenceState } from '../../lib/proto/ethos_pb';

interface ChatWindowProps {
  conversationId: string;
  index: number;
}

const presenceLabel: Record<PresenceState, string> = {
  [PresenceState.PRESENCE_STATE_UNSPECIFIED]: 'Unknown',
  [PresenceState.STATE_OFFLINE]: 'Offline',
  [PresenceState.STATE_ONLINE]: 'Online',
  [PresenceState.STATE_AWAY]: 'Away',
  [PresenceState.STATE_BUSY]: 'Busy',
};

const formatTimestamp = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

const messageKey = (message: NormalizedMessage) => `${message.id}-${message.timestamp}`;

export default function ChatWindow({ conversationId, index }: ChatWindowProps) {
  const conversation = useEthosStore((state) => state.rooms[conversationId]);
  const rawMessages = useEthosStore(
    (state) => state.messageBuffers[conversationId],
  );
  const rosterMap = useEthosStore((state) => state.roster);
  const closeConversation = useEthosStore((state) => state.closeConversation);
  const sendMessage = useEthosStore((state) => state.sendMessage);
  const setActiveRoom = useEthosStore((state) => state.setActiveRoom);
  const activeRoomId = useEthosStore((state) => state.activeRoomId);
  const [draft, setDraft] = useState('');

  const messages = rawMessages ?? [];
  const participantIds = useMemo(
    () => conversation?.participantIds ?? [],
    [conversation],
  );
  const roster = useMemo(
    () =>
      participantIds
        .map((id) => rosterMap[id])
        .filter((entry): entry is typeof rosterMap[string] => Boolean(entry)),
    [participantIds, rosterMap],
  );

  const participantsLabel = useMemo(() => {
    if (roster.length === 0) return 'No participants';
    return roster.map((member) => member.displayName).join(', ');
  }, [roster]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    await sendMessage(conversationId, draft);
    setDraft('');
  };

  if (!conversation) {
    return null;
  }

  const isActive = activeRoomId === conversationId;

  return (
    <Window
      className="w-96 h-[28rem]"
      style={{ top: 96 + index * 24, left: 80 + index * 32 }}
    >
      <div
        className={`flex h-full flex-col rounded-xl border ${
          isActive ? 'border-indigo-400' : 'border-transparent'
        } bg-gray-950/90 text-gray-100 backdrop-blur pointer-events-auto`}
        onMouseDown={() => setActiveRoom(conversationId)}
        data-testid={`chat-window-${conversationId}`}
      >
        <header className="border-b border-indigo-500/30 px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-indigo-100">
                {conversation.topic}
              </h2>
              <p className="text-xs text-indigo-200/80" title={participantsLabel}>
                {participantsLabel}
              </p>
            </div>
            <button
              type="button"
              className="text-indigo-200 hover:text-white"
              onClick={() => closeConversation(conversationId)}
              aria-label="Close conversation"
            >
              ×
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto space-y-3 px-4 py-3" data-testid="chat-thread">
          {messages.length === 0 && (
            <p className="text-xs text-indigo-200/60">
              No messages yet. Start the conversation below.
            </p>
          )}
          {messages.map((message) => {
            const sender = roster.find((member) => member.userId === message.senderId);
            return (
              <article
                key={messageKey(message)}
                className="rounded-lg bg-gray-900/70 p-3 shadow-sm"
              >
                <header className="mb-1 flex items-center justify-between text-xs text-indigo-200/90">
                  <span className="font-semibold">
                    {sender?.displayName || message.senderId || 'Unknown' }
                  </span>
                  <span className="text-[10px] uppercase tracking-wide">
                    {sender ? presenceLabel[sender.presence] : 'Unknown'} ·{' '}
                    {formatTimestamp(message.timestamp)}
                  </span>
                </header>
                <p className="text-sm leading-snug whitespace-pre-wrap break-words">
                  {message.body}
                </p>
              </article>
            );
          })}
        </div>
        <form onSubmit={handleSubmit} className="border-t border-indigo-500/30 px-4 py-3 space-y-2">
          <label htmlFor={`chat-input-${conversationId}`} className="text-xs text-indigo-200">
            Send a message
          </label>
          <textarea
            id={`chat-input-${conversationId}`}
            className="h-16 w-full resize-none rounded-lg bg-gray-900/80 px-3 py-2 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            placeholder="Share updates with the guild"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-full bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              Post
            </button>
          </div>
        </form>
      </div>
    </Window>
  );
}

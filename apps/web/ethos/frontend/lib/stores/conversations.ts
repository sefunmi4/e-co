"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createConversationsClient } from "@/lib/api/grpc";
import type {
  Conversation,
  Message,
  Participant,
  PresenceEvent,
  StreamMessagesResponse,
} from "@/lib/proto/ethos_pb";
import { PresenceState } from "@/lib/proto/ethos_pb";
import type { PlainMessage } from "@bufbuild/protobuf";
import { useSessionStore } from "./session";

export type NormalizedParticipant = PlainMessage<Participant>;
export type NormalizedMessage = PlainMessage<Message>;
export type NormalizedPresenceEvent = PlainMessage<PresenceEvent>;

export interface EnrichedMessage {
  message: NormalizedMessage;
  sender: NormalizedParticipant;
}

export interface ConversationWithMessages extends PlainMessage<Conversation> {
  messages: EnrichedMessage[];
}

interface ConversationsResponse {
  conversations: (PlainMessage<Conversation> & { messages: PlainMessage<Message>[] })[];
  presence: PlainMessage<PresenceEvent>[];
}

export interface ConversationsState {
  loading: boolean;
  sending: boolean;
  conversations: ConversationWithMessages[];
  presence: Record<string, NormalizedPresenceEvent>;
  activeConversation?: ConversationWithMessages;
  activeConversationId?: string;
  stream?: AsyncIterable<StreamMessagesResponse>;
  eventSource?: EventSource | null;
  bootstrap: () => Promise<void>;
  selectConversation: (conversationId: string) => void;
  sendMessage: (conversationId: string, body: string) => Promise<void>;
  addMessage: (conversationId: string, message: NormalizedMessage) => void;
  updatePresence: (event: NormalizedPresenceEvent) => void;
  teardownStream: () => void;
}

const client = createConversationsClient();

const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:8080";

const normalizePresence = (event: PlainMessage<PresenceEvent>): NormalizedPresenceEvent => ({
  userId: event.userId ?? "",
  state: event.state ?? PresenceState.PRESENCE_STATE_UNSPECIFIED,
  updatedAt: BigInt(event.updatedAt ?? Date.now()),
});

const parsePresence = (events: PlainMessage<PresenceEvent>[]) => {
  return events.reduce<Record<string, NormalizedPresenceEvent>>((acc, event) => {
    const parsed = normalizePresence(event);
    acc[parsed.userId] = parsed;
    return acc;
  }, {});
};

const normalizeParticipant = (participant: PlainMessage<Participant>): NormalizedParticipant => ({
  userId: participant.userId ?? "",
  displayName: participant.displayName ?? "",
  avatarUrl: participant.avatarUrl ?? "",
});

const normalizeMessage = (message: PlainMessage<Message>): NormalizedMessage => ({
  id: message.id ?? "",
  conversationId: message.conversationId ?? "",
  senderId: message.senderId ?? "",
  body: message.body ?? "",
  timestampMs: BigInt(message.timestampMs ?? Date.now()),
});

const normalizeConversation = (
  rawConversation: PlainMessage<Conversation> & { messages: PlainMessage<Message>[] },
): ConversationWithMessages => {
  const participants = (rawConversation.participants ?? []).map(normalizeParticipant);
  const messages: EnrichedMessage[] = (rawConversation.messages ?? []).map((rawMessage) => {
    const message = normalizeMessage(rawMessage);
    return {
      message,
      sender:
        participants.find((participant) => participant.userId === message.senderId) ??
        normalizeParticipant({ userId: message.senderId, displayName: "", avatarUrl: "" }),
    };
  });
  return {
    id: rawConversation.id ?? "",
    topic: rawConversation.topic ?? "",
    participants,
    updatedAt: BigInt(rawConversation.updatedAt ?? Date.now()),
    messages,
  };
};

export const useConversationStore = create<ConversationsState>()(
  devtools((set, get) => ({
    loading: false,
    sending: false,
    conversations: [],
    presence: {},
    activeConversation: undefined,
    stream: undefined,
    eventSource: null,
    async bootstrap() {
      const token = useSessionStore.getState().session?.token;
      if (!token) return;
      set({ loading: true });
      try {
        const response = await fetch(`${gatewayUrl}/api/conversations`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Failed to load conversations: ${response.status}`);
        }
        const payload = (await response.json()) as ConversationsResponse;
        const mapped = payload.conversations.map((rawConversation) => normalizeConversation(rawConversation));
        set({
          conversations: mapped,
          presence: parsePresence(payload.presence),
          activeConversation: mapped[0],
          loading: false,
        });
        if (mapped[0]) {
          get().selectConversation(mapped[0].id);
        }
      } catch (error) {
        console.error(error);
        set({ loading: false });
      }
    },
    selectConversation(conversationId) {
      const { conversations, eventSource, activeConversationId } = get();
      if (conversationId === activeConversationId) return;
      const nextConversation = conversations.find((conversation) => conversation.id === conversationId);
      set({
        activeConversationId: conversationId,
        activeConversation: nextConversation,
        loading: !nextConversation,
      });
      if (eventSource) {
        eventSource.close();
      }
      const session = useSessionStore.getState().session;
      if (!session) return;
      const source = new EventSource(
        `${gatewayUrl}/api/conversations/${conversationId}/stream?token=${session.token}`,
      );
      source.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as {
            type: "message" | "presence";
            message?: Message;
            presence?: PresenceEvent;
          };
          if (data.type === "message" && data.message) {
            get().addMessage(
              conversationId,
              normalizeMessage(data.message as PlainMessage<Message>),
            );
          } else if (data.type === "presence" && data.presence) {
            get().updatePresence(normalizePresence(data.presence as PlainMessage<PresenceEvent>));
          }
        } catch (error) {
          console.warn("Failed to parse SSE payload", error);
        }
      };
      source.onerror = (event) => {
        console.warn("SSE connection error", event);
      };
      set({ eventSource: source });
    },
    async sendMessage(conversationId, body) {
      const token = useSessionStore.getState().session?.token;
      if (!token) throw new Error("Not authenticated");
      set({ sending: true });
      try {
        const response = await client.sendMessage({ conversationId, body });
        get().addMessage(conversationId, response.message!);
      } finally {
        set({ sending: false });
      }
    },
    addMessage(conversationId, message) {
      set((state) => {
        let activeConversation = state.activeConversation;
        const conversations = state.conversations.map((conversation) => {
          if (conversation.id !== conversationId) return conversation;
          const sender =
            conversation.participants.find((participant) => participant.userId === message.senderId) ??
            normalizeParticipant({
              userId: message.senderId,
              displayName: "",
              avatarUrl: "",
            });
          const updatedConversation = {
            ...conversation,
            messages: [...conversation.messages, { message, sender }],
          };
          if (state.activeConversationId === conversationId) {
            activeConversation = updatedConversation;
          }
          return updatedConversation;
        });
        return { conversations, activeConversation, loading: false };
      });
    },
    updatePresence(event) {
      set((state) => ({
        presence: {
          ...state.presence,
          [event.userId]: event,
        },
      }));
    },
    teardownStream() {
      const { eventSource } = get();
      eventSource?.close();
      set({ eventSource: null });
    },
  })),
);

export const resetConversationStore = () =>
  useConversationStore.setState((state) => ({
    ...state,
    loading: false,
    sending: false,
    conversations: [],
    presence: {},
    activeConversation: undefined,
    activeConversationId: undefined,
    stream: undefined,
    eventSource: null,
  }));
